import react from "@vitejs/plugin-react"
import checker from "vite-plugin-checker"
import { GitRevisionPlugin } from "git-revision-webpack-plugin"
import path from "path"
import { defineConfig } from "vite"
import packageJson from "./package.json"

const commitHash = new GitRevisionPlugin({
  commithashCommand: "rev-parse --short HEAD",
}).commithash()

const uploadToSentry =
  "SENTRY_PROJECT" in process.env && "SENTRY_RELEASE" in process.env
const sentryRelease = process.env.SENTRY_RELEASE

export default (env: any) => {
  return defineConfig({
    plugins: [
      react(),
      checker({
        typescript: true,
        eslint: { lintCommand: 'eslint "./src/**/*.{ts,tsx}"' },
        overlay: { initialIsOpen: false },
      }),
    ],
    define: {
      __BUILD_INFO__: JSON.stringify({
        appName: packageJson.name,
        appBuildTime: new Date().toISOString(),
        commitHash: new GitRevisionPlugin({
          commithashCommand: "rev-parse --short HEAD",
        }).commithash(),
      }),
    },
    build: {
      outDir: path.resolve(__dirname, "build"),
      sourcemap: "hidden",
    },
    preview: {
      port: 3000,
      proxy: {
        "/data": {
          target: "http://localhost:8383/",

          rewrite: (it) => it.replace("data/", ""),
        },
      },
    },
    server: {
      host: "127.0.0.1",
      port: 3000,
      proxy: {
        "/data": {
          target: "http://localhost:8383/",
          rewrite: (it) => it.replace("data/", ""),
        },
      },
    },
  })
}
