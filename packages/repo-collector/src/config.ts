import https from "node:https"
import path from "node:path"
import cachedir from "cachedir"

export class Config {
  public cwd = path.resolve(process.cwd())
  public cacheDir = cachedir("cals-cli")
  public agent = new https.Agent({
    keepAlive: true,
  })
}
