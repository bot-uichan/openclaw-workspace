# dlsite-play-tui

TypeScript製 `play.dlsite.com` 操作用TUI。

## 機能

- ライブラリ取得（内部API v3）
- 検索
- 作品ごとのファイルtree表示（TUI内）
- tree選択ファイルの再生/表示（TUI操作起点）
- 選択作品の一括ダウンロード
- 右側固定パネルでサムネイル確認（`chafa` があれば画像プレビュー）
- Cookie登録（手動 / JSON / Playwright自動取得）

## セットアップ

```bash
cd apps/dlsite-play-tui
npm i
npx playwright install chromium
npm run dev
```

## キーバインド

- `c`: Cookie手動登録（`name=value; ...` または JSON配列）
- `i`: PlaywrightでCookie自動取得（Cookie取得専用）
- `s`: 検索
- `l`: ライブラリ更新
- `t`: 選択作品のfile tree取得
- `r`: treeで選んだファイルを再生/表示
- `p` / `Enter`: 作品ページを開く
- `d`: 選択作品をダウンロード
- `y`: 選択作品URLをコピー
- `/`: コマンドパレット
- `q`: 終了

## 内部API

- `GET https://play.dlsite.com/api/v3/content/count?last=0`
- `GET https://play.dlsite.com/api/v3/content/sales?last=0`
- `POST https://play.dlsite.com/api/v3/content/works`
- `GET https://play.dl.dlsite.com/api/v3/download/sign/cookie?workno=RJ...`
- `GET {sign.url}ziptree.json`
- `GET {sign.url}optimized/{file}`

## 備考

- サムネイルの画像描画は `chafa` があると見やすいです（無い場合はURL表示）。
- 再生/表示はOSの既定アプリで開きます。
