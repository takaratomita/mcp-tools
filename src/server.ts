import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lookupCorporateNumber } from "./houjin.js";
import { KKJ_SITE_URL, searchBids } from "./kkj.js";
import { keysOf, searchSupportOrgs, type SupportOrgDataset } from "./support-orgs.js";
import supportOrgsJson from "../data/support-orgs.json";

const MAX_RESULTS = 20;
const supportOrgs = supportOrgsJson as SupportOrgDataset;
keysOf(supportOrgs); // 検索キーを起動時に作っておく

export interface Env {
  HOUJIN_APP_ID?: string;
  HOUJIN_API_BASE?: string;
  KKJ_API_BASE?: string;
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
      annotations: { title: "Lookup Japanese corporate number", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
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

  server.registerTool(
    "search_support_orgs",
    {
      title: "Search Japanese registered support organizations (SSW)",
      description:
        "Search the Immigration Services Agency of Japan registry of Registered Support Organizations for Specified Skilled Workers. " +
        "Filter by name, location (prefecture/city in head office or support office address) and supported language. " +
        "Organizations that reported suspension are excluded unless includeSuspended is true. " +
        "出入国在留管理庁「登録支援機関登録簿」から、特定技能外国人の登録支援機関を名称・所在地・対応言語で検索します（同梱データ・基準日あり）。",
      inputSchema: {
        name: z.string().trim().max(100).optional().describe("Organization name, partial match / 名称（部分一致）"),
        location: z
          .string()
          .trim()
          .max(100)
          .optional()
          .describe("Prefecture or city, partial match on address / 所在地（例：東京都、横浜市。住所の部分一致）"),
        language: z.string().trim().max(50).optional().describe("Supported language in Japanese / 対応言語（例：ベトナム語、英語）"),
        includeSuspended: z.boolean().optional().describe("Include organizations that reported suspension / 支援業務休止の届出がある機関も含める"),
        limit: z.number().int().min(1).max(MAX_RESULTS).optional().describe(`Max results (default 10, max ${MAX_RESULTS}) / 最大件数`),
      },
      annotations: { title: "Search Japanese registered support organizations (SSW)", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      const r = searchSupportOrgs(args, supportOrgs);
      if (!r.ok) return { isError: true, content: [{ type: "text", text: r.error }] };
      const source =
        `出典：出入国在留管理庁「登録支援機関登録簿」（${supportOrgs.asOf}現在、${supportOrgs.sourceUrl}）を加工して作成。` +
        "最新の登録状況は同ページで確認してください。";
      const note =
        r.total > r.organizations.length
          ? `該当${r.total}件のうち先頭${r.organizations.length}件を表示しています。条件を絞って再検索してください。\n`
          : "";
      const text =
        r.total === 0
          ? `該当する登録支援機関は見つかりませんでした。\n\n${source}`
          : `${note}${JSON.stringify(r.organizations)}\n\n${source}`;
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "search_local_govt_bids",
    {
      title: "Search Japanese public procurement notices",
      description:
        "Search bid and tender notices from Japanese local governments and national agencies via the KKJ (官公需情報ポータルサイト) search API by the Small and Medium Enterprise Agency. " +
        "Filter by keywords (AND), prefecture, issuing organization and notice date. Returns title, organization, dates and the notice URL. " +
        "官公需情報ポータルサイトの検索APIで、自治体・国の機関の入札・公募情報をキーワード・都道府県・機関名・公告日で検索します。",
      inputSchema: {
        query: z.string().trim().max(200).optional().describe("Keywords separated by spaces (AND) / キーワード（空白区切りでAND）"),
        prefecture: z.string().trim().max(10).optional().describe("Prefecture name / 都道府県（例：東京都、大阪）"),
        organization: z.string().trim().max(100).optional().describe("Issuing organization, partial match / 機関名（部分一致。例：横浜市）"),
        since: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Notices issued on or after this date, YYYY-MM-DD (default: 30 days ago) / 公告日がこの日以降（既定：30日前）"),
        limit: z.number().int().min(1).max(MAX_RESULTS).optional().describe(`Max results (default 10, max ${MAX_RESULTS}) / 最大件数`),
      },
      annotations: { title: "Search Japanese public procurement notices", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (args) => {
      const r = await searchBids(args, { baseUrl: env.KKJ_API_BASE });
      if (!r.ok) return { isError: true, content: [{ type: "text", text: r.error }] };
      const source = `出典：官公需情報ポータルサイト（${KKJ_SITE_URL}）の検索APIを利用して取得。`;
      const note =
        r.total > r.bids.length
          ? `該当${r.total}件のうち先頭${r.bids.length}件を表示しています。条件を絞って再検索してください。\n`
          : "";
      const text =
        r.bids.length === 0
          ? `該当する入札・公募情報は見つかりませんでした。\n\n${source}`
          : `${note}${JSON.stringify(r.bids)}\n\n${source}`;
      return { content: [{ type: "text", text }] };
    },
  );

  return server;
}
