import type * as React from "react"
import AikidoSvg from "./assets/icons/aikido.svg?react"
import GitHubSvg from "./assets/icons/github.svg?react"
import PrSvg from "./assets/icons/pr.svg?react"
import RenovateSvg from "./assets/icons/renovate.svg?react"
import SonarCloudSvg from "./assets/icons/sonarcloud.svg?react"

// SVGs are imported via vite-plugin-svgr (`?react`), which inlines them as
// React components. Inline SVG (not a PNG/data-URI <img>) so they aren't
// blocked by the deployed `img-src 'self'` CSP, and `currentColor` icons
// still inherit the surrounding text color.
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
