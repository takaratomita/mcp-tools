# mcp-tools 仕様書・実装計画書・進捗台帳

作成：2026-10-08 / ステータス：計画中
関連調査：`secondry-brain/1_Projects/集客ハック/research/2026-10-08-t12-loopholes.md`・`t13-implementation-ranking.md`

## 0. この資料の読み方

- 仕様（何を作るか）・実装計画（どう作るか）・TODO（進捗管理）を1ファイルで持つ
- 数値の一次ソースは Vault の research/ 側。本ファイルは実装判断の正
- 完了したTODOは `[x]` に変え、進捗台帳に1行追記する

## 1. 概要と受け入れ条件

### 目的

公開データ系のMCPサーバーを作り、**Claude Connectors Directory と ChatGPT Apps Directory の両方に掲載**する。両者は同じMCP基盤を使うため、1本の実装で2面の露出を取れる（調査済み：ChatGPT掲載済みの17.1%しかClaudeに未横展開）。

### 受け入れ条件（Go判定）

| 条件 | 判定方法 |
|---|---|
| Claude Directory に掲載される | ディレクトリで検索して自分のアプリが出る |
| ChatGPT Apps に掲載される | 同上 |
| 掲載後30日でインストール/利用が発生 | 各ディレクトリのダッシュボード or サーバーログ |

### 収益の位置づけ

本リポジトリの製品は**集客面（棚）であり、収益源ではない**。掲載→流入→後段（有料API層・関連サービス誘導）への導線を作ることが目的。単体での収益化はPhase後半の判断。

## 2. 市場の裏付け（調査済み・再検証済み）

- Claude Connectors Directory：個人提出可（Pro $20/月〜）。掲載数2,383件（2026-09-04計測・第三者）。急増中だが絶対密度はまだ低い
- ChatGPT Apps：verified individualで提出可。掲載約2,289件（2026-08計測）。95.6%の開発者が1アプリのみ＝頭のいない市場
- 両ディレクトリとも会話内proactive suggestionsが流入経路。日本語対応・日本向けニッチは薄い
- 前提の優位性調査：「AI量産できない側＝一次情報・公開名簿」が残る優位（集客ハック t1〜t4）

## 3. スコープ

### やること（v1）

- リモートMCPサーバー（HTTPS・公開ドメイン）を1本立てる
- ツール群：日本の公開データ検索系（下記4-1）
- プライバシーポリシーページ（掲載要件）
- Claude Directory・ChatGPT Appsへの提出

### やらないこと（v1）

- ユーザー認証・OAuth（公開データのみなら不要と確認済み）
- 有料課金・サブスク（掲載後の流入を見てから判断）
- 自作コンテンツの生成系機能

## 4. 設計

### 4-1. ツール構成（案）

| ツール名 | データ源 | 裏付け |
|---|---|---|
| `search_support_orgs` | 出入国在留管理庁「登録支援機関登録簿」Excel（PDL1.0・商用可）を `scripts/build_support_orgs.py` でJSON化して同梱 | 集客ハック t5 で法的に確認済み。2026-10-13 に同庁サイトの利用規約（https://www.moj.go.jp/isa/copyright/index2.html）でPDL1.0適用を再確認 |
| `lookup_corporate_number` | 国税庁 法人番号公表サイト API | 無料API・要appId |
| `search_local_govt_bids` | 官公需情報ポータルサイト検索API（中小企業庁。https://www.kkj.go.jp/api/ 。認証不要・無料）。自治体に加え国の機関・独法の公告も含む | t12 で需要確認。利用規約でAPI利用の明記とポータルへのリンクが必須（出力末尾の出典で対応） |

#### 入出力（v1 確定）

| ツール | 入力 | 出力 |
|---|---|---|
| `lookup_corporate_number` | `number`（13桁）または `name`（部分一致） | 法人番号・名称・所在地・閉鎖有無。最大20件 |
| `search_support_orgs` | `name`・`location`（本社または支援事務所の住所に部分一致）・`language` のいずれか1つ以上。`includeSuspended`（既定false）・`limit`（既定10・最大20） | 登録番号・登録日・名称・住所・電話・支援事務所・対応言語・任意的支援の有無・備考、総件数、基準日つき出典。代表者氏名は出さない |
| `search_local_govt_bids` | `query`（空白区切りAND）・`prefecture`・`organization` のいずれか1つ以上。`since`（YYYY-MM-DD・既定30日前）・`limit`（既定10・最大20） | 件名・機関名・都道府県・市区町村・カテゴリー・公示種別・公告日・入札開始日・開札日・納入期限日・公告URL（http(s)のみ）、総件数、出典 |

- 官公需APIの `Category`・`Procedure_Type` 絞り込みは公式ガイドで「データ未整備」とされているため入力に出さない（出力には含める）
- 官公需APIの日付項目は、実応答では欠けることが多い（2026-10-13、「清掃」Count=20の実測で `TenderSubmissionDeadline`・`OpeningTendersEvent`・`PeriodEndTime` はいずれも0件、`ProcedureType` は4件）。欠けた項目は空文字で返す
- 登録支援機関は休止届のある機関（備考に「休止」）を既定で除外する
- 代表者氏名の列は取り込まない。ただし名称・支援事務所名の欄は登録簿の記載のまま返す。個人事業主の氏名や、事務所名に添えた代表者名（1件）が含まれる
- 検索キーは起動時に作る（11,660件で約49ms。node 実測）。同梱データは生成時に NFKC 済みのため実行時の NFKC は省く
- 登録簿の配布元は既定UAを403で拒否し、Python urllib の接続も切る（2026-10-13 実測）。生成スクリプトは curl で取得する

- 命名は英語・検索されやすい汎用語。日本語説明をtool descriptionに併記
- 認証なし・読み取り専用・rate limit自前

### 4-2. 技術スタック

- MCP SDK（TypeScript or Python）+ Streamable HTTP transport
- ホスティング：Cloudflare Workers / Vercel / 自前VPS（要HTTPS・常時稼働）
- 独自ドメイン or サブドメイン（掲載審査でドメインが必要）

## 5. 実装計画（フェーズ）

- [x] P0：リポジトリ初期設定（README・LICENSE・.gitignore）
- [x] P1：MCPサーバースケルトン（HTTP transport・ツール1個で動く）
- [x] P2：ツール実装（4-1の3ツールすべて。2026-10-13 に `search_support_orgs`・`search_local_govt_bids` を追加）
- [x] P3：公開デプロイ（HTTPS・独自ドメイン）※デプロイ設定（wrangler.toml）の整備まで。実デプロイはドメイン用意後にユーザーが実施
- [x] P4：プライバシーポリシー・サポート連絡先ページ
- [ ] P5：ChatGPT Apps提出（verified individual登録・CSP設定・審査）
- [ ] P6：Claude Directory提出（Pro加入が前提・$20/月）
- [ ] P7：掲載後30日の流入実測→継続/停止判定

## 6. 営業・価格・収支

- コスト：Claude Pro $20/月（提出に必須）＋ホスティング（無料枠可）＋ドメイン（既存あれば0円）
- 収益：直接課金なし。流入→後段サービスへの導線設計のみ

## 7. 検討した選択肢と却下理由

| 選択肢 | 却下理由 |
|---|---|
| ChatGPT Appsのみ提出 | Claude側も同基盤で両掲載できるのに1面に限定は勿体ない |
| OAuth対応 | 公開データのみなら不要。複雑性だけ増す |
| 最初から有料化 | 掲載流入の実測がない段階で課金を考えるのは早い |

## 8. リスク・注意点

- ディレクトリ掲載≠流入の保証なし（個別流入実測はUNVERIFIED）
- 掲載数は月数百件ペースで増加中。先行者利益は時間で薄れる
- ChatGPT Appsの審査要件は変わりうる。提出時点で最新を確認
- 公開データ利用は各データ源の利用規約（PDL1.0等）を遵守

## 9. 未検証事項

- 掲載後の個別流入量・インストール数の実測（公開データなし）
- 日本語カテゴリでの競合密度の正確な数
- 掲載に必要なCSP・デモアカウント等の細部（提出時に公式ガイド再確認）

## 10. 進捗台帳

| 日付 | 内容 |
|---|---|
| 2026-10-08 | リポジトリ作成・Orca連携・本ファイル作成 |
| 2026-10-08 | P0〜P4：TypeScript+Cloudflare Workers+Streamable HTTP（ステートレス）で `lookup_corporate_number` を実装。vitest 23件合格、wrangler dev でローカル実測（モック上流）。レビュー指摘のうち /mcp GET 405・件数上限・異常応答検出・タイムアウト・入力正規化を修正。/privacy・wrangler.toml・READMEチェックリスト整備。未了：`search_support_orgs`、実API疎通（appId未発行）、実デプロイ |
| 2026-10-13 | `search_support_orgs`（登録簿 2026-10-08現在・11,660件を同梱）と `search_local_govt_bids`（官公需API）を実装。vitest 23件→62件合格・typecheck 0。wrangler dev で官公需APIへの実疎通と登録簿検索を確認。プライバシーポリシーに送信先（官公需API）を追記。未了：法人番号API実疎通（appId未発行）、実デプロイ、提出 |
