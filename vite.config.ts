import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Built for GitHub Pages at https://asadbl.github.io/sabal-grove/; the dev server stays at the root.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/sabal-grove/" : "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5190, host: true },
}));
