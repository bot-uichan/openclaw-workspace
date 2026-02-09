---
name: nostr-search
description: NostrでRelayからデータを取得する手順を案内するためのスキル。Relay接続、REQ送信、EVENT受信、EOSE確認までの基本フローを説明したいときに使う。
---

# Nostr Relay Data Fetch

やることはシンプルです。`references/relay-data-acquisition.md` の手順に沿って進める。

## 最低限の手順

1. RelayにWebSocket接続する
2. `REQ` でフィルタを送る（kinds / authors / #t / since / until / limit）
3. `EVENT` を受信して集める
4. `EOSE` を受信して初回取得完了を判断する
5. 必要なら `CLOSE` で購読を閉じる

以上。実装詳細は別途決める。