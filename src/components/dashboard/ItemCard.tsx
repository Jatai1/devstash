import { Pin, Star } from "lucide-react";

import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ItemSummary } from "@/lib/db/items";
import { formatShortDate } from "@/lib/format";

interface ItemCardProps {
  item: ItemSummary;
  /**
   * Opens the detail drawer for this item. Receives the button that was
   * activated, so the list can put focus back on it when the drawer closes.
   */
  onSelect: (trigger: HTMLElement) => void;
}

/**
 * One row in the pinned / recent item lists: type icon, title with its pin and
 * favorite markers, description, tags, and the last-updated date.
 *
 * The whole card is the click target, but only the title is a real `<button>`,
 * stretched over the card by `after:inset-0`. Wrapping the card in a button
 * instead would put the `<h3>` and `<time>` inside phrasing-only content, and a
 * `role="button"` div would mean hand-rolling Enter and Space. This way the
 * accessible name is the item's title and keyboard support is the browser's.
 */
export function ItemCard({ item, onSelect }: ItemCardProps) {
  const { type } = item;

  return (
    <Card
      size="sm"
      className="relative cursor-pointer border-l-4 transition-colors hover:bg-muted/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
      style={{ borderLeftColor: type.color }}
    >
      <CardContent className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          // 1a === 10% alpha, so the tile picks up a wash of the type color.
          style={{
            backgroundColor: `${type.color}1a`,
            color: type.color,
          }}
        >
          <TypeIcon
            name={type.icon}
            className="size-4"
            aria-label={type.label}
          />
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 truncate font-medium">
              <button
                type="button"
                onClick={(event) => onSelect(event.currentTarget)}
                // Stretches the hit area over the whole card. The ring is on
                // the card via `has-[:focus-visible]`, so the outline here
                // would only trace the title.
                className="block w-full truncate text-left after:absolute after:inset-0 focus-visible:outline-none"
              >
                {item.title}
              </button>
            </h3>
            {item.isPinned && (
              <Pin
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-label="Pinned"
              />
            )}
            {item.isFavorite && (
              <Star
                className="size-3.5 shrink-0 fill-amber-400 text-amber-400"
                aria-label="Favorite"
              />
            )}
            <time
              dateTime={item.updatedAt.toISOString()}
              className="ml-auto shrink-0 text-xs text-muted-foreground"
            >
              {formatShortDate(item.updatedAt)}
            </time>
          </div>

          {item.description && (
            <p className="text-muted-foreground">{item.description}</p>
          )}

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
