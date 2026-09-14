import type * as React from "react"
import AikidoSvg from "./assets/icons/aikido"
import GitHubSvg from "./assets/icons/github"
import PrSvg from "./assets/icons/pr"
import RenovateSvg from "./assets/icons/renovate"
import SonarCloudSvg from "./assets/icons/sonarcloud"

// Inline SVG components (not a PNG or data-URI <img>) so they aren't blocked
// by the deployed `img-src 'self'` CSP, and `currentColor` icons still inherit
// the surrounding text color.
const iconProps = {
  width: 18,
  height: 18,
  className: "column-icon",
} as const

export const AikidoIcon: React.FC = () => <AikidoSvg {...iconProps} />
export const GitHubIcon: React.FC = () => <GitHubSvg {...iconProps} />
export const RenovateIcon: React.FC = () => <RenovateSvg {...iconProps} />
export const SonarCloudIcon: React.FC = () => <SonarCloudSvg {...iconProps} />
export const PrIcon: React.FC = () => <PrSvg {...iconProps} />
