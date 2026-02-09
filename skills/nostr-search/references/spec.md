# Nostr Search Skill Spec (Design Draft)

## 1. 目的
- 何を検索したいか
- 何の意思決定に使うか
- 成功条件（例: 5分以内に最新20件取得）

## 2. 検索ユースケース
- キーワード検索
- ハッシュタグ検索
- 特定アカウント追跡（npub）
- スレッド/イベント追跡（note/nevent）
- 期間フィルタ付き調査

## 3. 入力仕様（案）
- query: string
- authors: string[] (npub/hex pubkey)
- tags: string[]
- since/until: unix timestamp
- limit: number
- lang: string (optional)
- sort: latest | relevance

## 4. 出力仕様（案）
- summary: string
- items[]:
  - eventId
  - pubkey
  - createdAt
  - contentPreview
  - matchedBy (keyword/tag/author)
  - score (optional)

## 5. フィルタ・品質ポリシー
- 重複除去ルール
- リポスト扱い
- bot/スパム低減ルール
- NSFW/センシティブ取り扱い

## 6. API/Relay 設計論点
- どのRelay/APIを一次情報源にするか
- タイムアウト・再試行
- ページング
- レート制限対策

## 7. 運用設計
- 手動検索 vs 定期検索
- cron連携時の通知文面
- 障害時アラート

## 8. 未決定事項
- [ ] 初期対応ユースケースの優先順
- [ ] 最低限サポートする入力パラメータ
- [ ] 結果の整形粒度（短文/詳細）
- [ ] 利用するNostrデータ取得手段
