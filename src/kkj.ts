import { prefectureCode } from "./prefectures.js";

/** 官公需情報ポータルサイト 検索API（中小企業庁）。仕様: https://www.kkj.go.jp/doc/ja/api_guide.pdf */
const BASE = "https://www.kkj.go.jp/api/";
export const KKJ_SITE_URL = "https://www.kkj.go.jp/s/";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const DEFAULT_DAYS = 30;

export interface Bid {
  projectName: string;
  organization: string;
  prefecture: string;
  city: string;
  category: string;
  procedureType: string;
  issueDate: string;
  tenderStartDate: string;
  openingDate: string;
  deliveryDeadline: string;
  url: string;
}

export type BidSearchResult = { ok: true; bids: Bid[]; total: number } | { ok: false; error: string };

export interface BidSearchInput {
  query?: string;
  prefecture?: string;
  organization?: string;
  since?: string;
  limit?: number;
}

export interface BidSearchDeps {
  baseUrl?: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

/** 空白区切りの語を AND で結ぶ。演算子語と括弧は構文エラーの元なので除く。 */
const buildQuery = (q: string): string =>
  q
    .normalize("NFKC")
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["AND", "OR", "NOT", "ANDNOT"].includes(w.toUpperCase()))
    .join(" AND ");

export function buildKkjUrl(
  p: { query?: string; prefecture?: string; organization?: string; since: string; limit: number },
  base = BASE,
): string {
  const url = new URL(base);
  const q = p.query ? buildQuery(p.query) : "";
  if (q) url.searchParams.set("Query", q);
  if (p.organization) url.searchParams.set("Organization_Name", p.organization);
  const lg = p.prefecture ? prefectureCode(p.prefecture) : undefined;
  if (lg) url.searchParams.set("LG_Code", lg);
  url.searchParams.set("CFT_Issue_Date", `${p.since}/`);
  url.searchParams.set("Count", String(p.limit));
  return url.toString();
}

/** CDATA は中身をそのまま返し、それ以外は実体参照を戻す。 */
const decode = (raw: string): string => {
  const s = raw.trim();
  const cdata = s.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) return cdata[1].trim();
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
};

/** 公告URLは第三者由来のため http(s) 以外は落とす。 */
const safeUrl = (u: string): string => (/^https?:\/\//i.test(u) ? u : "");

const tag = (xml: string, name: string): string => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
};

export function parseKkjXml(xml: string): Bid[] {
  // 公告文と添付は大きく出力に使わないので、タグ抽出の前に落とす
  const blocks = (xml.match(/<SearchResult>[\s\S]*?<\/SearchResult>/g) ?? []).map((b) =>
    b.replace(/<ProjectDescription>[\s\S]*?<\/ProjectDescription>/, "").replace(/<Attachments>[\s\S]*?<\/Attachments>/, ""),
  );
  return blocks.map((b) => ({
    projectName: tag(b, "ProjectName"),
    organization: tag(b, "OrganizationName"),
    prefecture: tag(b, "PrefectureName"),
    city: tag(b, "CityName"),
    category: tag(b, "Category"),
    procedureType: tag(b, "ProcedureType"),
    issueDate: (tag(b, "CftIssueDate") || tag(b, "Date")).slice(0, 10),
    // API仕様上 TenderSubmissionDeadline は「入札開始日」、PeriodEndTime は「納入期限日」
    tenderStartDate: tag(b, "TenderSubmissionDeadline").slice(0, 10),
    openingDate: tag(b, "OpeningTendersEvent").slice(0, 10),
    deliveryDeadline: tag(b, "PeriodEndTime").slice(0, 10),
    url: safeUrl(tag(b, "ExternalDocumentURI")),
  }));
}

/** JST の日付（YYYY-MM-DD）。 */
const jstDate = (d: Date): string => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

export async function searchBids(input: BidSearchInput, deps: BidSearchDeps = {}): Promise<BidSearchResult> {
  const query = input.query?.trim();
  const organization = input.organization?.trim();
  const prefecture = input.prefecture?.trim();
  if (prefecture && !prefectureCode(prefecture)) {
    return { ok: false, error: `都道府県名を認識できません：${prefecture}（例：東京都・大阪府・北海道）` };
  }
  if (!(query && buildQuery(query)) && !organization && !prefecture) {
    return { ok: false, error: "query（キーワード）・organization（機関名）・prefecture（都道府県）のいずれかを指定してください。" };
  }
  const now = (deps.now ?? (() => new Date()))();
  const since = input.since?.trim() || jstDate(new Date(now.getTime() - DEFAULT_DAYS * 86400_000));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || Number.isNaN(Date.parse(since))) {
    return { ok: false, error: "since は YYYY-MM-DD 形式で指定してください。" };
  }
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const url = buildKkjUrl({ query, prefecture, organization, since, limit }, deps.baseUrl ?? BASE);
  const f = deps.fetch ?? fetch;
  let xml: string;
  try {
    const res = await f(url, { headers: { "User-Agent": "mcp-tools/0.1" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { ok: false, error: `官公需情報ポータルサイトAPIがエラーを返しました（HTTP ${res.status}）。` };
    xml = await res.text();
  } catch {
    return { ok: false, error: "官公需情報ポータルサイトAPIへの接続に失敗しました（タイムアウトを含む）。" };
  }
  if (!xml.includes("<Results")) {
    return { ok: false, error: "官公需情報ポータルサイトAPIから想定外の応答が返りました。" };
  }
  const apiError = tag(xml, "Error");
  if (apiError) return { ok: false, error: `官公需情報ポータルサイトAPIのエラー：${apiError}` };
  const bids = parseKkjXml(xml);
  const total = Number(tag(xml, "SearchHits")) || bids.length;
  return { ok: true, bids, total };
}
