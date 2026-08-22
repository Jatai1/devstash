import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Unit tests only, and only for the two layers worth unit testing here: Server
 * Actions (`src/actions/`) and utilities (`src/lib/`).
 *
 * Components are deliberately out of scope — they are almost all async server
 * components that read the database, so a rendering test would either need a
 * live connection or a mock of every query behind it, and would assert about
 * markup that changes with every design pass. They are verified in the browser
 * instead, which is what step 4 of the workflow in `context/ai-interaction.md`
 * has always meant. That decision is enforced by `include` below rather than by
 * convention: a test file under `src/components/` simply never runs.
 */
export default defineConfig({
  plugins: [
    {
      // `src/lib/rate-limit.ts` and the three `src/lib/email/` modules start
      // with `import "server-only"`, whose real entry point throws unless it is
      // resolved under Node's `react-server` condition. Next.js sets that
      // condition for server code; Vitest does not, so importing any of those
      // modules from a test would fail on the import alone. Stubbing the
      // package out is the whole fix — its only job is to fail a *build* that
      // pulls server code into a client bundle, which a unit test is not.
      name: "devstash:stub-server-only",
      resolveId: (id) => (id === "server-only" ? "\0server-only" : null),
      load: (id) => (id === "\0server-only" ? "export {}" : null),
    },
  ],
  resolve: {
    alias: {
      // Mirrors the `@/*` path in `tsconfig.json`. Kept as a plain alias rather
      // than pulling in `vite-tsconfig-paths` for the one entry that exists.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // No jsdom: nothing under test touches the DOM.
    environment: "node",
    include: ["src/actions/**/*.test.ts", "src/lib/**/*.test.ts"],
    // `describe`/`it`/`expect`/`vi` are imported explicitly in every test file,
    // so no global types have to be added to `tsconfig.json`.
    globals: false,
    // Call history is cleared between tests, so one test's calls cannot be
    // counted by the next — `restoreMocks` alone does not do this, because it
    // only reaches spies created with `vi.spyOn` and not the `vi.fn()` mocks a
    // `vi.mock` factory returns. Implementations survive, which is what lets a
    // factory supply a default and a `beforeEach` supply the rest.
    clearMocks: true,
    // And spies on real objects (`vi.spyOn(console, "error")`) are put back.
    restoreMocks: true,
  },
});
