/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: { node: true, es2022: true, browser: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.base.json", "apps/bot/tsconfig.json", "apps/controls/tsconfig.json", "packages/core/tsconfig.json", "packages/db/tsconfig.json", "packages/discord-ui/tsconfig.json"],
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
  },
  overrides: [
    {
      files: ["apps/bot/**/*.ts"],
      rules: { "no-console": "off" },
    },
  ],
};
