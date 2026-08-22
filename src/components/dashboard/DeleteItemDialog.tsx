"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteItem, type DeleteItemState } from "@/actions/items";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteItemDialogProps {
  itemId: string;
  /** Named in the confirmation so it is obvious which card is about to go. */
  itemTitle: string;
  /** Fired once the row is actually gone — see `ItemDrawer` and `ItemList`. */
  onDeleted: () => void;
}

/**
 * The drawer's Delete button and the confirmation standing between it and the
 * row.
 *
 * Delete is a destructive icon button on a bar full of harmless ones, so it
 * asks first. The dialog nests inside the drawer's `Sheet` rather than
 * replacing its body the way edit mode does: the item stays visible behind the
 * overlay, and Cancel puts the user back exactly where they were instead of
 * re-entering a view they never left.
 *
 * The confirm button is a plain `Button`, **not** `AlertDialogAction`. That one
 * closes the dialog on click, which would unmount this component mid-request
 * and take any error with it — the same trap `DeleteAccountForm` documented
 * when it was still a dialog.
 */
export function DeleteItemDialog({
  itemId,
  itemTitle,
  onDeleted,
}: DeleteItemDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<DeleteItemState>({});
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteItem(itemId);

      setState(result);

      if (result.error) {
        toast.error(result.error);

        return;
      }

      // Close this dialog first: the drawer behind it is about to close too,
      // and a nested dialog left open while its parent unmounts leaves Radix
      // restoring focus into a tree that is no longer there.
      setIsOpen(false);
      toast.success(result.message ?? "Item deleted.");
      onDeleted();
    });
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(next) => {
        // A dismissed dialog must not reopen still showing why the last
        // attempt failed.
        if (!next) {
          setState({});
        }

        setIsOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete item"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2 />
          </AlertDialogMedia>

          <AlertDialogTitle>Delete this item?</AlertDialogTitle>

          <AlertDialogDescription>
            <span className="font-medium text-foreground">{itemTitle}</span>{" "}
            will be permanently deleted, along with its place in any
            collections. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}

        <AlertDialogFooter>
          {/* Cancel leads, the destructive choice follows — the ordering
              `ChangePasswordForm` documents for every destructive form here. */}
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>

          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete item"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
