import https from "node:https"
import os from "node:os"
import path from "node:path"

export class Config {
  public cwd = path.resolve(process.cwd())
  public cacheDir = path.join(getOsCacheDir(), "repo-collector")
  public agent = new https.Agent({
    keepAlive: true,
  })
}

function getOsCacheDir(): string {
  const cacheDirs = {
    posix: () => {
      return process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache")
    },
    darwin: () => {
      return path.join(os.homedir(), "Library", "Caches")
    },
    win32: () => {
      const appData =
        process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
      return path.join(appData, "Cache")
    },
  } as const

  switch (os.platform()) {
    case "darwin":
      return cacheDirs.darwin()
    case "win32":
      return cacheDirs.win32()
    case "linux":
      return cacheDirs.posix()
    default:
      throw new Error(`Unsupported OS platform: ${os.platform()}`)
  }
}
