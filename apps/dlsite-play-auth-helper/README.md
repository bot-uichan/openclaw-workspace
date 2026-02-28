# dlsite-play-auth-helper (NW.js)

DLsite Play TUI 用の認証ヘルパーです。

- `dlplay-auth-helper` を実行すると NW.js UI が起動
- DLsite にログイン後「Cookie書き出し」を押す
- Cookie JSON を stdout で返す（TUIが取り込み）

## Setup

```bash
cd apps/dlsite-play-auth-helper
npm i
npm run build
npm link
```

## Standalone test

```bash
dlplay-auth-helper
```

成功すると JSON が stdout に出力されます。
