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
import type { CollectionSummary } from "@/lib/db/collections";

interface CollectionCardProps {
  collection: CollectionSummary;
}

/**
 * One collection tile: the left border takes the color of the collection's
 * dominant type, and the footer row shows an icon per type it holds.
 */
export function CollectionCard({ collection }: CollectionCardProps) {
  const { itemCount } = collection;

  return (
    <Card
      className="border-l-4 transition-colors hover:bg-muted/40"
      style={{ borderLeftColor: collection.dominantType?.color }}
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
        <CardDescription>
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {collection.description && (
          <p className="text-sm text-muted-foreground">
            {collection.description}
          </p>
        )}

        <div className="flex items-center gap-2">
          {collection.types.map((type) => (
            <TypeIcon
              key={type.id}
              name={type.icon}
              className="size-4"
              style={{ color: type.color }}
              aria-label={type.label}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
