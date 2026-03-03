# YouTube Shorts Scroll Blocker

YouTube Shortsで、スクロール/スワイプ/キー操作による次動画への移動を無効化する拡張機能です。

## できること
- マウスホイールでの上下移動をブロック
- モバイルのスワイプ（touchmove）をブロック
- `↑ / ↓ / PageUp / PageDown / Space / j / k` での移動をブロック
- Shortsページ (`/shorts/*`) では `overflow: hidden` でスクロールロック

## インストール（Chrome/Edge）
1. `chrome://extensions` を開く
2. 右上の **デベロッパーモード** をON
3. **パッケージ化されていない拡張機能を読み込む** をクリック
4. このフォルダ `youtube-shorts-no-scroll-extension` を選択

## 注意
- YouTube側のDOM変更により効かなくなる可能性があります
- `Shift + n / Shift + p` などYouTube固有ショートカットの挙動は将来変わる場合があります
