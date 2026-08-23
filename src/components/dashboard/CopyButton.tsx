"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** How long the button stays in its confirmed state. */
const COPIED_FEEDBACK_MS = 2000;

interface CopyButtonProps {
  /** What goes on the clipboard, or `null` when there is nothing to copy. */
  text: string | null;
  /**
   * Drops the visible label, leaving the icon. The editor header is tight and
   * already says what the block is, so the word would only be noise there; the
   * accessible name is kept either way.
   */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Copies text to the clipboard, then confirms for two seconds.
 *
 * Lifted out of `ItemActionBar` when the code editor grew a copy button of its
 * own. Both are the *same* affordance on the same payload — an item open in the
 * drawer has one in the action bar and one in the editor header — so sharing
 * the component is what stops the two drifting into different confirmation
 * timings or different failure behaviour.
 *
 * Disabled when there is nothing to copy: a note with an empty body, or a file
 * item, whose payload is a blob rather than text.
 */
export function CopyButton({ text, iconOnly, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  // Without the cleanup, copying and then closing the drawer would leave a
  // timer to set state on an unmounted component.
  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // `navigator.clipboard` needs a secure context and can be refused by
      // permissions policy. Nothing was copied, so say nothing rather than
      // claim success.
      setCopied(false);
    }
  }

  const label = copied ? "Copied" : "Copy";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      disabled={!text}
      className={className}
    >
      {copied ? (
        <Check className="size-4 text-emerald-500" />
      ) : (
        <Copy className="size-4" />
      )}

      {/* Icon-only still renders the word, just not visibly: it is what names
          the control, and the `aria-live` is what makes the swap to "Copied"
          reach a screen reader at all — the icon change alone would be silent.
          Polite rather than assertive, since it confirms something the user
          just did and should not interrupt them. */}
      <span className={cn(iconOnly && "sr-only")} aria-live="polite">
        {label}
      </span>
    </Button>
  );
}
