"use client";

import Editor, { loader, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
// The core editor plus **highlighting only**, rather than the `monaco-editor`
// barrel. That barrel additionally pulls the TypeScript, JSON, CSS and HTML
// *language services*, which run in workers of their own and ask them for
// `getSyntacticDiagnostics`, `provideInlayHints` and `getNavigationTree` — each
// an uncaught error against the one generic worker below.
//
// They were not wanted in the first place. An item's body is a fragment, so
// type-checking a snippet that references an import it does not contain would
// underline half of it in red. `basic-languages` is the Monarch tokenizer set
// for ~70 languages: highlighting runs on the main thread, needs no worker, and
// still covers everything the type picker can produce.
//
// The specifiers go through the package's `exports` map (`"./*"` →
// `"./esm/vs/*.js"`), which is why neither says `esm/vs`.
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/basic-languages/monaco.contribution";
import { useCallback, useState } from "react";

/**
 * The editor grows with its content up to here, then scrolls. 400px is roughly
 * 25 lines at the size below, which covers most snippets without letting one
 * long file push the rest of the drawer off screen.
 */
const MAX_HEIGHT = 400;

/** Below this an editor reads as an accident rather than an empty field. */
const MIN_HEIGHT = 96;

/** Name of the theme registered in `defineTheme` below. */
const THEME = "devstash-dark";

/**
 * Point the loader at the bundled `monaco-editor` instead of its default CDN.
 *
 * `@monaco-editor/react` fetches Monaco from jsDelivr unless told otherwise,
 * which would make an item's body fail to render whenever that host is
 * unreachable — an offline dev server, a locked-down network, a CSP that does
 * not allow it. Bundling costs a large lazy chunk instead, which is why the
 * whole component is behind a `next/dynamic` boundary and only downloads when a
 * code item is actually opened.
 *
 * This runs at module scope on purpose: it has to be configured before the
 * first `<Editor>` mounts, and this module is only ever reached from the
 * browser.
 */
loader.config({ monaco });

/**
 * Monaco offloads its language services to web workers and logs a hard error
 * when it cannot make one. Nothing here needs a language service — there is no
 * type checking, no cross-file navigation, no diffing — so the *editor* worker
 * is the only one wired up, and the features that would reach for a richer one
 * are switched off in the options below.
 */
if (typeof window !== "undefined" && !window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker() {
      // `monaco-editor/editor/editor.worker.js`, not the `esm/vs/...` path the
      // file actually lives at: the package's `exports` map only publishes
      // `"./*.js": "./esm/vs/*.js"`, so the on-disk path does not resolve.
      return new Worker(
        new URL("monaco-editor/editor/editor.worker.js", import.meta.url),
        { type: "module" },
      );
    },
  };
}

interface CodeEditorSurfaceProps {
  value: string;
  /** Absent means the editor is read-only — see `CodeEditor`. */
  onChange?: (value: string) => void;
  /** Free text off the row; anything Monaco does not know becomes plain text. */
  language: string | null;
  /** Names the control for a screen reader, since Monaco has no visible label. */
  ariaLabel: string;
}

/**
 * The Monaco instance itself, split out so `CodeEditor` can load it lazily.
 *
 * Everything in this file assumes a browser: the loader config, the worker and
 * Monaco's own module graph all touch `window`, and the editor cannot be
 * server-rendered at all. The `next/dynamic` boundary with `ssr: false` in
 * `CodeEditor` is what enforces that.
 */
export default function CodeEditorSurface({
  value,
  onChange,
  language,
  ariaLabel,
}: CodeEditorSurfaceProps) {
  const [height, setHeight] = useState(MIN_HEIGHT);

  const readOnly = onChange === undefined;

  /**
   * Monaco does not size itself to its content, so the height is measured from
   * the editor and clamped here.
   *
   * `onDidContentSizeChange` rather than a one-off read at mount: in edit mode
   * the content grows as the user types, and in display mode the first
   * measurement can land before the model has been laid out.
   */
  const handleMount = useCallback(
    (instance: editor.IStandaloneCodeEditor, monacoInstance: Monaco) => {
      monacoInstance.editor.setTheme(THEME);

      const applyHeight = () => {
        const content = instance.getContentHeight();

        setHeight(Math.min(Math.max(content, MIN_HEIGHT), MAX_HEIGHT));
      };

      applyHeight();
      instance.onDidContentSizeChange(applyHeight);
    },
    [],
  );

  return (
    <div style={{ height }}>
      <Editor
        value={value}
        language={resolveLanguage(language)}
        theme={THEME}
        beforeMount={defineTheme}
        onMount={handleMount}
        // Monaco reports `undefined` when it cannot produce a value; the field
        // is a string everywhere else, so an empty one is the honest fallback.
        onChange={(next) => onChange?.(next ?? "")}
        loading={null}
        options={{
          readOnly,
          // A read-only editor is a rendering of the body, not a disabled
          // input, so the cursor and the active-line highlight would only
          // suggest an interaction that is not on offer.
          domReadOnly: readOnly,
          renderLineHighlight: readOnly ? "none" : "line",
          // Monaco keeps a hidden textarea for input even when read-only, and
          // in display mode `CodeEditor` puts the whole editor behind
          // `aria-hidden`. A focusable control inside a hidden subtree is a
          // trap — tabbable but unreachable to a screen reader — so display
          // mode takes it out of the tab order.
          tabIndex: readOnly ? -1 : 0,
          ariaLabel,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 20,
          minimap: { enabled: false },
          // Without this Monaco reserves a screen of empty space below the
          // last line, which the measured height would then include.
          scrollBeyondLastLine: false,
          // The drawer and the dialog both resize as their content changes,
          // and Monaco does not notice a container resize on its own.
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          lineNumbersMinChars: 3,
          folding: false,
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            // The parent already scrolls; letting Monaco swallow the wheel at
            // the top and bottom of a short body traps the drawer's scroll.
            alwaysConsumeMouseWheel: false,
          },
          // All three would reach for a language worker this build does not
          // load, and none of them belong in a snippet field anyway.
          quickSuggestions: false,
          wordBasedSuggestions: "off",
          occurrencesHighlight: "off",
          inlayHints: { enabled: "off" },
        }}
      />
    </div>
  );
}

/**
 * A dark theme built from the same palette as the rest of the app.
 *
 * Monaco takes only hex, while `globals.css` is written in `oklch`, so these
 * are the sRGB equivalents of the `.dark` tokens rather than references to
 * them: `#171717` is `--card`, `#ffffff1a` is `--border`, and the two greys are
 * `--muted-foreground` and a step darker. The app hard-codes `dark` on `<html>`
 * and has no light mode yet, so one theme is the whole story for now.
 */
function defineTheme(monacoInstance: Monaco) {
  monacoInstance.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#171717",
      "editor.foreground": "#e5e5e5",
      "editorGutter.background": "#171717",
      "editorLineNumber.foreground": "#525252",
      "editorLineNumber.activeForeground": "#a3a3a3",
      "editor.lineHighlightBackground": "#ffffff0a",
      "editor.lineHighlightBorder": "#00000000",
      "editorCursor.foreground": "#fafafa",
      "editor.selectionBackground": "#3f3f46",
      "editor.inactiveSelectionBackground": "#3f3f4680",
      "scrollbarSlider.background": "#ffffff1a",
      "scrollbarSlider.hoverBackground": "#ffffff2e",
      "scrollbarSlider.activeBackground": "#ffffff40",
      "editorWidget.background": "#171717",
      "editorWidget.border": "#ffffff1a",
    },
  });
}

/**
 * Maps the row's free-text `language` onto a language Monaco actually knows.
 *
 * `Item.language` is validated as a length-capped string and nothing more, so
 * it can hold anything a user typed. Monaco silently renders an unknown id as
 * unhighlighted text, but asking it what it supports first means the *header*
 * can keep showing what the user wrote while the editor falls back honestly.
 * Aliases are Monaco's own — `ts`, `sh` and `yml` all resolve through them.
 */
function resolveLanguage(language: string | null): string {
  const wanted = language?.trim().toLowerCase();

  if (!wanted) {
    return "plaintext";
  }

  const match = monaco.languages
    .getLanguages()
    .find(
      (candidate) =>
        candidate.id === wanted ||
        candidate.aliases?.some((alias) => alias.toLowerCase() === wanted),
    );

  return match?.id ?? "plaintext";
}
