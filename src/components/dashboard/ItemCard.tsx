import { Pin, Star } from "lucide-react";

import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatShortDate } from "@/lib/format";
import { getItemType, type Item } from "@/lib/mock-data";

interface ItemCardProps {
  item: Item;
}

/**
 * One row in the pinned / recent item lists: type icon, title with its pin and
 * favorite markers, description, tags, and the last-updated date.
 */
export function ItemCard({ item }: ItemCardProps) {
  const type = getItemType(item.typeId);

  return (
    <Card
      size="sm"
      className="border-l-4 transition-colors hover:bg-muted/40"
      style={{ borderLeftColor: type?.color }}
    >
      <CardContent className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          // 1a === 10% alpha, so the tile picks up a wash of the type color.
          style={{
            backgroundColor: type && `${type.color}1a`,
            color: type?.color,
          }}
        >
          <TypeIcon
            name={type?.icon ?? "File"}
            className="size-4"
            aria-label={type?.name}
          />
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{item.title}</h3>
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
              dateTime={item.updatedAt}
              className="ml-auto shrink-0 text-xs text-muted-foreground"
            >
              {formatShortDate(item.updatedAt)}
            </time>
          </div>

          <p className="text-muted-foreground">{item.description}</p>

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
