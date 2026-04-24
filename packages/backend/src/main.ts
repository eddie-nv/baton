import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const port = Number(process.env["BATON_PORT"] ?? 3000);
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`baton backend listening on :${info.port}`);
});
