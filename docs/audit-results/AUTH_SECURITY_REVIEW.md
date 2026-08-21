# Auth Security Review

**Last audited:** 2026-08-21
**Scope:** NextAuth v5 credentials + GitHub, email verification, password reset, profile account actions
**Auditor:** auth-auditor

Two findings survived review: the project-wide absence of rate limiting (High — already
known and tracked, restated here as required) and a narrow token-issuance race that lets
two reset/verification tokens for the same address be valid at once (Low). Everything else
checked — password hashing, token entropy/storage/expiry, single-use enforcement, namespace
separation, user enumeration resistance, server-side re-authorization, and
re-authentication on destructive actions — held up under direct reading of the code and,
where the claim depended on library behavior, against Auth.js/bcrypt documentation.

## High

### No rate limiting on any credential-facing endpoint
`src/actions/auth.ts:50`, `src/app/api/auth/register/route.ts:21`, `src/actions/auth.ts:138`, `src/actions/password-reset.ts:47`

**Problem** — `signInWithCredentials`, `POST /api/auth/register`, `resendVerificationEmail`
and `requestPasswordReset` accept unlimited requests from any client. Nothing in the
codebase (no middleware, no per-IP or per-account counter) throttles them.

**Attack** — An attacker scripts repeated `POST`s to `signInWithCredentials` for a known
email, working through a password list at whatever rate the server tolerates (credential
stuffing/brute force). Separately, `resendVerificationEmail` and `requestPasswordReset` are
unmetered mail triggers: a script can walk a list of addresses and cause Resend to send
mail on each one, which is both a spam vector and a way to make the app's Resend account
hit provider-side sending limits.

**Fix** — This is already tracked in `context/current-feature.md` as a deliberately
deferred, project-wide gap and is restated here as the one finding it belongs to, not filed
per-endpoint. When it is picked up, a per-IP and per-account limiter (e.g. Upstash
Ratelimit, or Vercel's own rate limiting/firewall) in front of these four routes is the
standard fix; sign-in should also consider a short account-level lockout after repeated
failures.

## Low

### Concurrent token requests can leave two live tokens for one address
`src/lib/tokens.ts:101-121`

**Problem** — `createScopedToken` supersedes an old token by running `deleteMany` then
`create` inside one `$transaction`, which is atomic *within* a single call. Two concurrent
calls for the same identifier (e.g. two overlapping "email me a reset link" submissions)
are two independent transactions: under Postgres's default READ COMMITTED isolation, both
`deleteMany`s can each find nothing left to delete and both `create`s succeed, leaving two
valid token rows under the same `identifier` instead of one superseding the other.

**Attack** — This does not grant access beyond what a single request already would — both
tokens are still 32 random bytes emailed only to the real address, so redeeming either
still requires holding the link. The narrowed guarantee is "requesting a new link
invalidates the old one": if an earlier link had already leaked (forwarded email, browser
history, a proxy log) and the user assumes issuing a fresh request invalidates it, a
precisely timed second request can leave the old, potentially-exposed link live alongside
the new one.

**Fix** — Wrap the delete-then-create in an interactive `prisma.$transaction(async (tx) => …)`
with `Serializable` isolation, or add a real uniqueness constraint on `identifier` (a
migration) and use `upsert` instead of delete+create so the database — not application-level
sequencing — decides the race.

## Passed Checks

- **Password hashing is uniform** — `src/lib/password.ts:11-16`, `src/app/api/auth/register/route.ts:69`, `src/actions/password-reset.ts:79`, `src/actions/profile.ts:116` — every write to `User.password` goes through the shared `hashPassword` at `BCRYPT_ROUNDS = 12`; no local constant or alternate algorithm anywhere in the auth paths.
- **Password comparison is constant-time** — `src/lib/password.ts:24-29`, used in `src/auth.ts:67` and `src/actions/profile.ts:105` — both go through `bcrypt.compare`, never a re-hash-and-`===`.
- **Bcrypt's 72-byte limit is enforced in bytes, not characters** — `src/lib/auth-schemas.ts:11-17` — `isWithinBcryptLimit` measures `TextEncoder`-encoded length and is used by the single `newPassword()` schema shared by registration, reset and profile change, so no path can install a password bcrypt would silently truncate. Confirmed against current bcrypt documentation that truncation is byte-based, not character-based.
- **No password hash reaches a client boundary** — every `prisma.user.find*` in the auth paths was checked: `src/auth.ts:49-59` selects `password` only to compare it and returns an object without it; `src/actions/auth.ts:160-163` and `src/actions/profile.ts:84-87` select it only for a boolean/verify check; `src/lib/db/user.ts:90-118` (`getProfile`) explicitly destructures `password` out before returning, exposing only a `hasPassword` boolean to the page.
- **Token entropy** — `src/lib/tokens.ts:6, 106` — 32 bytes from `node:crypto` `randomBytes`, base64url-encoded; no `Math.random`, timestamp, counter, cuid or email hash anywhere in the token path.
- **Token storage** — `src/lib/tokens.ts:45-47` — the raw token goes in the link, only its SHA-256 digest is stored in `VerificationToken.token`. Unsalted hashing here is correct, not a gap: the input is already 32 random bytes, so there is nothing for a salt to protect.
- **Token expiry is set at creation and enforced at redemption** — `src/lib/tokens.ts:115, 161-163, 212-214` — `expires` is written on issue and both `peekScopedToken` and `claimScopedToken` compare it against `new Date()` at read time.
- **Reset TTL is materially shorter than verification TTL** — `src/lib/password-reset-tokens.ts:18` (1 hour) vs. `src/lib/verification-tokens.ts:11` (24 hours) — a 24x margin, with the reasoning (this token changes a credential, not just confirms an address) stated in both files.
- **Single-use enforcement, and the race is decided correctly** — `src/lib/tokens.ts:182-217` — `claimScopedToken` deletes by the token's own hash and checks the `deleteMany` count, so of two concurrent claims on the *same* token only one succeeds; the row is deleted whether or not it had expired, so a used or expired link cannot be retried.
- **Single-use enforcement is at submit, not at render** — `src/app/(auth)/reset-password/page.tsx:50` calls the non-mutating `checkPasswordResetToken`/`peekScopedToken`; `src/actions/password-reset.ts:140` independently calls `resetPasswordWithToken`, which re-checks and spends the token via `claimScopedToken`. The page's earlier check is never trusted by the action.
- **Namespace separation between the two token flows** — `src/lib/tokens.ts:50-76` (`scope`/`unscope`) plus `RESET_NAMESPACE = "password-reset"` in `src/lib/password-reset-tokens.ts:24` and `VERIFICATION_NAMESPACE = null` in `src/lib/verification-tokens.ts:21` — a token presented to the wrong flow fails `unscope` and is rejected *without* being deleted (`src/lib/tokens.ts:198-202`), so hitting the wrong endpoint cannot burn the other flow's live link.
- **Bcrypt ordering on password reset avoids a cheap DoS** — `src/actions/password-reset-tokens.ts` (`resetPasswordWithToken`, `src/lib/password-reset-tokens.ts:69-116`) — a non-mutating precheck runs before the 12-round `hashPassword` call, so an unauthenticated caller posting a garbage token cannot force a bcrypt run; the token is claimed only after the hash is ready, keeping the spend-then-write window to one transaction.
- **Reset writes are transactional** — `src/lib/password-reset-tokens.ts:98-107` — the password update and the conditional `emailVerified` stamp are one `$transaction`, so a mid-write failure cannot land a new password without its accompanying state.
- **User enumeration resistance** — `src/actions/auth.ts:50-66` (sign-in), `src/actions/auth.ts:138-187` (resend) and `src/actions/password-reset.ts:47-84` (forgot-password) each return one fixed message regardless of whether the address exists, is verified, or the send failed/succeeded. The register route's `409` on a duplicate email is the one documented, accepted exception (`src/app/api/auth/register/route.ts:55-60`) — Low by design, not escalated.
- **The verified-address gate is checked after the password, not before** — `src/auth.ts:67-80` — `verifyPassword` runs first; the `EmailNotVerifiedError` throw only happens once the password is already confirmed correct, so the response cannot be used to probe which addresses exist.
- **Every Server Action re-derives the user from `auth()`** — `src/actions/profile.ts:22-26` (`currentUserId`), called at the top of both `changePassword` (`:68`) and `deleteAccount` (`:140`) — neither trusts an id, email, or any identity from `formData`.
- **Prisma writes in the profile actions are scoped by the session-derived id** — `src/actions/profile.ts:114-117` (`where: { id: userId }`) and `:204-234` (`purgeUser`, every clause keyed on the session's `userId`) — confirmed no client-supplied identifier reaches a `where` clause anywhere in `src/actions/profile.ts`.
- **Re-authentication on destructive actions** — password change requires and verifies `currentPassword` server-side (`src/actions/profile.ts:105-112`); account deletion requires the typed email, compared case-insensitively, server-side (`src/actions/profile.ts:155-165`) — both independent of the client-rendered form.
- **A hidden control is backed by a real server-side check** — the change-password button is hidden for a GitHub-only account in `src/app/(app)/profile/page.tsx:78-82`, the page itself redirects such an account away in `src/app/(app)/profile/change-password/page.tsx:24-29`, and `changePassword` refuses independently at `src/actions/profile.ts:98-103` — three layers, none of which is "the button is hidden."
- **No mass assignment** — every `prisma.user.update`/`create` in the auth paths (`src/app/api/auth/register/route.ts:65-78`, `src/actions/profile.ts:114-117`, `src/lib/password-reset-tokens.ts:99-106`, `src/lib/verification-tokens.ts:62-65`, `src/auth.ts:125-128`) sets an explicit, small `data` object; none spreads parsed input, and none of `emailVerified`, `isPro`, `stripeCustomerId` is settable from a form.
- **The JWT outliving its row is handled in the Server Actions** — `src/actions/profile.ts:22-26, 70-72, 142-153` — both `changePassword` and `deleteAccount` look up the row by the session's id and return the same `NO_SESSION` message on a `null`, rather than assuming the row exists. (The read paths in `src/lib/db/user.ts:41-65, 90-118` throw instead of null-checking on the same condition — this is documented in the file's own comments and in `context/current-feature.md`'s history as a deliberate choice, not something missed, so it is not filed as a new finding here.)
- **`AUTH_SECRET` and the GitHub OAuth credentials are read from the environment only** — `src/auth.config.ts:13-14` documents `GitHub` reading `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` itself; a repo-wide search found no `AUTH_SECRET` reference inside `src/` at all (Auth.js reads it directly), and no `NEXT_PUBLIC_` variable anywhere carries a secret — the one `NEXT_PUBLIC_` hit in `src/` is a comment in `src/lib/email-verification.ts:8` explaining why that flag deliberately avoids the prefix.
- **No secret is committed** — `git ls-files` confirms only `.env.example` is tracked; `.env`, `.env.local` and `.env.production` all match the `.env*` ignore rule and were never inspected for contents beyond what `context/current-feature.md` already documents.
- **`emailVerified` stamped correctly for OAuth** — `src/auth.ts:113-130` — the `linkAccount` event stamps it, which matches confirmed Auth.js/Prisma-adapter behavior: the Prisma adapter only stamps `emailVerified` for the Email (magic-link) provider, not for OAuth account linking, so without this event the column would have kept lying about a GitHub-verified address.

## Not Verified

- **The token-issuance race** (Low finding above) is reasoned from reading `src/lib/tokens.ts` and Postgres's documented READ COMMITTED default, not from an actual concurrent-request test — this tool has no Bash/database access to reproduce it. A human should fire two parallel `requestPasswordReset` calls for the same address and check whether `VerificationToken` ends up with one row or two.
- **Whether any platform-level protection exists outside the repository** — Vercel's firewall/rate limiting, a WAF rule, or similar — that would mitigate the "no rate limiting" finding in production. This audit only covers the application code; if such a layer is configured in the Vercel dashboard it was not visible here.
- **Whether the Vercel Production/Preview environment variables hold stale or rotated credentials.** `context/current-feature.md`'s history flags this as never checked; this tool cannot query Vercel.
- **Runtime confirmation of every "Passed Checks" item.** These are read from the code and cross-checked against library documentation where the claim was library-dependent, not exercised against a running server or database — this tool has no `npx tsc --noEmit`, `npm run lint`, `npm run build`, or database access. A human should still run those before trusting this as a final sign-off.
