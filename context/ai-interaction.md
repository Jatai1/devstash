# AI Interaction Guidelines

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification

## Workflow

This is the common workflow that we will use for every single feature/fix:

1. **Document** - Document the feature in @context/current-feature.md.
2. **Branch** - Create new branch for feature, fix, etc
3. **Implement** - Implement the feature/fix that I create in @context/current-feature.md
4. **Test** - Write unit tests for any Server Action or utility the feature adds or changes, then verify it works in the browser. Run `npm test`, `npm run lint` and `npm run build`, and fix any errors
5. **Iterate** - Iterate and change things if needed
6. **Commit** - Only after build passes and everything works
7. **Merge** - Merge to main
8. **Delete Branch** - Delete branch after merge
9. **Review** - Review AI-generated code periodically and on demand.
10. Mark as completed in @context/current-feature.md and add to history

Do NOT commit without permission and until the build passes. If build fails, fix the issues first.

## Testing

Vitest is the test runner: `npm test` runs the suite once, `npm run test:watch` watches.

**Only Server Actions (`src/actions/`) and utilities (`src/lib/`) are unit tested.**
Components are not, and `vitest.config.ts` enforces that through its `include` — a test
file under `src/components/` never runs. Components here are mostly async server
components that read the database, so a rendering test would need either a live
connection or a mock of every query behind it, and would assert about markup that
changes with every design pass. They are verified in the browser instead.

- Tests live beside what they test, as `<module>.test.ts`
- Prefer testing the rules a module enforces over the plumbing it calls: mock
  `@/lib/prisma`, `@/auth` and `@/lib/password`, and let validation, session handling
  and error shaping run for real
- `npm run test:db` is the separate check that the real database connection works;
  unit tests never touch Postgres, Upstash or Resend
- A browser check is still part of step 4. Passing tests are not evidence a page renders

## Branching

We will create a new branch for every feature/fix. Name branch **feature/[feature]** or **fix[fix]**, etc. Ask to delete the branch once merged.

## Commits

- Ask before committing (don't auto-commit)
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated With Claude" in the commit messages

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)
