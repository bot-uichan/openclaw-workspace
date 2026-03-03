# git-ai-commit

`git diff --staged` を Codex CLI SDK（`@openai/codex-sdk`）で要約し、Conventional Commits 形式の1行メッセージを提案してからコミットする TypeScript CLI です。

## Requirements

- Node.js 20+（または Bun）
- `codex login` 済み

## Install

```bash
npm install
# or
bun install
```

## Run

```bash
npx tsx src/cli.ts
```

`--regenerate` を付けると、確認時に `r` で何度でも再生成できます。

```bash
npx tsx src/cli.ts --regenerate
```

## Language switch

コミット文の言語は環境変数 `COMMIT_LANG` で切り替えます。

- `COMMIT_LANG=en` (default)
- `COMMIT_LANG=ja`

例:

```bash
COMMIT_LANG=ja npx tsx src/cli.ts
```

## Expected flow

1. `git diff --staged` を取得
2. Codex SDK で1行コミット文を生成
3. ターミナル表示
4. `y` で `git commit -m "..."` 実行
5. `n` でキャンセル（ステージングは維持）

## Output example

```text
:robot: Generating commit message with Codex...

  feat(auth): add JWT refresh token support

Commit with this message? (y/n):
```

## Git alias で `git commit` から呼ぶ

`git commit` をこのツールに置き換えるには、シェル関数 alias を使うのが安全です（再帰回避のため）。

```bash
git config --global alias.commit '!f() { npx tsx /ABSOLUTE/PATH/to/git-ai-commit/src/cli.ts "$@"; }; f'
```

`--regenerate` をデフォルトで有効にしたい場合:

```bash
git config --global alias.commit '!f() { npx tsx /ABSOLUTE/PATH/to/git-ai-commit/src/cli.ts --regenerate "$@"; }; f'
```

> `/ABSOLUTE/PATH/to/...` は実際の絶対パスに置き換えてください。

## `prepare-commit-msg` hook を使う方法（代替）

`.git/hooks/prepare-commit-msg` を作成して実行権限を付与します。

```bash
cat > .git/hooks/prepare-commit-msg <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

MSG_FILE="$1"
SOURCE="${2:-}"

# merge/squash など自動生成メッセージは触らない
if [[ "$SOURCE" == "merge" || "$SOURCE" == "squash" || "$SOURCE" == "commit" ]]; then
  exit 0
fi

# すでにメッセージがあるなら尊重
if [[ -s "$MSG_FILE" ]]; then
  exit 0
fi

COMMIT_MSG=$(npx tsx /ABSOLUTE/PATH/to/git-ai-commit/src/cli.ts --regenerate <<<'n' 2>/dev/null || true)
# NOTE: 上記は対話型CLIのため、hook運用時は非対話版を別途作るのが推奨。
HOOK

chmod +x .git/hooks/prepare-commit-msg
```

> このCLIは確認プロンプト付きの対話型です。hookで本格運用する場合は、
> 「生成のみして stdout に出す非対話モード（例: `--print-only`）」を追加すると運用しやすくなります。
