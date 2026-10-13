/** 都道府県名（JIS X 0401 の順。インデックス+1 がコード）。 */
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
  "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
  "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
  "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

/** 「東京」「東京都」「13」のいずれからも2桁コードを返す。該当なしは undefined。 */
export function prefectureCode(input: string): string | undefined {
  const s = input.normalize("NFKC").replace(/\s/g, "");
  if (/^\d{1,2}$/.test(s) && Number(s) >= 1 && Number(s) <= 47) return s.padStart(2, "0");
  const i = PREFECTURES.findIndex((p) => p === s || (p !== "北海道" && p.slice(0, -1) === s));
  return i < 0 ? undefined : String(i + 1).padStart(2, "0");
}
