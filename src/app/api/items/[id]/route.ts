import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getItem } from "@/lib/db/items";

/**
 * One item in full, for the detail drawer.
 *
 * A route handler rather than a Server Action because this is a *read* fired
 * from a client component on click: actions are POST-only and shaped for
 * `useActionState`, neither of which fits fetching a record to display.
 *
 * **This route is not behind `src/proxy.ts`.** Its matcher covers
 * `/dashboard`, `/profile` and `/items` — not `/api/*` — so, exactly like a
 * Server Action, the endpoint is public and re-derives the user itself. It
 * never takes an owner from the request.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/items/[id]">,
) {
  const session = await auth();
  const userId = session?.user?.id;

  // Unlike `getCurrentUserId()`, which throws because the proxy guarantees a
  // session on every route it matches, an anonymous request here is expected
  // and gets a status rather than a stack trace.
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { id } = await params;
  const item = await getItem(userId, id);

  // `getItem` scopes by `userId`, so someone else's item is already `null`
  // here and answers 404 like an id that never existed.
  if (!item) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  return NextResponse.json(item);
}
