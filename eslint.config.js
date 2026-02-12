const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  {
    files: ["backend/src/**/*.ts", "frontend/src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {},
  },
];
