import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("../../public", import.meta.url)),
  resolve: {
    alias: [
      {
        find: "next/link",
        replacement: fileURLToPath(new URL("./link.tsx", import.meta.url)),
      },
      {
        find: "next/navigation",
        replacement: fileURLToPath(new URL("./navigation.ts", import.meta.url)),
      },
      {
        find: "@/lib/supabase/browser",
        replacement: fileURLToPath(new URL("./supabase.ts", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("../../src", import.meta.url)),
      },
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  server: { host: "127.0.0.1", port: 3101, strictPort: true },
});
