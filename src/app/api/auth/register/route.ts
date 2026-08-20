import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { registerSchema } from "@/lib/auth-schemas";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/verification-tokens";

// Matches the cost factor `prisma/seed.ts` uses, so the seeded demo account and
// a freshly registered one are hashed the same way.
const BCRYPT_ROUNDS = 12;

/**
 * Creates an account from an email and password.
 *
 * A static segment beats the `[...nextauth]` catch-all next to it, so this
 * route owns `/api/auth/register` while Auth.js keeps the rest of
 * `/api/auth/*`. Registration is a route handler rather than a Server Action
 * because it is a public endpoint that later clients (and the phase 3 form)
 * post to directly.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid registration details.",
        // Field-keyed messages, which the phase 3 form can render inline.
        // `z.flattenError` is the Zod 4 spelling; `error.flatten()` is the
        // deprecated Zod 3 method.
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
      },
      { status: 400 },
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  try {
    const user = await prisma.user.create({
      data: { name, email, password: await hash(password, BCRYPT_ROUNDS) },
      select: { id: true, name: true, email: true },
    });

    // The account exists but cannot sign in until this link is clicked, so a
    // failed send leaves a real dead end. Report it as a 502 with the account
    // still in place: the address is now taken, so retrying registration would
    // only 409, and the way out is to request a fresh link.
    try {
      const token = await createVerificationToken(email);

      await sendVerificationEmail({ to: email, name, token });
    } catch (sendError) {
      console.error("Verification email failed to send", sendError);

      return NextResponse.json(
        {
          error:
            "Your account was created, but the verification email could not be sent. Request a new link to finish signing up.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    // Two requests for the same address can both pass the check above and race
    // to the insert; the unique index on `email` is what actually decides it.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }

    throw error;
  }
}
