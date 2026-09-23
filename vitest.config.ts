import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // See src/test/server-only-mock.ts for why this alias exists.
      "server-only": path.resolve(__dirname, "src/test/server-only-mock.ts"),
    },
  },
});
