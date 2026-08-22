import { FolderPlus, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Top bar of the dashboard shell.
 *
 * The trigger opens and closes the sidebar; the search field and action
 * buttons are still display only.
 *
 * Both action buttons collapse to their icon when the bar is narrow. A
 * `Button` is `shrink-0`, so at phone widths the two full labels and the
 * search field could not all fit and the row overflowed the viewport. The
 * labels stay in the accessible tree via `sr-only`, so the buttons keep their
 * names when they are only an icon.
 *
 * That threshold is a **container** query, not a viewport one: the bar sits
 * inside `SidebarInset`, so how much room it has depends on whether the
 * sidebar is open, which a `sm:`/`lg:` breakpoint cannot see. A viewport
 * breakpoint therefore either overflows with the sidebar open or hides the
 * labels needlessly with it closed. Labelled, the buttons plus the trigger,
 * padding and gaps cost ~342px, so `@xl` (576px) leaves the search a usable
 * ~230px at the point they appear.
 */
export function DashboardTopBar() {
  return (
    <header className="@container flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />

      {/*
        `min-w-0` lets the field shrink past the intrinsic width an `<input>`
        carries by default; without it the search alone keeps the row wider
        than a phone viewport.
      */}
      <div className="relative w-full max-w-md min-w-0">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search items..."
          aria-label="Search items"
          className="h-9 pr-16 pl-9"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs text-muted-foreground">
          ⌘ K
        </kbd>
      </div>

      {/*
        `shrink-0` on the group, not just on the buttons inside it. The buttons
        were already unshrinkable, so when the group itself was allowed to
        shrink they simply overflowed its box and pushed past the viewport.
        Holding the group at its content width sends the whole deficit to the
        search field, which `min-w-0` above lets it absorb.
      */}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button variant="outline" size="lg">
          <FolderPlus />
          <span className="sr-only @xl:not-sr-only">New Collection</span>
        </Button>
        <Button size="lg">
          <Plus />
          <span className="sr-only @xl:not-sr-only">New Item</span>
        </Button>
      </div>
    </header>
  );
}
