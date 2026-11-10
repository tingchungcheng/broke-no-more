import { serve } from "@hono/node-server";
import { app } from "./app";
import { processEnv } from "./db";

const env = processEnv();
const port = Number(process.env.PORT ?? 8787);

serve({
  fetch: (request) => app.fetch(request, env),
  port,
  hostname: "127.0.0.1",
});

console.log(`API listening on http://127.0.0.1:${port}`);
