# Coding Standards

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## Next.js

- Server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs)
- Use Server Actions for form submissions and simple mutations
- Use API routes when you need:
  - Webhooks (Stripe, GitHub, etc.)
  - File uploads with progress tracking
  - Long-running operations
  - Specific HTTP status codes or headers
  - Endpoints for future mobile/CLI clients
  - Third-party integrations
- Otherwise, fetch data directly in server components
- Dynamic routes for item/collection pages

## Tailwind CSS v4

**CRITICAL**: We are using Tailwind CSS v4, which uses CSS-based configuration.

- **DO NOT** create `tailwind.config.ts` or `tailwind.config.js` files (those are for v3)
- All theme configuration must be done in CSS using the `@theme` directive in `src/app/globals.css`
- Use CSS custom properties for colors, spacing, etc.
- No JavaScript-based config allowed

Example v4 configuration:

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(50% 0.2 250);
}
```

## File Organization

- Components: `src/components/[feature]/ComponentName.tsx`
- Pages: `src/app/[route]/page.tsx`
- Server Actions: `src/actions/[feature].ts`
- Types: `src/types/[feature].ts`
- Lib/Utils: `src/lib/[utility].ts`

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Tailwind CSS for all styling
- Use shadcn/ui components where applicable
- No inline styles
- Dark mode first, light mode as option

## Database

- Use Prisma ORM for all database operations
- Always use `prisma migrate dev` for schema changes (not `db push`)
- Run `prisma migrate status` before committing to verify migrations are in sync
- Production deployments must run `prisma migrate deploy` before the app starts

## Data Fetching

- Server components fetch directly with Prisma
- Client components use Server Actions
- Validate all inputs with Zod

## Error Handling

- Use try/catch in Server Actions
- Return a **flat state object** from actions, shaped for `useActionState`:

  ```ts
  export interface SomethingState {
    /** Whole-form failure, rendered above the fields. */
    error?: string;
    /** Field-keyed messages, so the form can mark the offending input. */
    fieldErrors?: Partial<Record<"fieldName", string[]>>;
    /** Shown on success. */
    message?: string;
  }
  ```

  Not a `{ success, data, error }` wrapper. `useActionState` hands the returned
  object straight to the form, so a wrapper would only make every form unwrap a
  level before it could render anything. Every action in `src/actions/` uses the
  flat shape: `SignInState`, `ResendState`, `ForgotPasswordState`,
  `ResetPasswordState`, `ChangePasswordState`, `DeleteAccountState`.

- Add a **`succeededAt?: number`** when the form resets itself on success. An
  effect needs a value that *changes* between two consecutive successes, and
  `message` is the same string every time — see `ChangePasswordState`
  (`src/actions/profile.ts`) for the bug this fixes.

- Build field errors with `z.flattenError(parsed.error).fieldErrors` — the Zod 4
  spelling. `error.flatten()` is the deprecated Zod 3 method.

- Display errors **inline**, in the form's own error slot, next to the input that
  caused them. There is no toast library installed and no `toast` component in
  `src/components/ui/`; adding one is a decision, not an assumption. Do not write
  a spec or an action that depends on a toast until it exists.

## Testing

- Vitest, run with `npm test` (`npm run test:watch` while working)
- **Unit tests cover Server Actions (`src/actions/`) and utilities (`src/lib/`) only.**
  Components are verified in the browser; `vitest.config.ts` scopes `include` to those
  two directories, so a test placed anywhere else silently never runs
- Test files sit beside the module they cover: `src/lib/tokens.ts` →
  `src/lib/tokens.test.ts`
- Import `describe`/`it`/`expect`/`vi` explicitly — `globals` is off
- Mock at the boundary, not inside the logic. `@/lib/prisma`, `@/auth` and
  `@/lib/password` are mocked with `vi.mock`; validation, session checks and the
  returned state shape are exercised for real
- `@/lib/password` is mocked for speed as much as isolation — bcrypt at 12 rounds costs
  a few hundred milliseconds per call
- Assert on the flat state object an action returns (`error`, `fieldErrors`, `message`),
  since that is exactly what `useActionState` hands the form
- Cover the security decision, not just the happy path: a Server Action is a public
  endpoint, so every action has a "no session" and a "session names a deleted row" case
  worth pinning down

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
