"use client";

import { useRef, useState } from "react";

import { ItemCard } from "@/components/dashboard/ItemCard";
import { ItemDrawer } from "@/components/dashboard/ItemDrawer";
import type { ItemSummary } from "@/lib/db/items";

interface ItemListProps {
  items: ItemSummary[];
  /**
   * Layout for the list itself. The dashboard stacks its rows, `/items/[slug]`
   * lays them out in a grid, and neither concern belongs in here.
   */
  className?: string;
}

/**
 * A list of item cards and the one drawer they share.
 *
 * This exists because every page rendering items is a server component and the
 * drawer needs open/closed state. It is the smallest client boundary that does
 * the job: the pages keep querying and the cards keep rendering as before, and
 * nothing in the shared `(app)` shell had to change.
 *
 * Each list owns its own drawer, so the dashboard mounts two — one for Pinned
 * and one for Recent. Only one can be open at a time and a closed sheet renders
 * nothing, so the alternative, a single provider in the layout, would buy
 * nothing for the extra reach.
 */
export function ItemList({ items, className }: ItemListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <div className={className}>
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onSelect={(trigger) => {
              triggerRef.current = trigger;
              setSelectedId(item.id);
              setIsOpen(true);
            }}
          />
        ))}
      </div>

      {/*
        `selectedId` deliberately survives the close, so the sheet still has
        something to render while it animates out. Clearing it here would empty
        the drawer a frame before it left the screen.
      */}
      <ItemDrawer
        itemId={selectedId}
        open={isOpen}
        onOpenChange={setIsOpen}
        // Radix restores focus to whatever held it when the sheet opened, and
        // that is the document body: the card's button is not a `SheetTrigger`,
        // because the sheet is opened from state rather than by the primitive.
        // Left alone, closing drops a keyboard user at the top of the page, so
        // the card that opened the drawer takes focus back.
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef.current;

          if (!trigger?.isConnected) {
            return;
          }

          event.preventDefault();
          trigger.focus();
        }}
      />
    </>
  );
}
