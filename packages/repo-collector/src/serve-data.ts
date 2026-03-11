import { join, resolve, sep } from "node:path"

const dataDir = resolve(join(import.meta.dirname, "..", "data"))

Bun.serve({
  port: 8383,
  async fetch(req) {
    const url = new URL(req.url)
    const resolved = resolve(join(dataDir, url.pathname))

    if (!resolved.startsWith(dataDir + sep)) {
      return new Response("Forbidden", { status: 403 })
    }

    const file = Bun.file(resolved)
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.log(`Serving files from ${dataDir} on http://localhost:8383`)
