import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

const H = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const post = (body: unknown) =>
  new Request("https://x.test/mcp", { method: "POST", headers: H, body: JSON.stringify(body) });

describe("worker", () => {
  it("/privacy はHTMLを返す", async () => {
    const r = await worker.fetch(new Request("https://x.test/privacy"), {});
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/html");
    expect(await r.text()).toContain("プライバシーポリシー");
  });
  it("/health は ok", async () => {
    const r = await worker.fetch(new Request("https://x.test/health"), {});
    expect(await r.json()).toEqual({ status: "ok" });
  });
  it("/mcp の GET は405（ステートレスでSSEを張らない）", async () => {
    const r = await worker.fetch(
      new Request("https://x.test/mcp", { headers: { accept: "text/event-stream" } }),
      {},
    );
    expect(r.status).toBe(405);
    expect(r.headers.get("allow")).toBe("POST");
  });
  it("未知のパスは404", async () => {
    const r = await worker.fetch(new Request("https://x.test/nope"), {});
    expect(r.status).toBe(404);
  });
  it("tools/list に lookup_corporate_number が出る（readOnlyHint付き）", async () => {
    const r = await worker.fetch(post({ jsonrpc: "2.0", id: 1, method: "tools/list" }), {});
    const j = (await r.json()) as { result: { tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] } };
    const t = j.result.tools.find((x) => x.name === "lookup_corporate_number");
    expect(t).toBeTruthy();
    expect(t?.annotations?.readOnlyHint).toBe(true);
  });
  it("tools/call はappId未設定でも isError で応答する", async () => {
    const r = await worker.fetch(
      post({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "lookup_corporate_number", arguments: { number: "7000012050002" } },
      }),
      {},
    );
    const j = (await r.json()) as { result: { isError?: boolean } };
    expect(j.result.isError).toBe(true);
  });
});
