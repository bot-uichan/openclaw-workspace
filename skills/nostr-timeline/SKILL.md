---
name: nostr-timeline
description: Nostrのタイムライン(TL/home feed)をRelayから取得・整形する。特定npub/hex pubkeyのフォロー一覧(kind:3)から著者リストを作り、kind:1ノート(必要ならkind:6リポスト)をまとめて取得して時系列表示したいときに使う。CLIでの取得、フィルタ(limit/since/until)、EOSE待ち、JSONL/Markdown整形に対応。
---

# Nostr Timeline Fetch

迷ったらまず `scripts/nostr_timeline.mjs` を叩く。ライブラリ不要でWebSocketだけで取る。

## Quick start

- あるユーザーのフォローTLを取得（最新50件）

```bash
node scripts/nostr_timeline.mjs \
  --relay wss://relay.damus.io \
  --npub npub1... \
  --limit 50
```

- hex pubkey指定（64 hex）でもOK

```bash
node scripts/nostr_timeline.mjs --relay wss://relay.damus.io --pubkey <hex> --limit 50
```

## Output

- デフォ: 読みやすいテキスト
- `--format jsonl` : 1行1イベント（後処理しやすい）
- `--format md` : Markdown（貼り付け向け）

## Notes / Gotchas

- フォロー取得は `kind:3` の最新1件を使う（`tags: [ ["p", <pubkey>] ... ]`）。
- TL取得は `REQ` の `authors` にフォローpubkey配列を入れて `kinds:[1]` を引く。
- Relayによっては著者数が多いと弾かれるので、必要なら `--maxAuthors` で分割する（スクリプト側でチャンクREQ）。
- 初回取得完了は `EOSE` を待つ。タイムアウト時は部分結果で出す（`--timeoutMs`）。

## Parameters (script)

- `--relay <wss://...>` (repeatable)
- `--npub <npub...>` or `--pubkey <hex>`
- `--limit <n>` (default 50)
- `--since <unix>` / `--until <unix>` (秒)
- `--format text|md|jsonl`
- `--includeReposts` (kind:6も拾う)
- `--timeoutMs <ms>` (default 8000)
- `--maxAuthors <n>` (default 250)

必要なら `skills/nostr-search` の「REQ→EVENT→EOSE」基本フローも併用。
