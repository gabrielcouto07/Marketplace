import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Restringe fetch direto fora da camada de API.
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Use os hooks em features/*/api (camada http em lib/api). Componentes não chamam fetch.",
        },
      ],
    },
  },
  {
    files: ["src/lib/api/**", "src/mocks/**", "scripts/**", "src/sw.ts"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    // Código gerado pelo shadcn CLI: não reescrevemos para satisfazer a regra do React Compiler.
    files: ["src/components/ui/**"],
    rules: { "react-hooks/set-state-in-effect": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
    "public/mockServiceWorker.js",
  ]),
]);

export default eslintConfig;
