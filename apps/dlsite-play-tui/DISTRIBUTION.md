# DISTRIBUTION

## 目標構成

- `apps/dlsite-play-tui` … 本体バイナリ（Playwright非依存）
- `apps/dlsite-play-cookie-helper` … Cookie取得ヘルパー（Playwright依存, optional）

## 開発ビルド

```bash
cd apps/dlsite-play-tui
npm i
npm run build

cd ../dlsite-play-cookie-helper
npm i
```

## 利用者向け導線

### 1) 本体のみ

```bash
dlsite-tui run
```

### 2) 初回認証（必要時のみ）

```bash
dlsite-tui cookie-import
```

### 3) 問題時

```bash
dlsite-tui doctor
```

## ヘルパー導入（optional）

```bash
cd apps/dlsite-play-cookie-helper
npm i
npm link
```

`dlsite-tui cookie-import` は内部で `dlsite-tui-cookie-helper` を呼び出します。

## バイナリ化方針

- `dlsite-play-tui` を単体バイナリ化（pkg/nexe等）
- `dlsite-play-cookie-helper` は別配布（必要ユーザーのみ導入）
- これにより本体配布サイズ・依存トラブルを最小化
