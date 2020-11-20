module.exports = {
  extends: "airbnb-typescript-prettier",
  parser: "@typescript-eslint/parser",
  parserOptions: {
      "project": "./tsconfig.json",
      "tsconfigRootDir": __dirname,
      "sourceType": "module"
  },
  env: {
    es6: true,
  },
  rules: {
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        "js": "never",
        "ts": "never"
      }
    ],
    "import/prefer-default-export": "off",
    "prefer-destructuring": "off",
    "prefer-template": "off",
    "eqeqeq": "off",
    "prefer-const": "off",
  }
}