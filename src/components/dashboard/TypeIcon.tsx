import { createElement } from "react";
import type { LucideProps } from "lucide-react";

import { getIcon } from "@/lib/icons";

interface TypeIconProps extends LucideProps {
  /** Lucide icon name stored on the item type, e.g. "Code". */
  name: string;
}

/**
 * Renders the Lucide icon an item type names. Built with `createElement` rather
 * than a capitalized local, which the `react-hooks/static-components` lint rule
 * reads as a component defined during render.
 */
export function TypeIcon({ name, ...props }: TypeIconProps) {
  return createElement(getIcon(name), props);
}
