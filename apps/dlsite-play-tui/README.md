# dlsite-play-tui

DLsite Play 用 TUI 本体。

## 方針
- 本体は Playwright 非依存
- 認証（Cookie取得）は外部ヘルパー `dlsite-tui-cookie-helper`（optional）

## セットアップ
```bash
cd apps/dlsite-play-tui
npm i
npm run build
```

CLIとして使う場合:
```bash
npm link
# -> dlsite-tui コマンドが使える
```

## コマンド
```bash
dlsite-tui run           # TUI起動（省略時デフォルト）
dlsite-tui cookie-import # 外部ヘルパーでCookie取得
dlsite-tui doctor        # Cookie/API/キャッシュ診断
```

## 認証ヘルパー（optional）
Playwright認証を使う場合は別途:

```bash
cd ../dlsite-play-cookie-helper
npm i
npm link
```

これで `dlsite-tui cookie-import` が動作します。

ヘルパーコマンドを明示したい場合:
```bash
DLPLAY_COOKIE_HELPER="dlsite-tui-cookie-helper" dlsite-tui cookie-import
```

## TUIキー（抜粋）
- `l`: ライブラリ更新（通常はキャッシュ優先）
- `t`: tree明示更新
- `?`: ヘルプ
- `!`: 診断
- `space`, `[`, `]`, `-`, `=`: 再生操作

## 内部API
- `GET https://play.dlsite.com/api/v3/content/count?last=0`
- `GET https://play.dlsite.com/api/v3/content/sales?last=0`
- `POST https://play.dlsite.com/api/v3/content/works`
- `GET https://play.dl.dlsite.com/api/v3/download/sign/cookie?workno=RJ...`
- `GET {sign.url}ziptree.json`
