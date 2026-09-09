"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CopyButton } from "@/components/dashboard/CopyButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MarkdownEditorProps {
  value: string;
  /**
   * Absent puts the editor in display mode: the Write tab is not rendered at
   * all and the body is preview only. One prop rather than a separate
   * `readOnly` flag, so the two cannot contradict each other — the same shape
   * `CodeEditor` uses.
   */
  onChange?: (value: string) => void;
  /** Names the editor for a screen reader. */
  label: string;
  /** Wires up `Field`'s label and error message. */
  id?: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * A Markdown body with Write and Preview tabs.
 *
 * The prose counterpart to `CodeEditor`, and deliberately its twin: same panel,
 * same header bar, same copy button, same 400px cap. The two sit in the same
 * drawer and the same forms, so a note and a snippet should differ in what they
 * offer, not in how they are framed. Only Markdown types reach it — see
 * `isMarkdownItemType` for why that branch is on the type's name rather than on
 * its `contentKind`, and why a custom type gets neither editor.
 *
 * Unlike `CodeEditor` there is no `next/dynamic` boundary and no chunk to wait
 * for: `react-markdown` is small, has no worker, and renders on the server
 * happily. It also emits real DOM for every node, so display mode needs none of
 * the `sr-only` shadow copy Monaco required — a screen reader reads the preview
 * directly.
 */
export function MarkdownEditor({
  value,
  onChange,
  label,
  id,
  className,
  ...aria
}: MarkdownEditorProps) {
  const isDisplay = onChange === undefined;

  return (
    <Tabs
      // Display mode has one tab and no way to leave it; edit mode opens on
      // Write, because the reason to open a body for editing is to change it.
      defaultValue={isDisplay ? "preview" : "write"}
      className={cn(
        // `gap-0` overrides the Tabs root's own spacing: the header and the
        // panel are the two halves of one framed block, not stacked sections.
        "gap-0 overflow-hidden rounded-lg border bg-card",
        // `Field` sets `aria-invalid` on whatever it wraps, and every other
        // control in these forms grows a destructive ring from it.
        "aria-invalid:border-destructive/60 aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        className,
      )}
      // In display mode the block is a rendering of the body rather than a
      // control, so it names itself; in edit mode the textarea below carries
      // the name and a second one here would be announced twice.
      role={isDisplay ? "group" : undefined}
      aria-label={isDisplay ? label : undefined}
      {...aria}
    >
      <div className="flex items-center gap-2 border-b bg-muted/40 py-1.5 pr-1.5 pl-3">
        <TabsList variant="line" className="h-7 p-0">
          {isDisplay ? null : (
            <TabsTrigger value="write" className="px-2 text-xs">
              Write
            </TabsTrigger>
          )}

          <TabsTrigger value="preview" className="px-2 text-xs">
            Preview
          </TabsTrigger>
        </TabsList>

        <CopyButton
          // The Markdown source, not the rendered text: it is what the field
          // holds and what pasting it back somewhere else would need.
          text={value.trim() ? value : null}
          iconOnly
          className="ml-auto size-7 text-muted-foreground hover:text-foreground"
        />
      </div>

      {isDisplay ? null : (
        <TabsContent value="write">
          <Textarea
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            // The visible `Label` from `Field` already points here through
            // `htmlFor`, but this component is also used without one, so the
            // control names itself rather than depending on its surroundings.
            aria-label={label}
            spellCheck={false}
            className={cn(
              // The panel supplies the frame, so the textarea gives up its own
              // border, background and focus ring rather than drawing a second
              // box inside the first.
              "rounded-none border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0",
              // `field-sizing-content` on the base component is what makes the
              // height fluid; these two only bound it. 400px matches
              // `CodeEditor`'s cap so the two do not disagree about how tall a
              // body may get.
              "max-h-[400px] min-h-24",
              "markdown-scroll p-3 font-mono text-xs leading-relaxed md:text-xs",
            )}
          />
        </TabsContent>
      )}

      <TabsContent value="preview">
        <div className="markdown-scroll markdown-preview max-h-[400px] min-h-24 overflow-y-auto p-3">
          {value.trim() ? (
            // No `rehype-raw`: an item's body is untrusted input, and
            // `react-markdown` refusing to render embedded HTML is what keeps a
            // pasted `<script>` or a styled overlay from being anything but
            // text. GFM is the only extension, per the spec.
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-xs text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
