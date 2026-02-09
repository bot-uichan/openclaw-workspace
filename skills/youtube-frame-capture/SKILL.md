---
name: youtube-frame-capture
description: YouTube動画の任意タイミングをスクリーンショット取得する手順。ユーザーが「◯秒地点を撮って」「YouTubeをスクショして」と依頼したときに使う。広告スキップ→全画面→再生開始→指定秒/適当な秒で撮影の固定フローを実行する。
---

# YouTube Frame Capture

YouTubeの動画フレームを安定して撮影する。

## 固定フロー（毎回）

1. 対象URLを開く（`https://www.youtube.com/watch?v=<id>`）
2. 画面サイズを設定する（推奨: `1920x1080`）
3. 広告を処理する
   - `ytp-ad-skip-button` / `ytp-skip-ad-button` があればクリック
   - 広告オーバーレイ閉じるボタンがあればクリック
4. 全画面にする（`ytp-fullscreen-button`）
5. 再生開始する（`video.play()`）
6. 秒数指定がある場合は `video.currentTime = 指定秒`
   - 指定がない場合は3〜8秒待って適当な地点で撮る
7. 少し待機してフレームを安定させる（500ms〜1500ms）
8. 一時停止してスクショを撮る

## 実装メモ（browserツール）

- 可能なら画質を先に上げる
  - `movie_player.setPlaybackQualityRange('hd1080')`
  - `movie_player.setPlaybackQuality('hd1080')`
- スクショは `fullPage:false` を使う
- プレイヤーだけ切りたい場合は `selector:'#movie_player'` を使う

## 失敗時のリカバリ

### `Something went wrong` が出る

1. `navigate` で同URLを再読込
2. もう一度固定フローを実行
3. 直らなければブラウザプロセスを再起動して再実行

### シークが効かない（`currentTime` が進まない）

1. いったん再生→数秒待機→一時停止
2. それでも0秒付近に戻る場合は、その時点の再生可能フレームで撮影して報告する

## 出力ルール

- ユーザーには「固定フローで撮影した」ことを短く伝える
- 失敗時は原因（広告/再生エラー/シーク不可）を明示する
- 画像送信を `message` ツールで行った場合、最終応答は `NO_REPLY` のみで返す
