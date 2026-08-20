import { z } from "zod";

/**
 * bcrypt only hashes the first 72 bytes of a password and silently ignores the
 * rest, so anything longer would compare equal to its own truncation.
 *
 * The limit is in bytes, not characters, which is why this is a `refine` over
 * the encoded length rather than `.max()`: 72 emoji are 288 bytes and would be
 * cut down to 18 characters' worth of entropy without a word of warning.
 */
const PASSWORD_MAX_BYTES = 72;

const encoder = new TextEncoder();

function isWithinBcryptLimit(password: string) {
  return encoder.encode(password).length <= PASSWORD_MAX_BYTES;
}

/**
 * What the Credentials provider's `authorize` callback accepts.
 *
 * Deliberately looser than `registerSchema`: sign-in only has to recognize a
 * password that was already accepted at registration, and applying today's
 * rules to an existing account would lock out anyone who signed up under
 * older ones.
 */
export const signInSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

/** What the "send me another link" form accepts. */
export const resendVerificationSchema = z.object({
  email: z.email().toLowerCase(),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.email("Enter a valid email address").toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .refine(
        isWithinBcryptLimit,
        `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
      ),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
