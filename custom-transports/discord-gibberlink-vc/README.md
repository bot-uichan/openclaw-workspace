# discord-gibberlink-vc transport

Discord の Bot token（`~/.openclaw/openclaw.json`）を読み取り、
指定VCへ参加しつつ、**`gibberlink` のみ**を受信/送信する最小 transport です。

## 仕様

- Token: `~/.openclaw/openclaw.json` の `channels.discord.token` を利用（ハードコードしない）
- VC参加: 起動時に `GUILD_ID` / `VOICE_CHANNEL_ID` で join
- 受信: `TEXT_CHANNEL_ID` のメッセージのうち `gibberlink` のみ受理
- 送信: 返信は常に `gibberlink` のみ

## セットアップ

```bash
cd custom-transports/discord-gibberlink-vc
pnpm install
cp .env.example .env
# .env に GUILD_ID / VOICE_CHANNEL_ID / TEXT_CHANNEL_ID を入れる
pnpm start
```

## 注意

- Bot に VC参加権限（Connect/Speak）とテキスト送信権限が必要
- この実装は「最小 transport（PoC）」です
- `gibberlink` 以外は無視します
