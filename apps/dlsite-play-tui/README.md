# dlsite-play-tui

TypeScript で作った `play.dlsite.com` 操作用 TUI です。

## 機能

- 作品検索 (`s`)
- ライブラリ一覧 (`l`)
- 作品ページ/再生ページを開く (`p` / Enter)
- 現在ページからダウンロード (`d`)
- URLコピー (`y`)
- コマンドパレット (`/`)

## セットアップ

```bash
cd apps/dlsite-play-tui
npm i
npx playwright install chromium
npm run dev
```

初回は Chromium が起動します。ログイン状態は `~/.cache/dlsite-play-tui/browser-profile` に保持されます。

## キーバインド

- `s`: 検索
- `l`: ライブラリ更新
- `p` or `Enter`: 選択作品を開く/再生
- `d`: ダウンロード実行（開いている作品ページのダウンロードボタンを押す）
- `y`: 選択行の URL をコピー
- `/`: コマンドパレット
- `q`: 終了

## 注意

- サイト側 DOM 変更でセレクタがずれる可能性があります。
- ダウンロード/再生は、購入済み・視聴権限のある作品に限って利用してください。
