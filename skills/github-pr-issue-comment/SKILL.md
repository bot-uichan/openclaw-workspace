---
name: github-pr-issue-comment
description: GitHubのIssue/PRへコメントを投稿・更新する。ユーザーが「PRにコメントして」「Issueに返信して」「レビュー依頼コメントを付けて」「改行付きで本文を直して」などを依頼したときに使う。
---

# github-pr-issue-comment

GitHub CLI (`gh`) で Issue / PR コメントを安全に投稿する。

## 手順
1. 対象リポジトリと番号を確定する。
   - 例: `owner/repo` と `#123`
2. 本文は**一度ファイルに書く**。
   - `\n` 混入やシェル展開事故を防ぐため、`--body-file` を優先する。
3. `gh issue comment` で投稿する。
   - PRも `gh issue comment` で同様にコメント可能。
4. 必要なら最新コメントを確認する。

## 推奨コマンド

### 新規コメント（Issue/PR共通）
```bash
cat > /tmp/gh-comment.md <<'EOF'
コメント本文（Markdown可）
EOF

gh issue comment <number> --repo <owner/repo> --body-file /tmp/gh-comment.md
```

### 直近コメント確認
```bash
gh issue view <number> --repo <owner/repo> --comments
```

## 注意点
- 本文をCLI引数 `--body "..."` で直接渡すのは最終手段。
- バッククォート `` ` `` を含む本文は、シェル解釈事故を起こしやすい。必ず `--body-file` を使う。
- 「PR本文の編集」は別操作（`gh pr edit --body-file`）。コメント投稿と混同しない。

## 短いテンプレ
```markdown
確認ありがとうございます！
以下を反映しました。
- 変更点A
- 変更点B

ご確認お願いします。
```
