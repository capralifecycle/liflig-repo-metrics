import { rm } from "node:fs/promises"

await rm("./build", { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./build",
  minify: true,
  sourcemap: "external",
  publicPath: "/",
  naming: {
    chunk: "assets/index-[hash].[ext]",
    asset: "assets/index-[hash].[ext]",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
})

if (!result.success) {
  for (const log of result.logs) {
    console.error(log)
  }
  process.exit(1)
}

for (const output of result.outputs) {
  console.log(output.path.replace(`${process.cwd()}/`, ""), output.size)
}
