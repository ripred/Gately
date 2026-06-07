import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const configuredBasePath = process.env.GATELY_BASE_PATH?.trim();
const basePath =
    configuredBasePath && configuredBasePath !== "/"
        ? configuredBasePath.endsWith("/")
            ? configuredBasePath
            : `${configuredBasePath}/`
        : "/";

export default defineConfig({
    base: basePath,
    plugins: [solidPlugin(), tsconfigPaths(), tailwindcss()],
    server: {
        port: 3000,
    },
    esbuild: {
        tsconfigRaw: {
            compilerOptions: {
                experimentalDecorators: true,
            },
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            tsconfigRaw: {
                compilerOptions: {
                    experimentalDecorators: true,
                },
            },
        },
        include: ["@cnbn/engine"],
    },
    build: {
        target: "esnext",
        rollupOptions: {
            output: {
                manualChunks: undefined,
            },
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
            "@gately": path.resolve(__dirname, "src"),
        },
        dedupe: ["solid-js"],
    },
    worker: {
        format: "es",
    },
});
