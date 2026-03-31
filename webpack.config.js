const path = require("path");
const webpack = require("webpack");

module.exports = {
  mode: "production",
  target: "web",
  entry: "./src/embedder.js",
  devtool: 'source-map',

  output: {
    path: process.env.BUILD_PATH || path.resolve(__dirname, "dist"),
    filename: "embedder.min.js",
    module: true, //
    chunkFormat: "module",
    library: { type: "module" },
  },

  experiments: {
    outputModule: true,
  },

  optimization: {
    splitChunks: false,
    runtimeChunk: false,
    minimize: false,
  },
  plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
};
