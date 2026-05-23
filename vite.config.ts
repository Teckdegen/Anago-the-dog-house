import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { v4ApiDevPlugin } from "./vite-plugin-v4-api";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const blockVisionKey = env.BLOCKVISION_API_KEY || env.VITE_BLOCKVISION_API_KEY;

  return {
    plugins: [
      TanStackRouterVite({ autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      tsconfigPaths(),
      v4ApiDevPlugin(),
    ],
    server: {
      proxy: blockVisionKey
        ? {
            "/bv": {
              target: "https://api.blockvision.org",
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/bv/, "/v2"),
              configure: (proxy) => {
                proxy.on("proxyReq", (proxyReq) => {
                  proxyReq.setHeader("x-api-key", blockVisionKey);
                });
              },
            },
          }
        : undefined,
    },
  };
});
