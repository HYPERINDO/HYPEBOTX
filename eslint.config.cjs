module.exports = {
    ignores: ["node_modules/**", "logs/**", "data/**", "dist/**", "build/**", "backup/**"],
    languageOptions: {
        ecmaVersion: 2024,
        sourceType: "script",
        globals: {
            process: "readonly",
            module: "readonly",
            exports: "readonly",
            require: "readonly",
            __dirname: "readonly",
            __filename: "readonly",
            setTimeout: "readonly",
            clearTimeout: "readonly",
            setInterval: "readonly",
            clearInterval: "readonly",
            URL: "readonly",
            Buffer: "readonly",
            console: "readonly",
            globalThis: "readonly"
        }
    },
    rules: {
        "no-undef": "error",
        "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
        "no-console": "off"
    }
};
