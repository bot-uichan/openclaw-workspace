# dlsite-play-tui

DLsite PlayをTypeScript TUIで操作します（ブラウザ遷移なし運用）。

## できること
- ライブラリ取得（内部API v3）
- 検索
- ツリー表示（フォルダ展開/折りたたみ）
- 音声ファイルをキューに積んで連続再生
- 作品の一括ダウンロード
- 右上固定パネルでサムネ表示

## セットアップ
```bash
cd apps/dlsite-play-tui
npm i
npx playwright install chromium
npm run dev
```

## 操作
- `TAB`: フォーカス切替（Library / Tree / Queue）
- `c`: Cookie手動登録（header または JSON配列）
- `i`: PlaywrightでCookie自動取得（Cookie取得専用）
- `s`: 検索
- `l`: ライブラリ更新
- `Enter` (Library): 選択作品のtree取得してTreeへフォーカス移動
- `t`: tree再取得（ショートカット）
- `Enter` / `→` (Tree): フォルダ展開/折りたたみ、ファイルはキュー追加
- `←`: フォルダを閉じる
- `a`: 選択音声をキュー追加
- `A`: 選択フォルダ配下の音声を全キュー追加
- `n`: 次へ（再生中ならスキップ）
- `space`: 一時停止/再開
- `[ / ]`: 10秒シーク
- `- / =`: 音量ダウン/アップ
- `d`: 選択作品をダウンロード
- `q`: 終了

## 再生
- `ffplay`（ffmpeg同梱）を使用（`-nodisp -autoexit`）
- 動画は現状対象外（要望どおり一旦保留）

## 内部API
- `GET https://play.dlsite.com/api/v3/content/count?last=0`
- `GET https://play.dlsite.com/api/v3/content/sales?last=0`
- `POST https://play.dlsite.com/api/v3/content/works`
- `GET https://play.dl.dlsite.com/api/v3/download/sign/cookie?workno=RJ...`
- `GET {sign.url}ziptree.json`
- `GET {sign.url}optimized/{file}`
