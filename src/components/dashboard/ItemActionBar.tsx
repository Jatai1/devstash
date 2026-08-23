"use client";

import { Pencil, Pin, Star } from "lucide-react";

import { CopyButton } from "@/components/dashboard/CopyButton";
import { DeleteItemDialog } from "@/components/dashboard/DeleteItemDialog";
import { Button } from "@/components/ui/button";
import type { SerializedItemDetail } from "@/lib/db/items";
import { cn } from "@/lib/utils";

interface ItemActionBarProps {
  item: SerializedItemDetail;
  /** Switches the drawer into edit mode, replacing this bar. */
  onEdit: () => void;
  /** Fired once the item has actually been deleted. */
  onDeleted: () => void;
}

/**
 * The drawer's action row: Favorite, Pin and Copy on the left, Edit and Delete
 * pushed to the right.
 *
 * **Copy, Edit and Delete work; Favorite and Pin do not.** The two inert ones
 * render the item's real state — a filled amber star when it is a favorite —
 * but cannot change it: each needs a mutation `src/actions/items.ts` does not
 * have yet. They stay `disabled` rather than hidden so the bar matches its
 * design and so the unimplemented state is obvious rather than silent.
 */
export function ItemActionBar({ item, onEdit, onDeleted }: ItemActionBarProps) {
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
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-4" />
          Edit
        </Button>

        <DeleteItemDialog
          itemId={item.id}
          itemTitle={item.title}
          onDeleted={onDeleted}
        />
      </div>
    </div>
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
