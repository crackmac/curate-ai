import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // onnxruntime-node's libonnxruntime.so is dlopen'd by its native addon, so
  // @vercel/nft's static trace misses it and only copies the .node binding.
  outputFileTracingIncludes: {
    "/api/curate": ["./node_modules/onnxruntime-node/bin/**/*"],
    "/api/preferences/topic-scores": ["./node_modules/onnxruntime-node/bin/**/*"],
  },
};

export default nextConfig;
