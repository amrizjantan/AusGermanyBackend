import globals from "globals";
import js from "@eslint/js";
import requireFileExtensionPlugin from "./eslint-custom-rules/index.js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      "require-file-extension": requireFileExtensionPlugin,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: 'CallExpression[callee.name="require"]',
          message: "Unexpected require() call. Use import instead.",
        },
      ],
      "require-file-extension/require-file-extension": "error",
      "no-console": ["error", { allow: ["error", "warn", "debug", "info"] }],
    },
  },
];
