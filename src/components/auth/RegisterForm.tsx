"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema } from "@/lib/auth-schemas";

/** The fields the form renders, in the order they appear. */
const FIELDS = ["name", "email", "password", "confirmPassword"] as const;

type FieldName = (typeof FIELDS)[number];

type FieldErrors = Partial<Record<FieldName, string[]>>;

/** The error shape `POST /api/auth/register` returns on a 400 or 409. */
interface RegisterErrorBody {
  error?: string;
  fieldErrors?: FieldErrors;
}

const LABELS: Record<FieldName, string> = {
  name: "Name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
};

const INPUT_TYPES: Record<FieldName, string> = {
  name: "text",
  email: "email",
  password: "password",
  confirmPassword: "password",
};

const AUTOCOMPLETE: Record<FieldName, string> = {
  name: "name",
  email: "email",
  password: "new-password",
  confirmPassword: "new-password",
};

export function RegisterForm() {
  const router = useRouter();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const values = Object.fromEntries(new FormData(event.currentTarget));

    // The same schema the route validates with, so the inline messages match
    // what the server would have said and a valid form is never rejected
    // server-side for a reason the client could have caught.
    const parsed = registerSchema.safeParse(values);

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.ok) {
        // `replace` rather than `push`: a completed registration should not be
        // reachable with the back button.
        router.replace("/sign-in?registered=1");
        return;
      }

      const body: RegisterErrorBody = await response.json().catch(() => ({}));

      // A 400 carries per-field messages; a 409 (email taken) carries only the
      // one sentence, so it belongs above the form.
      setFieldErrors(body.fieldErrors ?? {});
      setFormError(
        body.fieldErrors ? null : (body.error ?? "Could not create your account."),
      );
    } catch {
      setFormError("Could not reach the server. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      ) : null}

      {FIELDS.map((field) => {
        const errors = fieldErrors[field];

        return (
          <div key={field} className="grid gap-2">
            <Label htmlFor={field}>{LABELS[field]}</Label>
            <Input
              id={field}
              name={field}
              type={INPUT_TYPES[field]}
              autoComplete={AUTOCOMPLETE[field]}
              aria-invalid={errors ? true : undefined}
              aria-describedby={errors ? `${field}-error` : undefined}
            />
            {errors ? (
              <p id={`${field}-error`} className="text-sm text-destructive">
                {errors[0]}
              </p>
            ) : null}
          </div>
        );
      })}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
