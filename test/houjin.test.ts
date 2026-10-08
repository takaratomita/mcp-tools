import { describe, expect, it } from "vitest";
import {
  isValidCorporateNumber,
  parseHoujinXml,
  lookupCorporateNumber,
} from "../src/houjin.js";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<corporations>
<lastUpdateDate>2026-10-07</lastUpdateDate><count>1</count><divideNumber>1</divideNumber><divideSize>1</divideSize>
<corporation><sequenceNumber>1</sequenceNumber><corporateNumber>7000012050002</corporateNumber><process>01</process><correct>0</correct><updateDate>2015-10-05</updateDate><changeDate>2015-10-05</changeDate><name>国税庁</name><nameImageId/><kind>101</kind><prefectureName>東京都</prefectureName><cityName>千代田区</cityName><streetNumber>霞が関３丁目１－１</streetNumber><addressImageId/><prefectureCode>13</prefectureCode><cityCode>101</cityCode><postCode>1008978</postCode><addressOutside/><addressOutsideImageId/><closeDate/><closeCause/><successorCorporateNumber/><changeCause/><assignmentDate>2015-10-05</assignmentDate><latest>1</latest><enName/><furigana>コクゼイチョウ</furigana></corporation>
</corporations>`;

describe("isValidCorporateNumber", () => {
  it("正しいチェックデジットを受理する", () => {
    expect(isValidCorporateNumber("7000012050002")).toBe(true);
  });
  it("チェックデジット不一致を拒否する", () => {
    expect(isValidCorporateNumber("1000012050002")).toBe(false);
  });
  it("13桁でない入力を拒否する", () => {
    expect(isValidCorporateNumber("700001205000")).toBe(false);
    expect(isValidCorporateNumber("abcdefghijklm")).toBe(false);
  });
});

describe("parseHoujinXml", () => {
  it("法人情報を抽出する", () => {
    const r = parseHoujinXml(XML);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      corporateNumber: "7000012050002",
      name: "国税庁",
      prefecture: "東京都",
      city: "千代田区",
      streetNumber: "霞が関３丁目１－１",
      postCode: "1008978",
      furigana: "コクゼイチョウ",
      closed: false,
    });
  });
  it("閉鎖済みを判定する", () => {
    const r = parseHoujinXml(XML.replace("<closeDate/>", "<closeDate>2020-01-01</closeDate>"));
    expect(r[0].closed).toBe(true);
  });
  it("0件を空配列にする", () => {
    expect(parseHoujinXml("<corporations><count>0</count></corporations>")).toEqual([]);
  });
});

describe("lookupCorporateNumber", () => {
  const ok = async (url: string) => {
    ok.lastUrl = url;
    return new Response(XML, { status: 200 });
  };
  ok.lastUrl = "";

  it("appId未設定ならエラーを返す", async () => {
    const r = await lookupCorporateNumber({ number: "7000012050002" }, { fetch: ok as never });
    expect(r.ok).toBe(false);
  });
  it("番号検索はnumのエンドポイントを呼ぶ", async () => {
    const r = await lookupCorporateNumber(
      { number: "7000012050002" },
      { appId: "APP", fetch: ok as never },
    );
    expect(r.ok).toBe(true);
    expect(ok.lastUrl).toContain("/4/num?");
    expect(ok.lastUrl).toContain("id=APP");
    expect(ok.lastUrl).toContain("number=7000012050002");
  });
  it("名称検索はnameのエンドポイントを呼ぶ", async () => {
    await lookupCorporateNumber({ name: "国税庁" }, { appId: "APP", fetch: ok as never });
    expect(ok.lastUrl).toContain("/4/name?");
    expect(ok.lastUrl).toContain(encodeURIComponent("国税庁"));
  });
  it("不正な番号は上流を呼ばず拒否する", async () => {
    ok.lastUrl = "";
    const r = await lookupCorporateNumber(
      { number: "1000012050002" },
      { appId: "APP", fetch: ok as never },
    );
    expect(r.ok).toBe(false);
    expect(ok.lastUrl).toBe("");
  });
  it("number/name どちらも無ければエラー", async () => {
    const r = await lookupCorporateNumber({}, { appId: "APP", fetch: ok as never });
    expect(r.ok).toBe(false);
  });
  it("HTTP200でもXMLでない応答はエラー（該当なしに化けない）", async () => {
    const r = await lookupCorporateNumber(
      { number: "7000012050002" },
      { appId: "APP", fetch: (async () => new Response("<html>maintenance</html>")) as never },
    );
    expect(r.ok).toBe(false);
  });
  it("全角・T付き・ハイフン入りの番号を正規化する", async () => {
    const r = await lookupCorporateNumber(
      { number: " T７０００－０１２０５０００２ " },
      { appId: "APP", fetch: ok as never },
    );
    expect(r.ok).toBe(true);
    expect(ok.lastUrl).toContain("number=7000012050002");
  });
  it("number と name の同時指定はエラー", async () => {
    const r = await lookupCorporateNumber(
      { number: "7000012050002", name: "国税庁" },
      { appId: "APP", fetch: ok as never },
    );
    expect(r.ok).toBe(false);
  });
  it("fetchがthrowしてもエラー結果で返す", async () => {
    const r = await lookupCorporateNumber(
      { number: "7000012050002" },
      { appId: "APP", fetch: (async () => { throw new Error("boom"); }) as never },
    );
    expect(r.ok).toBe(false);
  });
  it("総件数countを返す", async () => {
    const r = await lookupCorporateNumber(
      { name: "国税庁" },
      { appId: "APP", fetch: (async () => new Response(XML.replace("<count>1</count>", "<count>345</count>"))) as never },
    );
    expect(r.ok && r.total).toBe(345);
  });
  it("上流が非200ならエラー", async () => {
    const r = await lookupCorporateNumber(
      { number: "7000012050002" },
      { appId: "APP", fetch: (async () => new Response("x", { status: 500 })) as never },
    );
    expect(r.ok).toBe(false);
  });
});
