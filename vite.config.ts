import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths(),
    tanstackStart({
      server: {
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        entry: "server",
      },
    }),
    react(),
  ],
});
