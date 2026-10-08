# mcp-tools

日本の公開データを提供するリモートMCPサーバー（Streamable HTTP・Cloudflare Workers）。Claude Connectors Directory と ChatGPT Apps Directory への掲載を目的とする。

仕様・進捗は [`mcp-tools-spec.md`](./mcp-tools-spec.md) を参照。

## ツール

| ツール | 内容 | 状態 |
|---|---|---|
| `lookup_corporate_number` | 国税庁 法人番号公表サイトAPI。法人番号（13桁）または法人名で検索 | 実装済み |
| `search_support_orgs` | 法務省 登録支援機関登録簿 | 未実装 |
| `search_local_govt_bids` | 自治体入札・公募情報 | 未実装 |

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

1. `wrangler.toml` の `routes` を自分のドメインに設定して有効化する
2. `npx wrangler secret put HOUJIN_APP_ID`
3. `npm run deploy`
4. `https://<domain>/health` と `https://<domain>/privacy` が200を返すことを確認する

## 掲載チェックリスト

### Claude Directory 掲載用

- [ ] 公開HTTPSドメインにデプロイ済み（`/mcp` が到達可能）
- [ ] Claude Pro（$20/月）に加入
- [ ] 法人番号APIの appId を発行し、`wrangler secret` に登録済み
- [ ] `tools/list` の各ツールに `readOnlyHint` 等のannotationがある（実装済み）
- [ ] プライバシーポリシーURL（`https://<domain>/privacy`）を用意
- [ ] サポート連絡先（GitHub Issues）を記載
- [ ] Claude の最新の提出ガイドを確認し、フォームから提出

### ChatGPT Apps 掲載用

- [ ] 公開HTTPSドメインにデプロイ済み
- [ ] ChatGPT Platform で verified individual 登録
- [ ] 法人番号APIの appId を発行・登録済み
- [ ] プライバシーポリシーURLを用意
- [ ] CSP定義（接続先ドメインの宣言。外部通信は `api.houjin-bangou.nta.go.jp` のみ）を提出時に入力
- [ ] 審査用のテストプロンプトと期待結果を用意（例：「法人番号7000012050002の会社を調べて」）
- [ ] 提出時点の最新要件を公式ガイドで再確認

## ライセンス

MIT。法人情報の出典は国税庁法人番号公表サイト。
