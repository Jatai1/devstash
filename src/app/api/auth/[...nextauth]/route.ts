import { handlers } from "@/auth";

// Auth.js owns every route under `/api/auth/*` — the provider callbacks, the
// session endpoint and the default sign-in page.
export const { GET, POST } = handlers;
