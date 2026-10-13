/** 出入国在留管理庁「登録支援機関登録簿」の同梱データを検索する。データは scripts/build_support_orgs.py で生成する。 */

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

export interface SupportOrg {
  registrationNumber: string;
  registeredOn: string;
  name: string;
  postCode: string;
  address: string;
  phone: string;
  officeName: string;
  officeAddress: string;
  languages: string;
  optionalSupport: boolean;
  remarks: string;
}

export interface SupportOrgDataset {
  asOf: string;
  sourceUrl: string;
  organizations: SupportOrg[];
}

export interface SupportOrgSearchInput {
  name?: string;
  location?: string;
  language?: string;
  includeSuspended?: boolean;
  limit?: number;
}

export type SupportOrgSearchResult =
  | { ok: true; organizations: SupportOrg[]; total: number }
  | { ok: false; error: string };

const norm = (s: string): string => s.normalize("NFKC").replace(/\s/g, "").toLowerCase();
// 同梱データは生成時に NFKC 済みなので、検索キー作成では NFKC を省く（11,660件で 137ms→49ms。node 実測）
const normData = (s: string): string => s.replace(/\s/g, "").toLowerCase();

interface Keys {
  name: string;
  location: string;
  language: string;
  suspended: boolean;
}

// 正規化済みの検索キーはデータセットごとに1回だけ作る。
// 起動時（モジュール評価時）に呼べば、初回リクエストのCPU時間に載らない
const keyCache = new WeakMap<SupportOrgDataset, Keys[]>();
export const keysOf = (data: SupportOrgDataset): Keys[] => {
  let keys = keyCache.get(data);
  if (!keys) {
    keys = data.organizations.map((o) => ({
      name: normData(`${o.name}\n${o.officeName}`),
      location: normData(`${o.address}\n${o.officeAddress}`),
      language: normData(o.languages),
      suspended: o.remarks.includes("休止"),
    }));
    keyCache.set(data, keys);
  }
  return keys;
};

export function searchSupportOrgs(input: SupportOrgSearchInput, data: SupportOrgDataset): SupportOrgSearchResult {
  const name = input.name ? norm(input.name) : "";
  const location = input.location ? norm(input.location) : "";
  const language = input.language ? norm(input.language) : "";
  if (!name && !location && !language) {
    return { ok: false, error: "name（名称）・location（所在地）・language（対応言語）のいずれかを指定してください。" };
  }
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  const keys = keysOf(data);
  const hits: SupportOrg[] = [];
  let total = 0;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (k.suspended && !input.includeSuspended) continue;
    if (name && !k.name.includes(name)) continue;
    if (location && !k.location.includes(location)) continue;
    if (language && !k.language.includes(language)) continue;
    total++;
    if (hits.length < limit) hits.push(data.organizations[i]);
  }
  return { ok: true, organizations: hits, total };
}
