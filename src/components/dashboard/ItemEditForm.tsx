"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateItem, type UpdateItemState } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SerializedItemDetail } from "@/lib/db/items";
import { parseTagInput, type ItemUpdateField } from "@/lib/item-schemas";

interface ItemEditFormProps {
  item: SerializedItemDetail;
  /** Leaves edit mode, discarding whatever is in the inputs. */
  onCancel: () => void;
  /** Hands the saved item back so the drawer can render it without refetching. */
  onSaved: (item: SerializedItemDetail) => void;
}

/**
 * The drawer's edit mode: the same item, with its editable columns as inputs.
 *
 * Deliberately not a `useActionState` form. Every other form in the project
 * submits `FormData` to a `(previous, formData)` action, but this one lives
 * inside a sheet that has to return to its view mode holding the *saved* item,
 * so it keeps controlled state and calls `updateItem(id, fields)` directly.
 *
 * Which payload fields exist follows the item's `contentType`, never its type
 * name — a custom type flows through on the strength of the kind it declares.
 * The server picks its schema the same way, from the stored row rather than
 * from anything sent here.
 */
export function ItemEditForm({ item, onCancel, onSaved }: ItemEditFormProps) {
  const router = useRouter();
  const fieldId = useId();

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [content, setContent] = useState(item.content ?? "");
  const [language, setLanguage] = useState(item.language ?? "");
  const [url, setUrl] = useState(item.url ?? "");
  const [tagsInput, setTagsInput] = useState(item.tags.join(", "));

  const [state, setState] = useState<UpdateItemState>({});
  const [isPending, startTransition] = useTransition();

  // A client-side guard only. The schema enforces the same rule server-side,
  // which is the one that counts — this just stops a submit that cannot succeed.
  const canSave = title.trim() !== "" && !isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateItem(item.id, {
        title,
        description,
        tags: parseTagInput(tagsInput),
        // Sending only what this kind stores keeps the payload honest; the
        // schema would strip the rest anyway.
        ...(item.contentType === "TEXT" ? { content, language } : {}),
        ...(item.contentType === "URL" ? { url } : {}),
      });

      setState(result);

      if (result.item) {
        toast.success(result.message ?? "Changes saved.");
        // The drawer's copy is now current, but the cards behind it are still
        // the server's older render.
        router.refresh();
        onSaved(result.item);

        return;
      }

      toast.error(
        result.error ?? "Check the highlighted fields and try again.",
      );
    });
  }

  function errorsFor(field: ItemUpdateField) {
    return state.fieldErrors?.[field];
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {/* Sits where the action bar does in view mode, and matches its spacing
          so the drawer does not shift when the mode changes. */}
      <div className="flex items-center gap-2 border-b px-4 pb-3">
        <Button type="submit" size="sm" disabled={!canSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {state.error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}

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
              autoFocus
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

        {item.contentType === "TEXT" ? (
          <>
            <Field
              id={`${fieldId}-content`}
              label="Content"
              errors={errorsFor("content")}
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  // Plain text on purpose: a code editor and syntax
                  // highlighting are a later feature, so the font is the only
                  // nod to what is usually in here.
                  className="max-h-96 min-h-40 font-mono text-xs"
                  spellCheck={false}
                />
              )}
            </Field>

            <Field
              id={`${fieldId}-language`}
              label="Language"
              hint="Used for syntax highlighting later, e.g. typescript"
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

        {item.contentType === "URL" ? (
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
      </div>
    </form>
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
 * One labelled input, with its error message and the ARIA wiring between them.
 *
 * The control comes in as a render prop rather than as `children`: text, code
 * and URL all need different components, and passing the generated ids down is
 * the only thing they have in common.
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
