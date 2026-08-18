import { FolderPlus, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Top bar of the dashboard shell.
 *
 * The trigger opens and closes the sidebar; the search field and action
 * buttons are still display only.
 */
export function DashboardTopBar() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger />

      <div className="relative w-full max-w-md">
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

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="lg">
          <FolderPlus />
          New Collection
        </Button>
        <Button size="lg">
          <Plus />
          New Item
        </Button>
      </div>
    </header>
  );
}
