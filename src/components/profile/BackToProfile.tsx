import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * The way back up from a profile sub-page.
 *
 * The profile page's own "Back to dashboard" link was dropped as redundant with
 * the sidebar, but `/profile/change-password` and `/profile/delete-account` are
 * leaves the sidebar has no entry for, so returning from them needs a link.
 */
export function BackToProfile() {
  return (
    <Link
      href="/profile"
      className="flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to profile
    </Link>
  );
}
