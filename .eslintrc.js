const fs = require("fs");
const path = require("path");

const prettierConfig = fs.readFileSync(path.resolve(__dirname, "./.prettierrc"), "utf8");
const prettierOptions = JSON.parse(prettierConfig);
const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  root: true,
  extends: [
    "airbnb",
    "prettier",
    "plugin:import/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/strict",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:import/typescript",
  ],
  plugins: ["json", "prettier", "unused-imports", "import", "@typescript-eslint"],
  parser: "@typescript-eslint/parser",
  env: {
    node: true,
    mocha: true,
    es2022: true,
  },
  settings: {
    react: {
      version: "999.999.999",
    },
    "import/resolver": {
      typescript: {
        project: path.resolve(__dirname, "./tsconfig.json"),
      },
      node: {
        extensions: [".ts", ".js"],
        moduleDirectory: ["node_modules", "ts", "src"],
      },
    },
  },
  parserOptions: {
    project: path.resolve(__dirname, "./tsconfig.json"),
    sourceType: "module",
    typescript: true,
    ecmaVersion: 2022,
    experimentalDecorators: true,
    requireConfigFile: false,
    ecmaFeatures: {
      classes: true,
      impliedStrict: true,
    },
    warnOnUnsupportedTypeScriptVersion: true,
  },
  reportUnusedDisableDirectives: isProduction,
  rules: {
    "import/no-cycle": ["error"],
    "unused-imports/no-unused-imports": "error",
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: ["**/*.test.ts", "**/__benchmarks__/**", "**/tests/**", "**/__tests__/**"],
      },
    ],
    "no-debugger": isProduction ? "error" : "off",
    "no-console": "error",
    "no-underscore-dangle": "error",
    "no-redeclare": ["error", { builtinGlobals: true }],
    "import/order": [
      "error",
      {
        groups: ["external", "builtin", "internal", "type", "parent", "sibling", "index", "object"],
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
        warnOnUnassignedImports: true,
        "newlines-between": "always",
      },
    ],
    "prettier/prettier": ["error", prettierOptions],
    "import/prefer-default-export": "off",
    "import/extensions": ["error", { json: "always" }],
    "class-methods-use-this": "off",
    "prefer-promise-reject-errors": "off",
    "max-classes-per-file": "off",
    "no-use-before-define": ["off"],
    "no-shadow": "off",
    curly: ["error", "all"],
    "no-return-await": "off",

    "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "no-public" }],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/prefer-nullish-coalescing": "off",
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-module-boundary-types": "error",
    "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    "@typescript-eslint/no-use-before-define": ["error", { functions: false, classes: false }],
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    "@typescript-eslint/no-shadow": [
      "error",
      {
        builtinGlobals: true,
        allow: ["location", "event", "history", "name", "status", "Option", "test", "expect", "jest"],
      },
    ],
    "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
  },
};
