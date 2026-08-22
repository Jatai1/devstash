"use client";

import { CalendarDays, FolderOpen, Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { ItemActionBar } from "@/components/dashboard/ItemActionBar";
import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { SerializedItemDetail } from "@/lib/db/items";
import { formatLongDate } from "@/lib/format";

/** The outcome of one detail fetch. */
type FetchResult =
  | { status: "ready"; item: SerializedItemDetail }
  | { status: "error"; message: string };

interface ItemDrawerProps {
  /** The item to show, or `null` before anything has been opened. */
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close — see the call site in `ItemList`. */
  onCloseAutoFocus?: (event: Event) => void;
}

/**
 * The item detail view: a right-side sheet holding one item in full.
 *
 * Card data is already on the page, but the body, language and collections are
 * not, so those are fetched on open from `GET /api/items/[id]`.
 *
 * The result is stored **with the id it belongs to** rather than as a bare
 * loading flag. That keeps every `setState` here asynchronous — the React
 * Compiler lint rules this project runs reject setting state in an effect body
 * — and it means a slow response for a previously opened item can never be
 * painted under a newly opened one.
 *
 * A side effect of keying by id is that reopening the *same* item reuses the
 * response instead of refetching, which is what makes a second open instant.
 * Nothing can edit an item yet, so it cannot go stale today — but the feature
 * that adds Favorite, Pin, Edit and Delete has to clear this, or the drawer
 * will keep showing the values from before the edit.
 */
export function ItemDrawer({
  itemId,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: ItemDrawerProps) {
  const [fetched, setFetched] = useState<{
    id: string;
    result: FetchResult;
  } | null>(null);

  useEffect(() => {
    if (!itemId) {
      return;
    }

    const controller = new AbortController();

    async function load(id: string) {
      try {
        const response = await fetch(`/api/items/${id}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          setFetched({
            id,
            result: { status: "error", message: describeError(response.status) },
          });

          return;
        }

        const item: SerializedItemDetail = await response.json();

        setFetched({ id, result: { status: "ready", item } });
      } catch {
        // An abort is this effect being cleaned up, not a failure — the state
        // it would set belongs to an item the user already navigated away from.
        if (controller.signal.aborted) {
          return;
        }

        setFetched({
          id,
          result: {
            status: "error",
            message: "Could not load this item. Check your connection.",
          },
        });
      }
    }

    void load(itemId);

    return () => controller.abort();
  }, [itemId]);

  // A result for a different item is as good as no result: it belongs to the
  // card the user opened before this one.
  const result = fetched?.id === itemId ? fetched.result : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        // The base component is `sm:max-w-sm`, which is too narrow for a code
        // body. Matching its `data-[side=right]:` prefix is what lets
        // `tailwind-merge` drop the original rather than leave both.
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        onCloseAutoFocus={onCloseAutoFocus}
        // Opting out of Radix's description warning: the item's own
        // description is a body section here, not the sheet's accessible
        // description, and it is often null.
        aria-describedby={undefined}
      >
        {result === null && <DrawerSkeleton />}

        {result?.status === "error" && (
          <>
            <SheetTitle className="sr-only">Item unavailable</SheetTitle>
            <SheetDescription className="p-6">
              {result.message}
            </SheetDescription>
          </>
        )}

        {result?.status === "ready" && <DrawerBody item={result.item} />}
      </SheetContent>
    </Sheet>
  );
}

/** The loaded item, in the order the design lays it out. */
function DrawerBody({ item }: { item: SerializedItemDetail }) {
  const { type } = item;

  return (
    <>
      <div className="space-y-3 p-4 pr-14">
        <div className="flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            // 1a === 10% alpha, the same wash the item card uses.
            style={{ backgroundColor: `${type.color}1a`, color: type.color }}
          >
            <TypeIcon name={type.icon} className="size-5" aria-hidden />
          </span>

          <div className="min-w-0 flex-1 space-y-2">
            <SheetTitle className="text-lg leading-tight font-semibold">
              {item.title}
            </SheetTitle>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{type.label}</Badge>
              {item.language && (
                <Badge variant="outline">{item.language}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <ItemActionBar item={item} />

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {item.description && (
          <Section label="Description">
            <p className="text-foreground">{item.description}</p>
          </Section>
        )}

        <ItemPayload item={item} />

        {item.tags.length > 0 && (
          <Section label="Tags" icon={Tag}>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {item.collections.length > 0 && (
          <Section label="Collections" icon={FolderOpen}>
            <div className="flex flex-wrap gap-1.5">
              {item.collections.map((collection) => (
                <Badge key={collection.id} variant="outline">
                  {collection.name}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        <Section label="Details" icon={CalendarDays}>
          <dl className="space-y-1">
            <DetailRow term="Created" date={item.createdAt} />
            <DetailRow term="Updated" date={item.updatedAt} />
          </dl>
        </Section>
      </div>
    </>
  );
}

/**
 * The item's payload, branched on `contentType` rather than on the type's name
 * so a custom type flows through unchanged — see `docs/item-types.md`.
 *
 * `TEXT` renders as plain preformatted text for now: syntax highlighting and
 * the code editor are deferred, per the spec.
 */
function ItemPayload({ item }: { item: SerializedItemDetail }) {
  switch (item.contentType) {
    case "TEXT":
      return (
        item.content && (
          <Section label="Content">
            <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 font-mono text-xs leading-relaxed">
              <code>{item.content}</code>
            </pre>
          </Section>
        )
      );

    case "URL":
      return (
        item.url && (
          <Section label="Link">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-primary underline underline-offset-4 hover:no-underline"
            >
              {item.url}
            </a>
          </Section>
        )
      );

    case "FILE":
      // Uploads are a Pro feature and nothing writes `fileUrl` yet, so there is
      // no blob to link to. Saying so beats rendering an empty section.
      return (
        <Section label="File">
          <p className="text-muted-foreground">
            File uploads are not available yet.
          </p>
        </Section>
      );
  }
}

interface SectionProps {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}

/** A labelled block in the drawer body. */
function Section({ label, icon: Icon, children }: SectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </h3>
      {children}
    </section>
  );
}

function DetailRow({ term, date }: { term: string; date: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd>
        <time dateTime={date}>{formatLongDate(date)}</time>
      </dd>
    </div>
  );
}

/** Mirrors the loaded layout so the drawer does not jump when data arrives. */
function DrawerSkeleton() {
  return (
    <>
      <SheetTitle className="sr-only">Loading item</SheetTitle>

      <div className="flex items-start gap-3 p-4 pr-14">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>

      <div className="flex gap-2 border-b px-4 pb-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>

      <div className="space-y-6 p-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </>
  );
}

/**
 * A sentence for each status the route answers with. A 404 is also what a wrong
 * owner gets, so the wording must not imply the item exists elsewhere.
 */
function describeError(status: number): string {
  switch (status) {
    case 401:
      return "Your session has expired. Sign in again to view this item.";
    case 404:
      return "That item could not be found. It may have been deleted.";
    default:
      return "Something went wrong loading this item. Try again.";
  }
}
