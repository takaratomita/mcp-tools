import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lookupCorporateNumber } from "./houjin.js";

const MAX_RESULTS = 20;

export interface Env {
  HOUJIN_APP_ID?: string;
  HOUJIN_API_BASE?: string;
}

export function createServer(env: Env): McpServer {
  const server = new McpServer({ name: "mcp-tools-japan-public-data", version: "0.1.0" });

  server.registerTool(
    "lookup_corporate_number",
    {
      title: "Lookup Japanese corporate number",
      description:
        "Look up Japanese companies in the National Tax Agency Corporate Number Publication Site. " +
        "Search by 13-digit corporate number, or by company name. Returns name, address and status. " +
        "国税庁 法人番号公表サイトから、法人番号（13桁）または法人名で法人情報（名称・所在地・閉鎖有無）を検索します。",
      inputSchema: {
        number: z.string().optional().describe("13-digit corporate number / 法人番号（13桁）"),
        name: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Company name, partial match, closed companies excluded / 法人名（部分一致・閉鎖法人は対象外）。number とは同時指定不可"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      const r = await lookupCorporateNumber(args, {
        appId: env.HOUJIN_APP_ID,
        baseUrl: env.HOUJIN_API_BASE,
      });
      if (!r.ok) return { isError: true, content: [{ type: "text", text: r.error }] };
      const shown = r.corporations.slice(0, MAX_RESULTS);
      const note =
        r.total > shown.length
          ? `該当${r.total}件のうち先頭${shown.length}件を表示しています。条件を絞って再検索してください。\n`
          : "";
      const text =
        shown.length === 0
          ? "該当する法人は見つかりませんでした（名称検索では閉鎖済み法人は対象外です）。"
          : note +
            JSON.stringify(shown) +
            "\n\n出典：国税庁法人番号公表サイト（https://www.houjin-bangou.nta.go.jp/）";
      return { content: [{ type: "text", text }] };
    },
  );

  return server;
}
