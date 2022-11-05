import { defineConfig } from "tsup";

export default defineConfig({
  entryPoints: ["src/main.ts"],
  format: ["esm", "cjs"],
  splitting: true,
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
});
