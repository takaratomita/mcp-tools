# awesome 系リスト PR の下書き（人が送る。私は PR ボタンを押さない）

作成: 2026-10-22。形式は各リポジトリの現行 README・CONTRIBUTING で確認した（同日）。

## 共通の注意

- PR は人間が自分のアカウント（takaratomita）で送る。
- 自動投稿の早期マージ用タグ（PR タイトルへの `🤖🤖🤖`）は付けない。
- PR 本文で、作者本人の提出であることを明記する（無関係の第三者を装わない）。
- 星・投票の依頼はしない。

## 1. jaw9c/awesome-remote-mcp-servers

- 送る先: https://github.com/jaw9c/awesome-remote-mcp-servers
- 変更ファイル: README.md の「Remote MCP Server List」表に1行足す（表は名前のアルファベット順。`Japan Public Data` は J の位置）。
- 条件の確認: 認証なしの「Open」行は既にある（AWS Knowledge、Find-A-Domain 等）。エンドポイントは公開 HTTPS で稼働中。

追加する行:

    | Japan Public Data | Government Data | `https://mcp-tools.takara0408103123.workers.dev/mcp` | Open | [takaratomita](https://github.com/takaratomita/mcp-tools) |

PR タイトル:

    Add Japan Public Data (corporate numbers, support organizations, bid notices)

PR 本文:

    I'm the author of this server.

    - Name: Japan Public Data (mcp-tools)
    - Category: Government Data (no matching category exists yet; happy to use another if you prefer)
    - URL: https://mcp-tools.takara0408103123.workers.dev/mcp (Streamable HTTP)
    - Authentication: none (read-only public data; no user data is stored)
    - Tools: lookup_corporate_number (National Tax Agency), search_support_orgs (Immigration Services Agency register, PDL1.0), search_local_govt_bids (public procurement portal)
    - Example usage: "Look up corporate number 7000012050002."
    - Source: https://github.com/takaratomita/mcp-tools
    - Also published in the official MCP Registry as io.github.takaratomita/mcp-tools.

## 2. punkpeye/awesome-mcp-servers

- 状態: 保留。理由は2つ。
  - (1) CONTRIBUTING は、公開 GitHub リポジトリで自分で入れて動かすサーバーを対象とし、リモート専用は別のリストに回すとしている。本サーバーは主にホスト型の公開エンドポイントで、境界例になる。
  - (2) 掲載行に Glama のスコアバッジが要るが、Glama はまだ審査待ち。
- 再開条件: Glama が承認され、ページ URL が分かった時点。そのとき、リポジトリにローカル実行の手順があることを README で確認してから送る。
- 送る場合の行（`docs/listings.md` の行に 📇 を足し、Glama バッジを付ける）:

      - [takaratomita/mcp-tools](https://github.com/takaratomita/mcp-tools) 📇 ☁️ - Search Japanese public data: corporate numbers, registered support organizations, government bid notices. <Glama バッジ>
