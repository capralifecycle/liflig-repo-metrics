// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path")

module.exports = {
  mode: "production",
  target: "node",
  node: {
    __dirname: false,
  },
  entry: {
    index: "./src/lambda.ts",
  },
  resolve: {
    alias: {
      // keytar is a dependency of cals-cli that uses a compiled binary
      // for providing native keychain access. Since we do not use the
      // keychain we stub the package as we cannot include a compiled binary.
      keytar: path.resolve(__dirname, "keytar-stub.js"),
    },
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
  externals: [
    /^aws-sdk/,
    // /^keytar$/,
  ],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs",
  },
}
