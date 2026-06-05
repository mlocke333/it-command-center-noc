import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages at https://<user>.github.io/<repo>/ set BASE_PATH in the
// deploy workflow (e.g. "/it-command-center-noc/"). Defaults to "/" locally.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react()],
});
