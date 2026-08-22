import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

/**
 * Rate limiting for the authentication surface.
 *
 * Every limiter here is a *sliding* window rather than a fixed one: a fixed
 * window lets an attacker spend a full quota at 14:59 and another at 15:00,
 * doubling the effective rate across the boundary.
 *
 * The whole module **fails open**. If Upstash is unconfigured, unreachable or
 * slow, the request proceeds unlimited. That is a deliberate trade: an Upstash
 * outage must not lock every user out of signing in. The cost is that a
 * misconfigured environment silently enforces nothing, which is why the
 * fallback logs once rather than passing quietly.
 */

/** The limits from `context/features/rate-limiting-spec.md`. */
const LIMITS = {
  /** Sign-in, keyed by IP *and* email so one address cannot be ground down. */
  signIn: { tokens: 5, window: "15 m" },
  register: { tokens: 3, window: "1 h" },
  forgotPassword: { tokens: 3, window: "1 h" },
  resetPassword: { tokens: 5, window: "15 m" },
  resendVerification: { tokens: 3, window: "15 m" },
} as const satisfies Record<
  string,
  { tokens: number; window: Parameters<typeof Ratelimit.slidingWindow>[1] }
>;

export type RateLimitName = keyof typeof LIMITS;

export interface RateLimitResult {
  /** False when the caller has exhausted the window and should be refused. */
  success: boolean;
  /** Requests left in the current window. `Infinity` when limiting is off. */
  remaining: number;
  /** Epoch milliseconds at which the window frees up. `0` when limiting is off. */
  reset: number;
  /** Whole seconds until `reset`, for the `Retry-After` header. */
  retryAfterSeconds: number;
  /** The one sentence every refused caller is shown, on any surface. */
  message: string;
}

/** What a caller gets when limiting could not run at all. */
const UNLIMITED: RateLimitResult = {
  success: true,
  remaining: Number.POSITIVE_INFINITY,
  reset: 0,
  retryAfterSeconds: 0,
  message: "",
};

/**
 * Shared across every limiter so a blocked identifier can be refused without a
 * network round trip. Per-instance and best-effort — it only ever *adds*
 * blocks the store already decided on, so it cannot let a request through that
 * Upstash would have refused. Mostly it keeps a flood of retries off the free
 * tier's 10k requests/day budget.
 */
const ephemeralCache = new Map<string, number>();

let redis: Redis | null | undefined;
let warnedAboutMissingConfig = false;

/**
 * The Upstash client, or `null` when the environment has no credentials.
 *
 * Resolved once and cached — including the `null`, so a project running without
 * Upstash does not re-read the environment on every request.
 */
function getRedis(): Redis | null {
  if (redis !== undefined) {
    return redis;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (!warnedAboutMissingConfig) {
      warnedAboutMissingConfig = true;
      console.warn(
        "[rate-limit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset — auth rate limiting is disabled.",
      );
    }

    redis = null;
    return redis;
  }

  redis = new Redis({ url, token });
  return redis;
}

const limiters = new Map<RateLimitName, Ratelimit>();

function getLimiter(name: RateLimitName): Ratelimit | null {
  const client = getRedis();

  if (!client) {
    return null;
  }

  const existing = limiters.get(name);

  if (existing) {
    return existing;
  }

  const { tokens, window } = LIMITS[name];

  const limiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(tokens, window),
    // Namespaced by limiter, so the sign-in and register buckets for one IP
    // never share a key.
    prefix: `devstash:ratelimit:${name}`,
    ephemeralCache,
    // The other half of failing open: a hung Upstash call allows the request
    // after a second rather than holding the sign-in form open indefinitely.
    timeout: 1_000,
    analytics: false,
  });

  limiters.set(name, limiter);
  return limiter;
}

/**
 * The caller's IP address, or `null` when it cannot be established.
 *
 * `x-vercel-forwarded-for` comes first because Vercel sets it itself and a
 * client cannot forge it. `x-forwarded-for` is last and only its leftmost entry
 * is used: behind a proxy that appends rather than replaces, the leftmost value
 * is whatever the client sent, so this order prefers the headers the platform
 * controls and treats the spoofable one as a fallback.
 */
async function getClientIp(): Promise<string | null> {
  let headerList: Awaited<ReturnType<typeof headers>>;

  try {
    headerList = await headers();
  } catch {
    // `headers()` throws outside a request scope. Reaching this means limiting
    // cannot run for that caller, which is the fail-open case again rather than
    // a reason to refuse them.
    return null;
  }

  const vercelForwarded = headerList.get("x-vercel-forwarded-for");

  if (vercelForwarded) {
    return vercelForwarded.split(",")[0]!.trim() || null;
  }

  const realIp = headerList.get("x-real-ip");

  if (realIp) {
    return realIp.trim() || null;
  }

  const forwarded = headerList.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]!.trim() || null;
  }

  return null;
}

/**
 * Builds the refusal result both the consuming and the peeking path return.
 *
 * Shared rather than written twice: the two paths must show a user the same
 * sentence, and duplicating the wording is how they would quietly drift apart.
 */
function refused(reset: number): RateLimitResult {
  const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1_000));

  return {
    success: false,
    remaining: 0,
    reset,
    retryAfterSeconds,
    message: `Too many attempts. Please try again ${describeWait(retryAfterSeconds)}.`,
  };
}

/** Rounds up, because "try again in 0 minutes" helps nobody. */
function describeWait(seconds: number): string {
  if (seconds <= 60) {
    return "in a minute";
  }

  const minutes = Math.ceil(seconds / 60);

  if (minutes < 60) {
    return `in ${minutes} minutes`;
  }

  const hours = Math.ceil(minutes / 60);

  return hours === 1 ? "in an hour" : `in ${hours} hours`;
}

/**
 * Consumes one token from `name`'s window for `identifier`.
 *
 * `identifier` is the IP, optionally joined with the submitted email where the
 * spec asks for a tighter key. Pass `null` to skip limiting entirely — see
 * `limitByIp` for why an unknown IP is not bucketed together.
 */
async function checkRateLimit(
  name: RateLimitName,
  identifier: string | null,
): Promise<RateLimitResult> {
  if (!identifier) {
    return UNLIMITED;
  }

  const limiter = getLimiter(name);

  if (!limiter) {
    return UNLIMITED;
  }

  try {
    const { success, remaining, reset } = await limiter.limit(identifier);

    // A successful result carries no message. A populated "too many attempts"
    // sentence sitting on a result that was let through is a trap: it reads as
    // safe to render, and a caller that forgot to check `success` would show it
    // to someone who was not in fact refused.
    return success
      ? {
          success,
          remaining,
          reset,
          retryAfterSeconds: 0,
          message: "",
        }
      : refused(reset);
  } catch (error) {
    // Fail open. Upstash being down is not a reason to refuse a legitimate
    // sign-in, and this is the branch that decides that.
    console.error(`[rate-limit] ${name} check failed; allowing request`, error);

    return UNLIMITED;
  }
}

/**
 * Limits by IP alone.
 *
 * An unresolvable IP skips limiting rather than falling back to a shared
 * "unknown" bucket. A shared bucket would be a global counter — three
 * registrations per hour for the entire internet — so the failure mode of
 * bucketing is far worse than the failure mode of skipping. On Vercel the
 * forwarded headers are always present, so this only affects local development
 * and misconfigured proxies.
 */
export async function limitByIp(
  name: RateLimitName,
): Promise<RateLimitResult> {
  return checkRateLimit(name, await getClientIp());
}

/**
 * The key an IP-and-email limiter uses, or `null` when there is no IP.
 *
 * The email is lowercased to match the normalization every auth schema already
 * applies, so `A@b.com` and `a@b.com` cannot each get their own quota against
 * the same account.
 */
async function ipAndEmailKey(email: string): Promise<string | null> {
  const ip = await getClientIp();

  return ip ? `${ip}:${email.trim().toLowerCase()}` : null;
}

/** Limits by IP *and* email together. */
export async function limitByIpAndEmail(
  name: RateLimitName,
  email: string,
): Promise<RateLimitResult> {
  return checkRateLimit(name, await ipAndEmailKey(email));
}

/**
 * Reports whether an IP-and-email window is already exhausted, **without**
 * spending a token.
 *
 * This exists so sign-in can be counted in exactly one place. The Server Action
 * peeks to render a precise "try again in N minutes", and `authorize` does the
 * consuming — if both consumed, one form submission would cost two tokens and
 * the advertised limit of five attempts would really be two and a half.
 */
export async function peekIpAndEmailLimit(
  name: RateLimitName,
  email: string,
): Promise<RateLimitResult> {
  const key = await ipAndEmailKey(email);
  const limiter = key ? getLimiter(name) : null;

  if (!limiter || !key) {
    return UNLIMITED;
  }

  try {
    // `getRemaining` runs a script with no `INCRBY`, so this reads the window
    // without spending from it. Its notion of exhausted matches `limit`'s: both
    // compare the current plus time-weighted previous bucket against the limit.
    const { remaining, reset } = await limiter.getRemaining(key);

    return remaining > 0 ? { ...UNLIMITED, remaining } : refused(reset);
  } catch (error) {
    console.error(`[rate-limit] ${name} peek failed; allowing request`, error);

    return UNLIMITED;
  }
}

/**
 * Clears an IP-and-email window.
 *
 * Called after a sign-in actually succeeds, so someone who mistyped their
 * password four times and then got it right is not left one attempt from a
 * lockout. Only failed attempts should count toward a brute-force budget.
 */
export async function resetIpAndEmailLimit(
  name: RateLimitName,
  email: string,
): Promise<void> {
  const key = await ipAndEmailKey(email);
  const limiter = key ? getLimiter(name) : null;

  if (!limiter || !key) {
    return;
  }

  try {
    await limiter.resetUsedTokens(key);
  } catch (error) {
    // Nothing to recover — the window simply expires on its own schedule.
    console.error(`[rate-limit] ${name} reset failed`, error);
  }
}
