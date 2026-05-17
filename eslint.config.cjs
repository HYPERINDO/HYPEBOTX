const commonGlobals = {
  process: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  fetch: "readonly",
  Buffer: "readonly",
  Intl: "readonly",
  globalThis: "readonly",
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "**/node_modules/**",
      "**/logs/**",
      "**/data/**",
      "**/dist/**",
      "**/build/**",
      "**/backup/**",
      "apps/bot/src/storage/**",
    ],
  },
  {
    files: ["apps/bot/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: {
        ...commonGlobals,
        module: "readonly",
        exports: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    files: [
      "apps/dashboard-backend/**/*.js",
      "apps/dashboard-frontend/**/*.js",
      "apps/dashboard-frontend/**/*.jsx",
      "packages/shared/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...commonGlobals,
        document: "readonly",
        window: "readonly",
        location: "readonly",
        localStorage: "readonly",
        FormData: "readonly",
        AbortController: "readonly",
        navigator: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
];
