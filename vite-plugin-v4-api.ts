import { join } from "path";
import { pathToFileURL } from "url";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** Mount Vercel-style /api handlers during `vite dev` */
export function v4ApiDevPlugin(): Plugin {
  return {
    name: "clmm-api-dev",
    configureServer(server) {
      let clmmPoolsHandler: ApiHandler | null = null;
      let clmmSwapsHandler: ApiHandler | null = null;
      let clmmSyncHandler: ApiHandler | null = null;
      let zerionHandler: ApiHandler | null = null;

      const ready = (async () => {
        const root = process.cwd();
        clmmPoolsHandler = (await import(pathToFileURL(join(root, "api/clmm/pools.js")).href)).default;
        clmmSwapsHandler = (await import(pathToFileURL(join(root, "api/clmm/swaps.js")).href)).default;
        clmmSyncHandler = (await import(pathToFileURL(join(root, "api/cron/sync-clmm-pools.js")).href))
          .default;
        zerionHandler = (await import(pathToFileURL(join(root, "api/zerion.js")).href)).default;
      })();

      server.middlewares.use(async (req, res, next) => {
        await ready;
        const url = req.url?.split("?")[0];

        if (url === "/api/clmm/pools" && req.method === "GET" && clmmPoolsHandler) {
          await clmmPoolsHandler(req, res);
          return;
        }

        if (url === "/api/clmm/swaps" && req.method === "GET" && clmmSwapsHandler) {
          await clmmSwapsHandler(req, res);
          return;
        }

        if (url?.startsWith("/api/zerion") && req.method === "GET" && zerionHandler) {
          await zerionHandler(req, res);
          return;
        }

        if (url === "/api/cron/sync-clmm-pools" && clmmSyncHandler) {
          await clmmSyncHandler(req, res);
          return;
        }

        next();
      });
    },
  };
}
