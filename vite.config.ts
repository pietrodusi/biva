import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app is hosted at https://pietrodusi.github.io/biva/, so assets must be
// served from the "/biva/" sub-path. For local `vite dev` the base is "/".
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/biva/" : "/",
  plugins: [react()],
}));
