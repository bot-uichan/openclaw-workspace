# DLsite Play TUI 配布ガイド（分離構成）

このプロジェクトは以下の2コンポーネント分離で配布します。

- `apps/dlsite-play-tui` : TUI本体（再生・検索・DL）
- `apps/dlsite-play-auth-helper` : 認証ヘルパー（ブラウザ誘導 + Cookie入力）

> 方針: TUI本体から Playwright 依存を外し、配布しやすくする。

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

### B. 認証ヘルパーを NW.js 化（将来）

- `dlsite-play-auth-helper` を NW.js UIに置換
- CookieをJSONで stdout / 一時ファイル経由でTUIへ返却
- TUI側は同じ `dlplay-auth-helper` 呼び出しのまま

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
