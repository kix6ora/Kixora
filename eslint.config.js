import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directories that must never be linted. `.kilo/**` is critical: the agent
// worktrees under `.kilo/worktrees/*` are full nested checkouts of this repo,
// and linting them duplicated every file (and made the parser resolve several
// competing tsconfig candidates), which broke CI.
const IGNORED_PATHS = [
  ".kilo/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/playwright-report/**",
  "**/test-results/**",
];

export default tseslint.config(
  { ignores: IGNORED_PATHS },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        // Pin the root so the TypeScript parser always resolves ./tsconfig.json
        // from this directory instead of guessing from each linted file.
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_", "caughtErrorsIgnorePattern": "^_" }],
      "react-hooks/rules-of-hooks": "off", // Disabled due to false positives in Playwright fixtures
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off", // Disabled for valid state reset patterns
      "prefer-const": "warn",
    },
  }
);
