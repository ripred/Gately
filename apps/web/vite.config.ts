import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import packageJson from "./package.json";

const configuredBasePath = process.env.GATELY_BASE_PATH?.trim();
const basePath =
    configuredBasePath && configuredBasePath !== "/"
        ? configuredBasePath.endsWith("/")
            ? configuredBasePath
            : `${configuredBasePath}/`
        : "/";

export default defineConfig({
    base: basePath,
    define: {
        __GATELY_APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [solidPlugin(), tailwindcss()],
    server: {
        port: 3000,
    },
    optimizeDeps: {
        include: ["@cnbn/engine"],
    },
    build: {
        target: "esnext",
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: undefined,
            },
        },
    },
    resolve: {
        tsconfigPaths: true,
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
