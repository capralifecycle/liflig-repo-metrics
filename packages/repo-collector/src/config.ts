import cachedir from "cachedir"
import https from "https"
import path from "path"

export class Config {
  public cwd = path.resolve(process.cwd())
  public cacheDir = cachedir("cals-cli")
  public agent = new https.Agent({
    keepAlive: true,
  })
}
