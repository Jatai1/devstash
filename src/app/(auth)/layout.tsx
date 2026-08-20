import Link from "next/link";

/**
 * Shared frame for the signed-out pages. The route group keeps `/sign-in` and
 * `/register` at the top level of the URL while letting them share this shell.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Devstash
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
