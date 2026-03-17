# Todoist連携メモ

- Token保存先: `.env.todoist`（gitignore対象）
- 一覧取得:
  - 今日 + 期限切れ: `node scripts/todoist-read.mjs`
  - 全件: `node scripts/todoist-read.mjs all --limit=50`
  - プロジェクト一覧: `node scripts/todoist-read.mjs projects`
