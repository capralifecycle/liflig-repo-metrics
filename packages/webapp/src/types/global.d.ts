declare module "*.css" {
  const url: string
  export default url
}

declare module "*.module.css" {
  const classes: { [key: string]: string }
  export default classes
}
