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

  // The custom page from `auth.config.ts`, read from the config rather than
  // repeated here so the two cannot drift apart.
  const signInUrl = new URL(
    authConfig.pages.signIn,
    req.nextUrl.origin,
  );

  // Send the user back where they were headed once they are signed in.
  signInUrl.searchParams.set(
    "callbackUrl",
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
  );

  return NextResponse.redirect(signInUrl);
});

export const config = {
  // Scoped to the signed-in routes, so `/api/auth/*`, `/sign-in`, `/register`
  // and the public landing page never run through this and cannot
  // redirect-loop.
  matcher: ["/dashboard/:path*", "/items/:path*", "/profile/:path*"],
};
