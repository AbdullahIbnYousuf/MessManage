import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Rule overrides
  {
    rules: {
      // False positive: flags `void asyncFn()` inside useEffect even though
      // state is set asynchronously (after await), not synchronously.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
