import Link from "next/link";
import { Star } from "lucide-react";

import { TypeIcon } from "@/components/dashboard/TypeIcon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getItemType, type Collection } from "@/lib/mock-data";

interface CollectionCardProps {
  collection: Collection;
}

/**
 * One collection tile: the left border takes the color of the collection's
 * dominant type, and the footer row shows an icon per type it holds.
 */
export function CollectionCard({ collection }: CollectionCardProps) {
  const dominantType = getItemType(collection.dominantTypeId);

  return (
    <Card
      className="border-l-4 transition-colors hover:bg-muted/40"
      style={{ borderLeftColor: dominantType?.color }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link
            href={`/collections/${collection.id}`}
            className="truncate hover:underline"
          >
            {collection.name}
          </Link>
          {collection.isFavorite && (
            <Star
              className="size-4 shrink-0 fill-amber-400 text-amber-400"
              aria-label="Favorite"
            />
          )}
        </CardTitle>
        <CardDescription>{collection.itemCount} items</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{collection.description}</p>

        <div className="flex items-center gap-2">
          {collection.typeIds.map((typeId) => {
            const type = getItemType(typeId);

            if (!type) {
              return null;
            }

            return (
              <TypeIcon
                key={typeId}
                name={type.icon}
                className="size-4"
                style={{ color: type.color }}
                aria-label={type.name}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
