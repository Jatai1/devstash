import {
  Code,
  File,
  FileText,
  Image,
  Link,
  Sparkles,
  StickyNote,
  Terminal,
  type LucideIcon,
} from "lucide-react";

/**
 * Lucide icons referenced by name from the data layer (see `ItemType.icon`).
 * Kept explicit rather than looked up off the `lucide-react` namespace so the
 * bundler only ships the icons we actually use.
 */
const ICONS: Record<string, LucideIcon> = {
  Code,
  File,
  FileText,
  Image,
  Link,
  Sparkles,
  StickyNote,
  Terminal,
};

/** Falls back to a generic file icon for unknown names. */
export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? File;
}
