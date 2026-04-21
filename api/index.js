// Vercel serverless function — delegates all requests to Expo Router server.
const { createRequestHandler } = require("expo-server/build/cjs/vendor/vercel");
const path = require("path");

module.exports = createRequestHandler({
  build: path.join(__dirname, "..", "dist", "server"),
});
