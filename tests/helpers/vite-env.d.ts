// The root test project type-checks web/src modules that rely on Vite's
// `import.meta.env`; declare it here since vite/client types live in web/.
interface ImportMeta {
  readonly env: Record<string, string | boolean | undefined>;
}
