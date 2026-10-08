import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer, type Env } from "./server.js";
import { PRIVACY_HTML } from "./privacy.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/health") return json({ status: "ok" });
    if (pathname === "/privacy" || pathname === "/") {
      return new Response(PRIVACY_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (pathname === "/mcp") {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
      }
      // ステートレス運用：リクエストごとにサーバーとtransportを作る
      const server = createServer(env);
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      return transport.handleRequest(req);
    }
    return json({ error: "not found" }, 404);
  },
};
