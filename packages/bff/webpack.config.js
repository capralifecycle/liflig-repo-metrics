// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path")

module.exports = {
  mode: "production",
  target: "node",
  node: {
    __dirname: false,
  },
  entry: {
    "auth/index": "./src/handlers/auth.ts",
    "main/index": "./src/handlers/main.ts",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  externals: [/^aws-sdk/],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs",
  },
}
