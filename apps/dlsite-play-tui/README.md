# dlsite-play-tui

TypeScript で作った `play.dlsite.com` 操作用 TUI です。

## 機能

- Cookie登録ログイン (`c`)
- 作品検索 (`s`)
- ライブラリ一覧 (`l`)
- 作品ページ/再生ページを開く (`p` / Enter)
- 選択作品をダウンロード (`d`)
- URLコピー (`y`)
- コマンドパレット (`/`)

## セットアップ

```bash
cd apps/dlsite-play-tui
npm i
npm run dev
```

この版は **Playwright非依存** です。ログインはTUIからCookieを登録する方式です。

`c` キーで以下いずれかを貼り付けてください:

```txt
name=value; name2=value2; ...
```

```json
[
  {"name":"cookieA","value":"xxx"},
  {"name":"cookieB","value":"yyy"}
]
```

Cookieは `~/.cache/dlsite-play-tui/cookies.json` に保持されます。

## キーバインド

- `c`: Cookie登録
- `s`: 検索
- `l`: ライブラリ更新
- `p` or `Enter`: 選択作品を開く/再生
- `d`: 選択作品のダウンロード実行
- `y`: 選択行の URL をコピー
- `/`: コマンドパレット
- `q`: 終了

## 注意

- サイト側 DOM 変更でセレクタがずれる可能性があります。
- ダウンロード/再生は、購入済み・視聴権限のある作品に限って利用してください。
