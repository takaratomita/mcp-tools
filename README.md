# mcp-tools

日本の公開データを提供するリモートMCPサーバー（Streamable HTTP・Cloudflare Workers）。Claude Connectors Directory と ChatGPT Apps Directory への掲載を目的とする。

仕様・進捗は [`mcp-tools-spec.md`](./mcp-tools-spec.md) を参照。

## ツール

| ツール | 内容 | 状態 |
|---|---|---|
| `lookup_corporate_number` | 国税庁 法人番号公表サイトAPI。法人番号（13桁）または法人名で検索 | 実装済み |
| `search_support_orgs` | 出入国在留管理庁「登録支援機関登録簿」。名称・所在地・対応言語で検索（同梱データ。`data/support-orgs.json`） | 実装済み |
| `search_local_govt_bids` | 官公需情報ポータルサイト検索API（中小企業庁）。自治体・国の機関の入札・公募情報をキーワード・都道府県・機関名・公告日で検索 | 実装済み |

すべて読み取り専用（`readOnlyHint: true`）。外部通信は `api.houjin-bangou.nta.go.jp` と `www.kkj.go.jp` のみ。

### 登録支援機関データの更新

登録簿は随時更新される（2026-10 時点で月に複数回）。Worker から直接取得せず、生成済みJSONを同梱している。理由は2つ。(1) 配布元が既定のUAを403で拒否する (2) 2.6MBのExcelをリクエストごとに解析するのは Workers には重い。同梱JSONは約5.0MB・gzip後約0.86MBで、Workers 無料プランのスクリプト上限（圧縮後3MB）に収まる。

    pip install openpyxl
    python3 scripts/build_support_orgs.py   # 掲載ページから最新のExcelを取得し data/support-orgs.json を上書き
    npm test

代表者氏名の列はツールの用途に不要なため取り込まない。名称・支援事務所名の欄は登録簿の記載のまま返す。

## 使い方（インストール）

公開エンドポイントは `https://mcp-tools.takara0408103123.workers.dev/mcp`。認証は不要。

Claude Code：

    claude mcp add --transport http mcp-tools https://mcp-tools.takara0408103123.workers.dev/mcp

Claude Desktop・claude.ai：設定の「コネクタ」→「カスタムコネクタを追加」に上のURLを入力する。

その他のMCPクライアント（Cursor・VS Code 等）：Streamable HTTP のリモートサーバーとして上のURLを登録する。

公式 MCP Registry の登録名は `io.github.takaratomita/mcp-tools`（定義は `server.json`）。

## エンドポイント

| パス | 内容 |
|---|---|
| `/mcp` | MCP（Streamable HTTP・ステートレス・JSON応答） |
| `/privacy` | プライバシーポリシー（`/` も同内容） |
| `/health` | ヘルスチェック |

## 開発

    npm install
    npm test            # vitest
    npm run typecheck
    cp .env.example .dev.vars   # HOUJIN_APP_ID を記入
    npm run dev         # http://localhost:8787/mcp

動作確認例：

    curl -s -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
      localhost:8787/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

## デプロイ（Cloudflare Workers）

1. `npx wrangler secret put HOUJIN_APP_ID`（`lookup_corporate_number` に必要。未登録でも他の2ツールは動く）
2. `npm run deploy`（既定は workers.dev。独自ドメインは任意で、`wrangler.toml` の `routes` を有効化する）
3. `https://<host>/health` と `https://<host>/privacy` が200を返すことを確認する

2026-10-19 に `https://mcp-tools.takara0408103123.workers.dev` へデプロイ済み。ディレクトリ側の要件に独自ドメインは含まれないため、workers.dev のまま掲載する（根拠は仕様書の章5）。

## 掲載チェックリスト

### Claude Directory 掲載用

- [x] 公開HTTPSでデプロイ済み（workers.dev。`/mcp` 到達確認済み）
- [x] 有料 Claude プランに加入済み（Max。2026-10-19 に提出画面で確認）
- [ ] 法人番号APIの appId を発行し、`wrangler secret` に登録済み（審査員が全ツールを試すため提出前に必須）
- [x] `tools/list` の3ツールすべてに `readOnlyHint` 等のannotationがある
- [x] プライバシーポリシーURL（`/privacy`）を用意
- [x] サポート連絡先（GitHub Issues）を記載
- [ ] https://claude.ai/directory/manage の「MCPコネクタ」から提出（文面は `docs/listings.md`）

### ChatGPT Apps 掲載用

- [x] 公開HTTPSでデプロイ済み（workers.dev）
- [ ] ChatGPT Platform（https://platform.openai.com/plugins）にログインし、individual または business の本人確認を完了
- [ ] 法人番号APIの appId を発行・登録済み
- [x] プライバシーポリシーURLを用意（`/privacy`）
- [ ] CSP定義（接続先ドメインの宣言。外部通信は `api.houjin-bangou.nta.go.jp` と `www.kkj.go.jp`）を提出時に入力
- [ ] 審査用のテストプロンプトと期待結果を用意
  - 「法人番号7000012050002の会社を調べて」→ 国税庁（東京都千代田区）
  - 「横浜市でネパール語に対応している登録支援機関を探して」→ 登録簿の該当機関一覧と出典
  - 「東京都の清掃業務の入札情報を探して」→ 直近30日の公告一覧と出典
- [ ] 提出時点の最新要件を公式ガイドで再確認

## ライセンス

MIT。データの出典は次のとおり。

- 法人情報：国税庁法人番号公表サイト
- 登録支援機関：出入国在留管理庁「登録支援機関登録簿」（公共データ利用規約 第1.0版（PDL1.0）。加工して利用）
- 入札・公募情報：官公需情報ポータルサイト（https://www.kkj.go.jp/s/）の検索APIを利用
