"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { createItem, type CreateItemState } from "@/actions/items";
import { CodeEditor } from "@/components/dashboard/CodeEditor";
import { MarkdownEditor } from "@/components/dashboard/MarkdownEditor";
import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isCodeItemType } from "@/lib/code-item-types";
import type { CreatableItemType } from "@/lib/db/item-types";
import { parseTagInput, type ItemCreateField } from "@/lib/item-schemas";
import { isMarkdownItemType } from "@/lib/markdown-item-types";

interface NewItemDialogProps {
  /** Every type this user may file under — see `getCreatableItemTypes`. */
  types: CreatableItemType[];
}

/**
 * The "New Item" dialog, and the smallest client boundary that can own it.
 *
 * The top bar it sits in is a server component rendered by the `(app)` layout,
 * so the trigger lives here with the form rather than the whole bar becoming a
 * client component — the same reasoning that made `ItemList` a wrapper instead
 * of turning three pages into client components.
 *
 * Which payload fields appear follows the selected type's **`contentKind`**,
 * never its name. All four text types get the same body and language fields,
 * which is what keeps this form and `ItemEditForm` telling the same story about
 * the same item — the spec's per-name split would have shown a Language box on
 * a note only after it had been created.
 */
export function NewItemDialog({ types }: NewItemDialogProps) {
  const router = useRouter();
  const fieldId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [itemTypeId, setItemTypeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("");
  const [url, setUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [state, setState] = useState<CreateItemState>({});
  const [isPending, startTransition] = useTransition();

  const selectedType = types.find((type) => type.id === itemTypeId) ?? null;

  // Which *control* renders the body, where `contentKind` below decides which
  // fields exist at all. Both surfaces have to answer this the same way, or an
  // item would be written in one editor and edited in another.
  const isCode = selectedType !== null && isCodeItemType(selectedType.name);
  const isMarkdown =
    selectedType !== null && isMarkdownItemType(selectedType.name);

  // A client-side guard only. The schema enforces both rules server-side, which
  // is the pair that counts — this just stops a submit that cannot succeed.
  const canSave = Boolean(selectedType) && title.trim() !== "" && !isPending;

  function reset() {
    setItemTypeId("");
    setTitle("");
    setDescription("");
    setContent("");
    setLanguage("");
    setUrl("");
    setTagsInput("");
    setState({});
  }

  /**
   * Every close goes through here, and that is load-bearing.
   *
   * Radix calls `onOpenChange` when *it* closes the dialog — Escape, the
   * overlay, a `DialogClose` — but **not** when the controlled `open` prop is
   * set to false by our own code. So a Cancel button wired straight to
   * `setIsOpen(false)` skips the reset, and reopening shows the abandoned
   * draft. Found exactly that way in the browser.
   */
  function close() {
    reset();
    setIsOpen(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createItem({
        itemTypeId,
        title,
        description,
        tags: parseTagInput(tagsInput),
        // Sending only what this kind stores keeps the payload honest; the
        // schema would strip the rest anyway.
        ...(selectedType?.contentKind === "TEXT" ? { content, language } : {}),
        ...(selectedType?.contentKind === "URL" ? { url } : {}),
      });

      setState(result);

      if (result.item) {
        toast.success(result.message ?? "Item created.");
        // The lists behind the dialog are the server's older render, as are
        // the stats and the sidebar's per-type counts.
        router.refresh();
        close();

        return;
      }

      toast.error(
        result.error ?? "Check the highlighted fields and try again.",
      );
    });
  }

  function errorsFor(field: ItemCreateField) {
    return state.fieldErrors?.[field];
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        // Escape and the overlay arrive here; Cancel and a successful create
        // call `close()` themselves, since this does not fire for a controlled
        // prop change. A dismissed dialog must not reopen holding what was
        // abandoned, nor an error from the attempt before it.
        if (!next) {
          close();

          return;
        }

        setIsOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus />
          <span className="sr-only @xl:not-sr-only">New Item</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>
            Pick a type, then fill in what it stores.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {state.error ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}

          <Field
            id={`${fieldId}-type`}
            label="Type"
            errors={errorsFor("itemTypeId")}
          >
            {(props) => (
              <Select value={itemTypeId} onValueChange={setItemTypeId}>
                <SelectTrigger {...props} className="w-full">
                  <SelectValue placeholder="Choose a type" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <TypeIcon
                        name={type.icon}
                        className="size-4"
                        style={{ color: type.color }}
                        aria-hidden
                      />
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            id={`${fieldId}-title`}
            label="Title"
            errors={errorsFor("title")}
          >
            {(props) => (
              <Input
                {...props}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            )}
          </Field>

          <Field
            id={`${fieldId}-description`}
            label="Description"
            errors={errorsFor("description")}
          >
            {(props) => (
              <Textarea
                {...props}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
              />
            )}
          </Field>

          {selectedType?.contentKind === "TEXT" ? (
            <>
              <Field
                id={`${fieldId}-content`}
                label="Content"
                errors={errorsFor("content")}
              >
                {(props) =>
                  isCode ? (
                    <CodeEditor
                      {...props}
                      value={content}
                      onChange={setContent}
                      // The live field, so typing a language rehighlights the
                      // body before the item has been created.
                      language={language}
                      label="Content"
                    />
                  ) : isMarkdown ? (
                    <MarkdownEditor
                      {...props}
                      value={content}
                      onChange={setContent}
                      label="Content"
                    />
                  ) : (
                    <Textarea
                      {...props}
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      // Prose, matching the drawer's edit form.
                      className="max-h-72 min-h-32 font-mono text-xs"
                      spellCheck={false}
                    />
                  )
                }
              </Field>

              <Field
                id={`${fieldId}-language`}
                label="Language"
                hint={
                  isCode
                    ? "Sets syntax highlighting, e.g. typescript"
                    : "Used for syntax highlighting later, e.g. typescript"
                }
                errors={errorsFor("language")}
              >
                {(props) => (
                  <Input
                    {...props}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                )}
              </Field>
            </>
          ) : null}

          {selectedType?.contentKind === "URL" ? (
            <Field id={`${fieldId}-url`} label="URL" errors={errorsFor("url")}>
              {(props) => (
                <Input
                  {...props}
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                />
              )}
            </Field>
          ) : null}

          <Field
            id={`${fieldId}-tags`}
            label="Tags"
            hint="Separated by commas"
            errors={errorsFor("tags")}
          >
            {(props) => (
              <Input
                {...props}
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
              />
            )}
          </Field>

          <DialogFooter>
            {/* Non-destructive, so the submit leads and Cancel follows — the
                mirror of the ordering `DeleteItemDialog` uses. */}
            <Button type="submit" disabled={!canSave}>
              {isPending ? "Creating…" : "Create item"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={isPending}
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
  /** Rendered with the id and ARIA wiring the label and message need. */
  children: (props: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}

/**
 * One labelled control, with its error message and the ARIA wiring between
 * them.
 *
 * The same shape as `ItemEditForm`'s field, and deliberately a copy rather than
 * a shared import: that one takes only inputs and textareas, this one also
 * wraps a `SelectTrigger`, and the two forms are free to diverge as create
 * grows a collection picker. Worth extracting if a third form appears.
 */
function Field({ id, label, hint, errors, children }: FieldProps) {
  const describedBy = [errors ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>

      {children({
        id,
        "aria-invalid": errors ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}

      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {errors ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
