export enum Environment {
  LOCAL = "LOCAL",
  DEV = "DEV",
  STAGING = "STAGING",
  PROD = "PROD",
}

interface IAppConfiguration {
  apiUrl: string
  environment: Environment
}

type IEnvToConfigMap = {
  [key in Environment]: IAppConfiguration
}

const envToConfigMap: IEnvToConfigMap = {
  [Environment.LOCAL]: {
    apiUrl: "http://localhost:8080",
    environment: Environment.LOCAL,
  },
  [Environment.DEV]: {
    apiUrl: "",
    environment: Environment.DEV,
  },
  [Environment.STAGING]: {
    apiUrl: "",
    environment: Environment.STAGING,
  },
  [Environment.PROD]: {
    apiUrl: "",
    environment: Environment.PROD,
  },
}

export const getEnvironment = (origin: string): Environment => {
  if (/^https:\/\/(www\.){0,1}dev/.test(origin)) {
    return Environment.DEV
  } else if (/^https:\/\/(www\.){0,1}staging/.test(origin)) {
    return Environment.STAGING
  } else if (/^https:\/\//.test(origin)) {
    return Environment.PROD
  }

  return Environment.LOCAL
}

export const getConfig = (
  origin: string = window.origin,
): IAppConfiguration => {
  const environment = getEnvironment(origin)

  return envToConfigMap[environment]
}
