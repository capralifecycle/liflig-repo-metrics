import index from "./index.html"

/** Where `task serve-local-data` serves the collected data. */
const dataOrigin = "http://localhost:8383"

const server = Bun.serve({
  port: 3000,
  hostname: "127.0.0.1",
  development: { hmr: true },
  routes: {
    "/data/*": (req) => {
      const { pathname, search } = new URL(req.url)
      const path = pathname.slice("/data".length)
      return fetch(`${dataOrigin}${path}${search}`)
    },
    "/*": index,
  },
})

console.log(`Listening on ${server.url}`)
