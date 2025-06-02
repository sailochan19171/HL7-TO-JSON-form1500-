const path = require("path");

module.exports = {
  // Other Webpack configs (e.g., entry, output)
  resolve: {
    fallback: {
      path: require.resolve("path-browserify"),
      fs: false,
      stream: require.resolve("stream-browserify"),
      util: require.resolve("util/"),
      child_process: false,
    },
  },
};