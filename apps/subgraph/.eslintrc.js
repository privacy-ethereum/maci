const path = require("path");

module.exports = {
  root: true,
  extends: ["../../.eslintrc.js"],
  parser: "@typescript-eslint/parser",
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
  rules: {
    "@typescript-eslint/consistent-type-imports": "off",
    "@typescript-eslint/no-shadow": [
      "error",
      {
        builtinGlobals: true,
        allow: [
          "BigInt",
          "location",
          "event",
          "history",
          "name",
          "status",
          "Option",
          "test",
          "expect",
          "describe",
          "afterEach",
          "beforeEach",
        ],
      },
    ],
  },
};
