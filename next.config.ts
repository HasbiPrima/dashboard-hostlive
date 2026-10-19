import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Frontend demo: data ada di browser (localStorage), jadi tidak butuh prerender/cache server.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
