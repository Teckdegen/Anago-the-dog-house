import { join } from "path";
import { pathToFileURL } from "url";
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** Mount Vercel-style /api handlers during `vite dev` */
export function v4ApiDevPlugin(): Plugin {
  return {
    name: "v4-api-dev",
    configureServer(server) {
      let poolsHandler: ApiHandler | null = null;
      let subgraphHandler: ApiHandler | null = null;

      const ready = (async () => {
        const root = process.cwd();
        poolsHandler = (await import(pathToFileURL(join(root, "api/v4-pools.js")).href)).default;
        subgraphHandler = (await import(pathToFileURL(join(root, "api/v4-subgraph.js")).href)).default;
      })();

      server.middlewares.use(async (req, res, next) => {
        await ready;
        const url = req.url?.split("?")[0];

        if (url === "/api/v4-pools" && req.method === "GET" && poolsHandler) {
          await poolsHandler(req, res);
          return;
        }

        if (url === "/api/v4-subgraph" && req.method === "POST" && subgraphHandler) {
          const body = await readBody(req);
          try {
            (req as IncomingMessage & { body?: unknown }).body = JSON.parse(body);
          } catch {
            (req as IncomingMessage & { body?: unknown }).body = {};
          }
          await subgraphHandler(req, res);
          return;
        }

        if (url === "/api/v4-subgraph" && req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        next();
      });
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
