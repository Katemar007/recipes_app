import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    ignores: [
      "**/node_modules/**",
      "dist/**",
      ".expo/**",
      "web-build/**",
      "coverage/**",
      "babel.config.js",
      "metro.config.js",
    ],
  },
  ...compat.extends("expo"),
  {
    files: ["app/**/*.{js,jsx,ts,tsx}", "src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/api/client.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Use apiFetch or fetchWithApiAuth from @/api/client (see module header).",
        },
      ],
    },
  },
];
