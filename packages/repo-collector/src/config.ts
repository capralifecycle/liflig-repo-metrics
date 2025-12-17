import https from "node:https"
import { homedir, platform } from "node:os"
import path from "node:path"

export class Config {
  public cwd = path.resolve(process.cwd())
  public cacheDir = (() => {
    const baseDir =
      platform() === "darwin"
        ? path.join(homedir(), "Library/Caches")
        : path.join(homedir(), ".cache")
    return path.join(baseDir, "cals-cli")
  })()
  public agent = new https.Agent({
    keepAlive: true,
  })
}
