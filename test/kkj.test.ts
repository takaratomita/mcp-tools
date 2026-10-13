import { describe, expect, it } from "vitest";
import { buildKkjUrl, parseKkjXml, searchBids } from "../src/kkj.js";

// 2026-10-13 に実APIから取得した応答を縮約したもの（公告文は省略）
const XML = `<?xml version="1.0" encoding="utf-8" ?>
<Results>
<Version>1.0</Version>
<SearchResults>
<SearchHits>14</SearchHits>
<SearchResult>
<ResultId>1</ResultId>
<Key><![CDATA[dG9reW8vdG9zaGltYV9jaXR5LzIwMjYvMjAyNjEwMDlfMDAwMDcK]]></Key><ExternalDocumentURI><![CDATA[https://www.city.toshima.lg.jp/documents/58037/20261008142620.pdf]]></ExternalDocumentURI><ProjectName>豊島区人事関連事務業務委託プロポーザルを実施します</ProjectName>
<Date>2026-10-09T19:11:42+09:00</Date>
<FileType>pdf</FileType>
<LgCode>13</LgCode>
<PrefectureName>東京都</PrefectureName>
<CityCode>131164</CityCode>
<CityName>豊島区</CityName>
<OrganizationName>東京都豊島区</OrganizationName>
<CftIssueDate>2026-10-09T00:00:00+09:00</CftIssueDate>
<Category>役務</Category>
<TenderSubmissionDeadline>2026-10-20T00:00:00+09:00</TenderSubmissionDeadline>
<OpeningTendersEvent>2026-11-02T00:00:00+09:00</OpeningTendersEvent>
<PeriodEndTime>2027-03-31T00:00:00+09:00</PeriodEndTime>
<ProjectDescription>
仕 様 書１．件名令和９年度豊島区人事関連事務業務委託 &lt;本文&gt;
</ProjectDescription>
<Attachments>
<Attachment>
<Name>仕様書（PDF：501KB）</Name>
<Uri><![CDATA[https://www.city.toshima.lg.jp/documents/58037/20261008142736.pdf]]></Uri></Attachment>
</Attachments>
</SearchResult>
<SearchResult>
<ResultId>2</ResultId>
<Key><![CDATA[Z292OC91cl9uZXRfc2FpdGFtYS8yMDI2LzIwMjYxMDA5XzAxMTUxCg==]]></Key><ExternalDocumentURI><![CDATA[https://www.ur-net.go.jp/orders/saitama/pdf/order_44262_2.pdf]]></ExternalDocumentURI><ProjectName>団地再生事業に係る居住者説明等業務（埼玉県内B団地） &amp; 説明会</ProjectName>
<Date>2026-10-09T00:00:00+09:00</Date>
<LgCode>13</LgCode>
<PrefectureName>東京都</PrefectureName>
<CityName>新宿区</CityName>
<OrganizationName>独立行政法人都市再生機構東日本賃貸住宅本部（埼玉地域）</OrganizationName>
<ProjectDescription>（略）</ProjectDescription>
</SearchResult>
</SearchResults>
</Results>`;

const fixed = () => new Date("2026-10-13T03:00:00Z");

describe("parseKkjXml", () => {
  it("案件を抽出し、CDATAと実体参照を戻す", () => {
    const r = parseKkjXml(XML);
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({
      projectName: "豊島区人事関連事務業務委託プロポーザルを実施します",
      organization: "東京都豊島区",
      prefecture: "東京都",
      city: "豊島区",
      category: "役務",
      procedureType: "",
      issueDate: "2026-10-09",
      tenderStartDate: "2026-10-20",
      openingDate: "2026-11-02",
      deliveryDeadline: "2027-03-31",
      url: "https://www.city.toshima.lg.jp/documents/58037/20261008142620.pdf",
    });
    expect(r[1].projectName).toBe("団地再生事業に係る居住者説明等業務（埼玉県内B団地） & 説明会");
  });
  it("欠けた項目は空文字にする", () => {
    expect(parseKkjXml(XML)[1]).toMatchObject({ category: "", tenderStartDate: "", openingDate: "", deliveryDeadline: "" });
  });
  it("CDATAの中身は実体参照を戻さず、前後の空白があっても剥がす", () => {
    const x = `<SearchResult><ProjectName>\n<![CDATA[a &amp; b]]>\n</ProjectName></SearchResult>`;
    expect(parseKkjXml(x)[0].projectName).toBe("a &amp; b");
  });
  it("数値文字参照を戻す", () => {
    expect(parseKkjXml(`<SearchResult><ProjectName>&#x6E05;&#25475;</ProjectName></SearchResult>`)[0].projectName).toBe("清掃");
  });
  it("http(s)以外の公告URLは落とす", () => {
    const x = `<SearchResult><ExternalDocumentURI><![CDATA[javascript:alert(1)]]></ExternalDocumentURI></SearchResult>`;
    expect(parseKkjXml(x)[0].url).toBe("");
  });
  it("公告文の中にタグ風の文字列があっても項目を取り違えない", () => {
    const x = `<SearchResult><ProjectDescription>本文 &lt;/SearchResult&gt; <ProjectName>偽</ProjectName></ProjectDescription><ProjectName>本物</ProjectName></SearchResult>`;
    expect(parseKkjXml(x)[0].projectName).toBe("本物");
  });
  it("公告日が無ければ取得日を使う", () => {
    expect(parseKkjXml(XML)[1].issueDate).toBe("2026-10-09");
  });
  it("0件を空配列にする", () => {
    expect(parseKkjXml("<Results><SearchResults><SearchHits>0</SearchHits></SearchResults></Results>")).toEqual([]);
  });
});

describe("buildKkjUrl", () => {
  it("キーワードは空白区切りのAND、演算子語と括弧は除く", () => {
    const u = new URL(buildKkjUrl({ query: "清掃　委託 OR (NOT)", since: "2026-10-01", limit: 5 }));
    expect(u.origin + u.pathname).toBe("https://www.kkj.go.jp/api/");
    expect(u.searchParams.get("Query")).toBe("清掃 AND 委託");
    expect(u.searchParams.get("CFT_Issue_Date")).toBe("2026-10-01/");
    expect(u.searchParams.get("Count")).toBe("5");
  });
  it("都道府県名をJISコードに、機関名をOrganization_Nameにする", () => {
    const u = new URL(
      buildKkjUrl({ prefecture: "東京", organization: "豊島区", since: "2026-10-01", limit: 10 }),
    );
    expect(u.searchParams.get("LG_Code")).toBe("13");
    expect(u.searchParams.get("Organization_Name")).toBe("豊島区");
    expect(u.searchParams.has("Query")).toBe(false);
  });
});

describe("searchBids", () => {
  const ok = async (url: string) => {
    ok.lastUrl = url;
    return new Response(XML, { status: 200 });
  };
  ok.lastUrl = "";

  it("検索結果と総件数を返す", async () => {
    const r = await searchBids({ query: "業務委託", prefecture: "東京都" }, { fetch: ok as never, now: fixed });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(14);
    expect(r.bids).toHaveLength(2);
    expect(ok.lastUrl).toContain("LG_Code=13");
  });
  it("since省略時は30日前からを検索する", async () => {
    await searchBids({ query: "清掃" }, { fetch: ok as never, now: fixed });
    expect(new URL(ok.lastUrl).searchParams.get("CFT_Issue_Date")).toBe("2026-09-13/");
  });
  it("件数は既定10・上限20", async () => {
    await searchBids({ query: "清掃" }, { fetch: ok as never, now: fixed });
    expect(new URL(ok.lastUrl).searchParams.get("Count")).toBe("10");
    await searchBids({ query: "清掃", limit: 999 }, { fetch: ok as never, now: fixed });
    expect(new URL(ok.lastUrl).searchParams.get("Count")).toBe("20");
  });
  it("検索条件が何も無ければ上流を呼ばずエラー", async () => {
    ok.lastUrl = "";
    const r = await searchBids({ query: " OR " }, { fetch: ok as never, now: fixed });
    expect(r.ok).toBe(false);
    expect(ok.lastUrl).toBe("");
  });
  it("未知の都道府県名はエラー", async () => {
    const r = await searchBids({ query: "清掃", prefecture: "東京府" }, { fetch: ok as never, now: fixed });
    expect(r.ok).toBe(false);
  });
  it("不正な日付は上流を呼ばずエラー", async () => {
    ok.lastUrl = "";
    const r = await searchBids({ query: "清掃", since: "2026/10/01" }, { fetch: ok as never, now: fixed });
    expect(r.ok).toBe(false);
    expect(ok.lastUrl).toBe("");
  });
  it("API の Error 要素はエラーとして返す", async () => {
    const r = await searchBids(
      { query: "清掃" },
      { fetch: (async () => new Response("<Results><Error>search disabled</Error></Results>")) as never, now: fixed },
    );
    expect(r).toEqual({ ok: false, error: expect.stringContaining("search disabled") });
  });
  it("HTTP200でもXMLでない応答はエラー", async () => {
    const r = await searchBids(
      { query: "清掃" },
      { fetch: (async () => new Response("<html>maintenance</html>")) as never, now: fixed },
    );
    expect(r.ok).toBe(false);
  });
  it("上流が非200ならエラー", async () => {
    const r = await searchBids(
      { query: "清掃" },
      { fetch: (async () => new Response("x", { status: 500 })) as never, now: fixed },
    );
    expect(r.ok).toBe(false);
  });
  it("fetchがthrowしてもエラー結果で返す", async () => {
    const r = await searchBids(
      { query: "清掃" },
      { fetch: (async () => { throw new Error("boom"); }) as never, now: fixed },
    );
    expect(r.ok).toBe(false);
  });
});
