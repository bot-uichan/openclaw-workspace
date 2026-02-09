# NostrでRelayからデータを取得する手順

1. RelayにWebSocket接続する
2. `REQ` でフィルタを送る
   - 例: `kinds`, `authors`, `#t`, `since`, `until`, `limit`
3. Relayから `EVENT` を受信してデータを集める
4. `EOSE` を受信したら、初回の過去データ取得が完了
5. 継続監視しないなら `CLOSE` で購読を閉じる

## メモ
- Relayは複数使うと取りこぼしに強くなる
- 重複は `event.id` で除外する
- まずは期間と `limit` を指定して取得量を抑える
