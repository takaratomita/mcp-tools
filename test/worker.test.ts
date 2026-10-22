import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import supportOrgs from "../data/support-orgs.json";

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
  it("lookup_corporate_number の tools/call が法人情報と出典を返す", async () => {
    const xml = `<corporations><count>1</count><corporation><corporateNumber>7000012050002</corporateNumber><name>国税庁</name><prefectureName>東京都</prefectureName><cityName>千代田区</cityName><closeDate/></corporation></corporations>`;
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (u: string) => {
      calls.push(String(u));
      return new Response(xml);
    });
    try {
      const r = await worker.fetch(
        post({
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: { name: "lookup_corporate_number", arguments: { number: "7000012050002" } },
        }),
        { HOUJIN_APP_ID: "TEST" },
      );
      const j = (await r.json()) as { result: { isError?: boolean; content: { text: string }[] } };
      expect(j.result.isError).toBeFalsy();
      expect(j.result.content[0].text).toContain("国税庁");
      expect(j.result.content[0].text).toContain("出典：国税庁法人番号公表サイト");
      expect(calls[0]).toContain("api.houjin-bangou.nta.go.jp/4/num?");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("tools/list は3ツールを返し、すべて readOnlyHint 付き", async () => {
    const r = await worker.fetch(post({ jsonrpc: "2.0", id: 3, method: "tools/list" }), {});
    const j = (await r.json()) as { result: { tools: { name: string; annotations?: { readOnlyHint?: boolean } }[] } };
    expect(j.result.tools.map((t) => t.name).sort()).toEqual([
      "lookup_corporate_number",
      "search_local_govt_bids",
      "search_support_orgs",
    ]);
    for (const t of j.result.tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });
  it("tools/list は3ツールとも annotations.title を持つ", async () => {
    const r = await worker.fetch(post({ jsonrpc: "2.0", id: 5, method: "tools/list" }), {});
    const j = (await r.json()) as { result: { tools: { name: string; annotations?: { title?: string } }[] } };
    expect(j.result.tools).toHaveLength(3);
    for (const t of j.result.tools) expect(t.annotations?.title, t.name).toMatch(/\S/);
  });
  it("search_support_orgs は同梱の登録簿から検索し出典を付ける", async () => {
    const r = await worker.fetch(
      post({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "search_support_orgs", arguments: { location: "東京都", language: "ベトナム語", limit: 3 } },
      }),
      {},
    );
    const j = (await r.json()) as { result: { isError?: boolean; content: { text: string }[] } };
    expect(j.result.isError).toBeFalsy();
    const text = j.result.content[0].text;
    expect(text).toMatch(/該当\d+件のうち先頭3件/);
    expect(text).toContain(`出典：出入国在留管理庁「登録支援機関登録簿」（${supportOrgs.asOf}現在、`);
    const orgs = JSON.parse(text.split("\n")[1]) as { address: string; officeAddress: string; languages: string }[];
    expect(orgs).toHaveLength(3);
    for (const o of orgs) {
      expect(o.address + o.officeAddress).toContain("東京都");
      expect(o.languages).toContain("ベトナム語");
    }
  });
  it("search_support_orgs は条件なしで isError", async () => {
    const r = await worker.fetch(
      post({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "search_support_orgs", arguments: {} } }),
      {},
    );
    const j = (await r.json()) as { result: { isError?: boolean } };
    expect(j.result.isError).toBe(true);
  });
  describe("search_local_govt_bids", () => {
    const XML = `<?xml version="1.0" encoding="utf-8" ?><Results><Version>1.0</Version><SearchResults><SearchHits>1</SearchHits><SearchResult><ResultId>1</ResultId><Key><![CDATA[k]]></Key><ExternalDocumentURI><![CDATA[https://www.city.toshima.lg.jp/a.pdf]]></ExternalDocumentURI><ProjectName>庁舎清掃業務委託</ProjectName><Date>2026-10-09T19:11:42+09:00</Date><PrefectureName>東京都</PrefectureName><OrganizationName>東京都豊島区</OrganizationName><CftIssueDate>2026-10-09T00:00:00+09:00</CftIssueDate><Category>役務</Category></SearchResult></SearchResults></Results>`;
    afterEach(() => vi.unstubAllGlobals());

    it("tools/call が官公需APIの結果と出典を返す", async () => {
      const calls: string[] = [];
      vi.stubGlobal("fetch", async (u: string) => {
        calls.push(String(u));
        return new Response(XML);
      });
      const r = await worker.fetch(
        post({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: { name: "search_local_govt_bids", arguments: { query: "清掃", prefecture: "東京都" } },
        }),
        {},
      );
      const j = (await r.json()) as { result: { isError?: boolean; content: { text: string }[] } };
      expect(j.result.isError).toBeFalsy();
      const text = j.result.content[0].text;
      expect(text).toContain("庁舎清掃業務委託");
      // 官公需情報ポータルサイト利用規約：API利用の明記とポータルへのリンクが必須
      expect(text).toContain("官公需情報ポータルサイト（https://www.kkj.go.jp/s/）の検索APIを利用");
      expect(calls[0]).toContain("www.kkj.go.jp/api/");
      expect(calls[0]).toContain("LG_Code=13");
    });
    it("上流の障害は isError で返す", async () => {
      vi.stubGlobal("fetch", async () => new Response("x", { status: 503 }));
      const r = await worker.fetch(
        post({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: { name: "search_local_govt_bids", arguments: { query: "清掃" } },
        }),
        {},
      );
      const j = (await r.json()) as { result: { isError?: boolean } };
      expect(j.result.isError).toBe(true);
    });
  });
});
