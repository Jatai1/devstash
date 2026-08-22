"use client";

import { Check, Copy, Pencil, Pin, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SerializedItemDetail } from "@/lib/db/items";
import { cn } from "@/lib/utils";

/** How long the Copy button stays in its confirmed state. */
const COPIED_FEEDBACK_MS = 2000;

interface ItemActionBarProps {
  item: SerializedItemDetail;
}

/**
 * The drawer's action row: Favorite, Pin and Copy on the left, Edit and Delete
 * pushed to the right.
 *
 * **Only Copy does anything.** Favorite and Pin render the item's real state —
 * a filled amber star when it is a favorite — but do not toggle it, and Edit
 * and Delete are inert. Every one of those needs `src/actions/items.ts`, which
 * belongs to the item CRUD feature; this one is the detail view. They are
 * `disabled` rather than hidden so the bar matches its design and so the
 * unimplemented state is obvious rather than silent.
 */
export function ItemActionBar({ item }: ItemActionBarProps) {
  const copyable = getCopyableText(item);

  return (
    <div className="flex items-center gap-1 border-b px-4 pb-3">
      <Button variant="ghost" size="sm" disabled>
        <Star
          className={cn(
            "size-4",
            item.isFavorite && "fill-amber-400 text-amber-400",
          )}
        />
        Favorite
      </Button>

      <Button variant="ghost" size="sm" disabled>
        <Pin className={cn("size-4", item.isPinned && "fill-current")} />
        Pin
      </Button>

      <CopyButton text={copyable} />

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled>
          <Pencil className="size-4" />
          Edit
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          disabled
          aria-label="Delete item"
          className="text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Copies the item's payload to the clipboard, then confirms for two seconds.
 *
 * Disabled when there is nothing to copy — a note with an empty body, or a file
 * item, whose payload is a blob rather than text.
 */
function CopyButton({ text }: { text: string | null }) {
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

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!text}>
      {copied ? (
        <Check className="size-4 text-emerald-500" />
      ) : (
        <Copy className="size-4" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * What Copy puts on the clipboard, chosen by `contentType` rather than by the
 * type's name so a custom type flows through unchanged.
 */
function getCopyableText(item: SerializedItemDetail): string | null {
  switch (item.contentType) {
    case "TEXT":
      return item.content?.trim() ? item.content : null;
    case "URL":
      return item.url?.trim() ? item.url : null;
    case "FILE":
      // A file's payload is the blob itself, which the clipboard text API
      // cannot carry. Nothing uploads yet either.
      return null;
  }
}
