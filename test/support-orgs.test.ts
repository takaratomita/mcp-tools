import { describe, expect, it } from "vitest";
import { searchSupportOrgs, type SupportOrgDataset } from "../src/support-orgs.js";
import bundled from "../data/support-orgs.json";

const org = (o: Partial<SupportOrgDataset["organizations"][number]>) => ({
  registrationNumber: "19登-000001",
  registeredOn: "2019-04-01",
  name: "株式会社テスト",
  postCode: "1000001",
  address: "東京都千代田区千代田1-1",
  phone: "0300000000",
  officeName: "株式会社テスト",
  officeAddress: "東京都千代田区千代田1-1",
  languages: "英語",
  optionalSupport: false,
  remarks: "",
  ...o,
});

const DATA: SupportOrgDataset = {
  asOf: "2026-10-08",
  sourceUrl: "https://www.moj.go.jp/isa/applications/ssw/nyuukokukanri07_00205.html",
  organizations: [
    org({ registrationNumber: "19登-000100", name: "中村 浩三(中村行政書士事務所)", languages: "中国語・ベトナム語", address: "北海道札幌市中央区南1条西7丁目", officeAddress: "北海道札幌市中央区南1条西7丁目" }),
    org({ registrationNumber: "26登-013959", name: "彩インターナショナル株式会社", languages: "タガログ語・英語", address: "福島県いわき市平字大町20番地の8", officeAddress: "福島県いわき市平字大町20番地の8" }),
    org({ registrationNumber: "20登-000500", name: "ベトナム支援協同組合", languages: "ベトナム語", address: "大阪府大阪市北区梅田1", officeAddress: "東京都新宿区西新宿2" }),
    org({ registrationNumber: "21登-000700", name: "休止中株式会社", languages: "ベトナム語", remarks: "支援業務の休止の届出" }),
  ],
};

describe("searchSupportOrgs", () => {
  it("名称の部分一致（全角・空白の揺れを吸収）", () => {
    const r = searchSupportOrgs({ name: "彩インター" }, DATA);
    expect(r.ok && r.organizations.map((o) => o.registrationNumber)).toEqual(["26登-013959"]);
    const r2 = searchSupportOrgs({ name: "中村　浩三" }, DATA);
    expect(r2.ok && r2.total).toBe(1);
  });
  it("所在地は本社住所と支援事務所住所のどちらでも当たる", () => {
    const r = searchSupportOrgs({ location: "東京都新宿区" }, DATA);
    expect(r.ok && r.organizations.map((o) => o.registrationNumber)).toEqual(["20登-000500"]);
    const r2 = searchSupportOrgs({ location: "大阪府" }, DATA);
    expect(r2.ok && r2.total).toBe(1);
  });
  it("対応言語と所在地のAND", () => {
    const r = searchSupportOrgs({ language: "ベトナム語", location: "北海道" }, DATA);
    expect(r.ok && r.organizations.map((o) => o.registrationNumber)).toEqual(["19登-000100"]);
  });
  it("休止の届出がある機関は既定で除外し、指定すれば含める", () => {
    const r = searchSupportOrgs({ language: "ベトナム語" }, DATA);
    expect(r.ok && r.total).toBe(2);
    const r2 = searchSupportOrgs({ language: "ベトナム語", includeSuspended: true }, DATA);
    expect(r2.ok && r2.total).toBe(3);
  });
  it("件数上限で切り、総件数は保つ", () => {
    const r = searchSupportOrgs({ location: "都", limit: 1, includeSuspended: true }, DATA);
    expect(r.ok && r.organizations).toHaveLength(1);
    expect(r.ok && r.total).toBe(2);
  });
  it("支援事務所名でも当たり、全角英字・大文字小文字の揺れを吸収する", () => {
    const d: SupportOrgDataset = {
      ...DATA,
      organizations: [org({ registrationNumber: "22登-000001", name: "株式会社ABC", officeName: "abc Support 東京" })],
    };
    expect(searchSupportOrgs({ name: "ｓｕｐｐｏｒｔ" }, d)).toMatchObject({ ok: true, total: 1 });
    expect(searchSupportOrgs({ name: "ＡＢＣ" }, d)).toMatchObject({ ok: true, total: 1 });
  });
  it("条件が無ければエラー", () => {
    expect(searchSupportOrgs({ name: "  " }, DATA).ok).toBe(false);
  });
});

describe("同梱データ", () => {
  it("出入国在留管理庁の登録簿から生成され、件数と基準日を持つ", () => {
    const d = bundled as SupportOrgDataset;
    expect(d.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.sourceUrl).toContain("moj.go.jp/isa");
    expect(d.organizations.length).toBeGreaterThan(10000);
    expect(d.organizations[0].registrationNumber).toMatch(/^\d{2}登-\d{6}$/);
  });
  it("登録日は全件 YYYY-MM-DD（Excelのシリアル値を残さない）", () => {
    const d = bundled as SupportOrgDataset;
    const bad = d.organizations.filter((o) => !/^\d{4}-\d{2}-\d{2}$/.test(o.registeredOn));
    expect(bad.map((o) => `${o.registrationNumber}:${o.registeredOn}`)).toEqual([]);
  });
  it("代表者氏名の列は取り込まない（全件が同じ11項目）", () => {
    const d = bundled as SupportOrgDataset;
    const keys = Object.keys(org({})).sort();
    for (const o of d.organizations) expect(Object.keys(o).sort()).toEqual(keys);
  });
});
