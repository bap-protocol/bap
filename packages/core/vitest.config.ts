import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests hit live external sites — they're flaky for CI by default.
    // Run on demand via `pnpm test:integration`.
    exclude: [...configDefaults.exclude, "**/__integration__/**"],
  },
});
