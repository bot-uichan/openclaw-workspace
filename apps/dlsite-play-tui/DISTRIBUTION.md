# DLsite Play TUI 配布ガイド（分離構成）

このプロジェクトは以下の2コンポーネント分離で配布します。

- `apps/dlsite-play-tui` : TUI本体（再生・検索・DL）
- `apps/dlsite-play-auth-helper` : 認証ヘルパー（NW.js UI）

> 方針: TUI本体からブラウザ自動操作依存を外し、認証UIをNW.js側へ分離。

---

## 1) ローカル開発ビルド

### TUI

```bash
cd apps/dlsite-play-tui
npm i
npm run build
```

### Auth Helper

```bash
cd apps/dlsite-play-auth-helper
npm i
npm run build
```

---

## 2) 実行

### 認証ヘルパーをPATHに置く（推奨）

```bash
cd apps/dlsite-play-auth-helper
npm link
```

これで `dlplay-auth-helper` コマンドが使えるようになります。

### TUI起動

```bash
cd apps/dlsite-play-tui
npm run dev
```

TUI上で `i` キーを押すと、`dlplay-auth-helper` を起動してCookieを取り込みます。

---

## 3) ヘルパーコマンドの場所を明示する

PATHに置けない環境は環境変数で指定可能です。

```bash
DLPLAY_AUTH_HELPER=/abs/path/to/dlplay-auth-helper npm run dev
```

---

## 4) バイナリ配布案

### A. まずはNode同梱配布（現実的）

- TUI本体を `pkg` などで単体化
- 認証ヘルパーは別添付
- 初回セットアップで `dlplay-auth-helper` のPATH登録だけ案内

### B. 認証ヘルパーは NW.js UI版（実装済み）

- `dlsite-play-auth-helper` は NW.js でログインUIを提供
- `dlplay-auth-helper` 実行時にNW.jsを起動
- 「Cookie書き出し」ボタンでJSONを一時ファイルへ保存し、CLIがstdoutでTUIへ返却

---

## 5) トラブルシュート

- `i` キーで失敗する: `dlplay-auth-helper` が見つからない可能性
  - `which dlplay-auth-helper`
  - `npm link` を再実行
- API疎通確認: TUIで `!` を押し、Diagnosticsを確認

---

## 6) 互換性メモ

- macOS / Linux / Windows で動作可能な設計
- TUI本体は Playwright 不要
- 認証部分のみ将来的にNW.jsや別実装へ差し替え可能
