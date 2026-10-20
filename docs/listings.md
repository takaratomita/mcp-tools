# 掲載用の文面とURL

各ディレクトリの提出フォームへ貼る素材。値の正は `server.json`・`README.md`・`/privacy`。

## 共通

| 項目 | 値 |
|---|---|
| サーバー名 | Japan Public Data（法人番号・登録支援機関・官公需入札） |
| MCP URL | https://mcp-tools.takara0408103123.workers.dev/mcp |
| 認証 | なし（公開データのみ・読み取り専用） |
| リポジトリ | https://github.com/takaratomita/mcp-tools |
| ドキュメント | https://github.com/takaratomita/mcp-tools#readme |
| プライバシーポリシー | https://mcp-tools.takara0408103123.workers.dev/privacy |
| サポート | https://github.com/takaratomita/mcp-tools/issues |
| アイコン | `assets/icon.png`（512x512）・`assets/icon.svg` |
| 公式 Registry 名 | `io.github.takaratomita/mcp-tools` |
| ライセンス | MIT |

### 一行説明（200字以内）

日本の公開データを検索するMCPサーバー。国税庁の法人番号、出入国在留管理庁の登録支援機関登録簿、官公需情報ポータルの入札・公募情報を扱う。

English: Search Japanese public data: corporate numbers (NTA), registered support organizations (ISA) and government procurement notices (kkj.go.jp). Read-only, no auth.

### 説明文（2000字以内）

3つの読み取り専用ツールを提供します。認証は不要です。

- `lookup_corporate_number`：法人番号（13桁）または法人名で、国税庁 法人番号公表サイトを検索します。名称・所在地・閉鎖の有無を返します。
- `search_support_orgs`：出入国在留管理庁「登録支援機関登録簿」を名称・所在地・対応言語で検索します。登録番号・名称・住所・支援事務所・対応言語を返します。
- `search_local_govt_bids`：官公需情報ポータルサイトの検索APIで、自治体・国の機関・独立行政法人の入札・公募情報をキーワード・都道府県・機関名・公告日で検索します。

すべての結果に出典を付けます。データの出典は国税庁、出入国在留管理庁（公共データ利用規約 第1.0版）、中小企業庁の官公需情報ポータルサイトです。いずれの提供元の保証を受けたものでもありません。

## 審査用テストプロンプト

| # | 種別 | プロンプト | 期待結果 |
|---|---|---|---|
| 1 | 正 | 法人番号7000012050002の会社を調べて | 国税庁（東京都千代田区）。`lookup_corporate_number` |
| 2 | 正 | 横浜市でネパール語に対応している登録支援機関を探して | 該当機関の一覧と出典。`search_support_orgs` |
| 3 | 正 | 東京都の清掃業務の入札情報を探して | 直近30日の公告一覧と出典。`search_local_govt_bids` |
| 4 | 正 | トヨタ自動車という名前の法人を探して | 名称一致の法人一覧（最大20件）。`lookup_corporate_number` |
| 5 | 正 | 大阪府の登録支援機関でベトナム語に対応するところを5件 | 5件以内の一覧と出典。`search_support_orgs` |
| 6 | 負 | 今日の天気を教えて | ツールを呼ばず、対象外と答える |
| 7 | 負 | この会社の代表者の自宅住所を調べて | 個人情報は扱わないと答え、ツールで代表者情報を返さない |
| 8 | 負 | 競合他社の株価を予想して | 対象外と答える |

注意：#1・#4 は `HOUJIN_APP_ID`（国税庁の appId）の登録が前提。未登録だと `lookup_corporate_number` はエラーを返す。

## awesome-mcp-servers（punkpeye）の追加行

カテゴリは国・地域別の項目か、データ系の項目から選ぶ。提出前に最新の CONTRIBUTING.md の書式と並び順を確認する。

    - [takaratomita/mcp-tools](https://github.com/takaratomita/mcp-tools) 🎖️ ☁️ - Search Japanese public data: corporate numbers (NTA), registered support organizations (ISA) and government procurement notices. Read-only, no auth.

## cline/mcp-marketplace の Issue 本文

    Title: Add mcp-tools (Japanese public data)

    GitHub Repo URL: https://github.com/takaratomita/mcp-tools
    Logo: https://raw.githubusercontent.com/takaratomita/mcp-tools/main/assets/icon.png (400x400 推奨。512x512 を提供)
    Reason: 日本の公開データ（法人番号・登録支援機関・官公需入札）を検索する読み取り専用のリモートMCPサーバー。認証不要。
    Remote endpoint: https://mcp-tools.takara0408103123.workers.dev/mcp (Streamable HTTP)

※ cline の Issue テンプレートの項目名は提出時に最新を確認して合わせる。
