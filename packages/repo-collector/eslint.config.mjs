import eslint from "@eslint/js"
import prettierPluginRecommended from "eslint-plugin-prettier/recommended"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: ["dist/", "jest.config.cjs", "keytar-stub.js"],
  },
  {
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      // Must be last to override other rules
      prettierPluginRecommended,
    ],

    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
)
