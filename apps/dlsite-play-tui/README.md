# dlsite-play-tui

TypeScript で作った `play.dlsite.com` 操作用 TUI です。

## 機能

- Cookie登録ログイン (`c`)
- PlaywrightでCookie自動取得 (`i`) ※Cookie取得専用
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
npx playwright install chromium
npm run dev
```

この版は、**PlaywrightはCookie取得専用**で使用します。
検索/ライブラリ/ダウンロード情報の取得は内部API(HTTP)を直接使用します。

主に利用する内部API:
- `GET https://play.dlsite.com/api/v3/content/count?last=0`
- `GET https://play.dlsite.com/api/v3/content/sales?last=0`
- `POST https://play.dlsite.com/api/v3/content/works`
- `GET https://play.dl.dlsite.com/api/v3/download/sign/cookie?workno=RJ...`
- `GET {sign.url}ziptree.json`

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

- `c`: Cookie登録（手動貼り付け）
- `i`: PlaywrightでCookie自動取得
- `s`: 検索
- `l`: ライブラリ更新
- `p` or `Enter`: 選択作品を開く/再生
- `d`: 選択作品のダウンロード実行
- `y`: 選択行の URL をコピー
- `/`: コマンドパレット (`pcookie` / `cookie-pw` も使用可能)
- `q`: 終了

## 注意

- サイト側 DOM 変更でセレクタがずれる可能性があります。
- ダウンロード/再生は、購入済み・視聴権限のある作品に限って利用してください。
