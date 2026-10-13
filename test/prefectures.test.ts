import { describe, expect, it } from "vitest";
import { PREFECTURES, prefectureCode } from "../src/prefectures.js";

describe("prefectureCode", () => {
  it("正式名・略称・コードを受け付ける", () => {
    expect(prefectureCode("東京都")).toBe("13");
    expect(prefectureCode("東京")).toBe("13");
    expect(prefectureCode("京都")).toBe("26");
    expect(prefectureCode("大阪")).toBe("27");
    expect(prefectureCode("北海道")).toBe("01");
    expect(prefectureCode("沖縄県")).toBe("47");
    expect(prefectureCode("１３")).toBe("13");
    expect(prefectureCode("1")).toBe("01");
  });
  it("該当しない入力は undefined", () => {
    for (const s of ["北海", "東京府", "0", "48", "", "Tokyo"]) expect(prefectureCode(s)).toBeUndefined();
  });
  it("47都道府県すべて往復できる", () => {
    expect(PREFECTURES).toHaveLength(47);
    PREFECTURES.forEach((p, i) => expect(prefectureCode(p)).toBe(String(i + 1).padStart(2, "0")));
  });
});
