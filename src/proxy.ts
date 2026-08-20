import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/auth.config";

// Initialized from the edge-safe config only — see `auth.config.ts`. This is a
// second NextAuth instance from the one in `auth.ts`, which is the point: it
// can read the session cookie without loading Prisma.
const { auth } = NextAuth(authConfig);

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`, and the
 * export has to be named `proxy` to match.
 */
export const proxy = auth((req) => {
  if (req.auth) {
    return;
  }

  // No custom sign-in page yet, so this is Auth.js's built-in one.
  const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);

  // Send the user back where they were headed once they are signed in.
  signInUrl.searchParams.set(
    "callbackUrl",
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
  );

  return NextResponse.redirect(signInUrl);
});

export const config = {
  // Scoped to the dashboard, so `/api/auth/*` and the public landing page never
  // run through this and cannot redirect-loop.
  matcher: ["/dashboard/:path*"],
};
