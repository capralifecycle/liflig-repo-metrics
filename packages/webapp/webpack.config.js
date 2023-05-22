/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
const path = require("path")
const { CleanWebpackPlugin } = require("clean-webpack-plugin")
const HtmlWebpackPlugin = require("html-webpack-plugin")
const { GitRevisionPlugin } = require("git-revision-webpack-plugin")
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin
const webpack = require("webpack")

const packageJson = require("./package.json")

module.exports = (env) => {
  const isProd = env.production

  const config = {
    entry: "./src/index.tsx",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "babel-loader",
              options: {
                presets: [["@babel/preset-env", { targets: "defaults" }]],
              },
            },
            {
              loader: "ts-loader",
              options: {
                transpileOnly: true,
              },
            },
          ],
        },
        {
          test: /\.(ts|tsx)$/,
          use: "ts-loader",
          include: path.resolve(__dirname, "src"),
        },
        {
          test: /\.(svg|png)$/i,
          use: "url-loader",
        },
        {
          test: /(?<!\.module)\.css$/,
          include: path.resolve(__dirname, "src"),
          use: ["style-loader", "css-loader", "postcss-loader"],
        },
        {
          test: /\.module\.css$/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                importLoaders: 1,
                modules: {
                  localIdentName: "[name]__[local]__[hash:base64:5]",
                },
              },
            },
            "postcss-loader",
          ],
        },
      ],
    },
    resolve: {
      extensions: ["*", ".js", ".jsx", ".ts", ".tsx", ".css"],
    },
    output: {
      filename: "[name].[contenthash].js",
      path: path.resolve(__dirname, "build"),
    },
    optimization: {
      splitChunks: {
        chunks: "all",
        automaticNameDelimiter: "-",
      },
      runtimeChunk: {
        name: "manifest",
      },
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: "./src/index.html",
      }),
      new webpack.DefinePlugin({
        __BUILD_INFO__: JSON.stringify({
          appName: packageJson.name,
          appBuildTime: new Date().toISOString(),
          commitHash: new GitRevisionPlugin({
            commithashCommand: "rev-parse --short HEAD",
          }).commithash(),
        }),
      }),
    ],
  }

  if (isProd) {
    return {
      ...config,
      mode: "production",
      devtool: "source-map",
      performance: {
        // https://web.dev/your-first-performance-budget/#budget-for-quantity-based-metrics
        hints: "warning",
        maxEntrypointSize: 170 * 1024,
        maxAssetSize: 450 * 1024,
      },
      plugins: [
        ...config.plugins,
        process.env.ANALYZE &&
          new BundleAnalyzerPlugin({
            generateStatsFile: true,
            analyzerMode: "disabled",
          }),
      ].filter(Boolean),
    }
  }

  // Configuration specific to developing locally
  return {
    ...config,
    mode: "development",
    devtool: "eval-source-map",
    devServer: {
      static: {
        directory: "./build",
      },
      port: 3000,
      historyApiFallback: true,
      proxy: {
        // See "serve" in repo-collector.
        "/data": {
          target: "http://localhost:8383/",
          pathRewrite: { "^/data": "" },
        },
      },
    },
    module: {
      rules: [
        ...config.module.rules,
        {
          enforce: "pre",
          test: /\.*js$/,
          loader: "source-map-loader",
        },
      ],
    },
  }
}
