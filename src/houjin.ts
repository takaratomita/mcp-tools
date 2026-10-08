const BASE = "https://api.houjin-bangou.nta.go.jp/4";

export interface Corporation {
  corporateNumber: string;
  name: string;
  furigana: string;
  kind: string;
  prefecture: string;
  city: string;
  streetNumber: string;
  postCode: string;
  updateDate: string;
  closed: boolean;
}

export type LookupResult =
  | { ok: true; corporations: Corporation[]; total: number }
  | { ok: false; error: string };

export interface LookupDeps {
  appId?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

/** 法人番号のチェックデジット検証（先頭1桁が検査用数字）。 */
export function isValidCorporateNumber(n: string): boolean {
  if (!/^\d{13}$/.test(n)) return false;
  const body = n.slice(1);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(body[11 - i]);
    sum += digit * (i % 2 === 0 ? 1 : 2);
  }
  return 9 - (sum % 9) === Number(n[0]);
}

const tag = (xml: string, name: string): string => {
  const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return m ? decodeEntities(m[1]) : "";
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

export function parseHoujinXml(xml: string): Corporation[] {
  const blocks = xml.match(/<corporation>[\s\S]*?<\/corporation>/g) ?? [];
  return blocks.map((b) => ({
    corporateNumber: tag(b, "corporateNumber"),
    name: tag(b, "name"),
    furigana: tag(b, "furigana"),
    kind: tag(b, "kind"),
    prefecture: tag(b, "prefectureName"),
    city: tag(b, "cityName"),
    streetNumber: tag(b, "streetNumber"),
    postCode: tag(b, "postCode"),
    updateDate: tag(b, "updateDate"),
    closed: tag(b, "closeDate") !== "",
  }));
}

export async function lookupCorporateNumber(
  input: { number?: string; name?: string },
  deps: LookupDeps,
): Promise<LookupResult> {
  if (!deps.appId) {
    return { ok: false, error: "サーバーに法人番号APIのアプリケーションIDが設定されていません。" };
  }
  const number = input.number
    ?.normalize("NFKC")
    .replace(/[\s\-ー−]/g, "")
    .replace(/^T/i, "");
  const name = input.name?.trim();
  if (number && name) {
    return { ok: false, error: "number と name は同時に指定できません。どちらか一方にしてください。" };
  }
  let path: string;
  if (number) {
    if (!isValidCorporateNumber(number)) {
      return { ok: false, error: "法人番号が不正です（13桁・チェックデジット不一致）。" };
    }
    path = `num?id=${encodeURIComponent(deps.appId)}&number=${number}&type=12&history=0`;
  } else if (name) {
    path = `name?id=${encodeURIComponent(deps.appId)}&name=${encodeURIComponent(name)}&type=12&mode=2&target=1&kind=01&kind=02&kind=03&kind=04&change=0&close=0`;
  } else {
    return { ok: false, error: "number（法人番号13桁）か name（法人名）のどちらかを指定してください。" };
  }
  const f = deps.fetch ?? fetch;
  const base = deps.baseUrl ?? BASE;
  let xml: string;
  try {
    const res = await f(`${base}/${path}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, error: `国税庁APIがエラーを返しました（HTTP ${res.status}）。` };
    xml = await res.text();
  } catch {
    return { ok: false, error: "国税庁APIへの接続に失敗しました（タイムアウトを含む）。" };
  }
  if (!xml.includes("<corporations")) {
    return { ok: false, error: "国税庁APIから想定外の応答が返りました。" };
  }
  const corporations = parseHoujinXml(xml);
  const total = Number(tag(xml, "count")) || corporations.length;
  return { ok: true, corporations, total };
}
