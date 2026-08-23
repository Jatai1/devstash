"use client";

import dynamic from "next/dynamic";

import { CopyButton } from "@/components/dashboard/CopyButton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Monaco is browser-only and large, so it is neither server-rendered nor part
 * of the main bundle: the chunk downloads the first time a code item is opened.
 *
 * The placeholder is sized to the editor's own minimum so the drawer does not
 * jump when the chunk lands.
 */
const CodeEditorSurface = dynamic(
  () => import("@/components/dashboard/CodeEditorSurface"),
  {
    ssr: false,
    loading: () => <Skeleton className="m-3 h-[72px] rounded-md" />,
  },
);

interface CodeEditorProps {
  value: string;
  /**
   * Absent puts the editor in display mode: read-only, with no cursor and no
   * active-line highlight. One prop rather than a separate `readOnly` flag, so
   * the two cannot contradict each other.
   */
  onChange?: (value: string) => void;
  /** Shown in the header as written, even when Monaco falls back to plaintext. */
  language?: string | null;
  /** Names the editor for a screen reader — Monaco has no visible label. */
  label: string;
  /** Wires up `Field`'s error message. */
  id?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * A code block in a macOS-style window: three dots, the language, a copy
 * button, and Monaco below.
 *
 * The same component serves both the drawer's display mode and the two forms'
 * edit mode, which is the point — a snippet is written, read and edited in one
 * control, so nothing about how it looks depends on where it is being shown.
 * Only code types reach it: see `isCodeItemType` for why that branch is on the
 * type's name and not on its `contentKind`.
 *
 * The chrome lives here rather than in `CodeEditorSurface` so it renders with
 * the page. The header, the border and the dots are all up immediately and the
 * Monaco chunk fills in underneath, instead of the whole block popping in at
 * once.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  label,
  id,
  className,
  ...aria
}: CodeEditorProps) {
  const isDisplay = onChange === undefined;

  return (
    <div
      id={id}
      // Display mode is a rendering of the body rather than a control, so the
      // block names itself; in edit mode Monaco's own textarea carries the
      // name and a second one here would be announced twice.
      role={isDisplay ? "group" : undefined}
      aria-label={isDisplay ? label : undefined}
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        // `Field` sets `aria-invalid` on whatever it wraps, and every other
        // control in these forms grows a destructive ring from it.
        "aria-invalid:border-destructive/60 aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        className,
      )}
      {...aria}
    >
      <div className="flex items-center gap-2 border-b bg-muted/40 py-1.5 pr-1.5 pl-3">
        <WindowDots />

        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {language?.trim() || "plain text"}
        </span>

        <CopyButton
          text={value.trim() ? value : null}
          iconOnly
          className="size-7 text-muted-foreground hover:text-foreground"
        />
      </div>

      {isDisplay ? (
        <>
          {/* Monaco only keeps the *visible* lines in the DOM, and in display
              mode it renders no textarea at all, so there is nothing for a
              screen reader to read past the viewport. The full body goes in a
              plain `pre` instead — the same markup this replaced visually —
              and the editor is hidden from the accessibility tree, since in
              display mode it is decoration over text that is already here. */}
          <pre className="sr-only">{value}</pre>
          <div aria-hidden>
            <CodeEditorSurface
              value={value}
              language={language ?? null}
              ariaLabel={label}
            />
          </div>
        </>
      ) : (
        <CodeEditorSurface
          value={value}
          onChange={onChange}
          language={language ?? null}
          ariaLabel={label}
        />
      )}
    </div>
  );
}

/**
 * The three macOS traffic lights. Purely decorative — they are not buttons and
 * close nothing — so the row is hidden from the accessibility tree rather than
 * announced as three unlabelled circles.
 */
function WindowDots() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      <span className="size-3 rounded-full bg-[#ff5f57]" />
      <span className="size-3 rounded-full bg-[#febc2e]" />
      <span className="size-3 rounded-full bg-[#28c840]" />
    </div>
  );
}
