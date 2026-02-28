#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import open from "open";

type CookieKV = { name: string; value: string };

function parseCookieInput(raw: string): CookieKV[] {
  const s = raw.trim();
  if (!s) return [];

  if (s.startsWith("[")) {
    const arr = JSON.parse(s) as Array<{ name?: string; value?: string }>;
    return arr
      .filter((c) => typeof c?.name === "string" && typeof c?.value === "string")
      .map((c) => ({ name: c.name!.trim(), value: c.value! }));
  }

  return s
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      if (i <= 0) return null;
      return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim() };
    })
    .filter((v): v is CookieKV => Boolean(v?.name) && Boolean(v?.value));
}

async function main(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  output.write("DLsite Auth Helper\n");
  output.write("ブラウザでログイン画面を開きます。\n");
  await open("https://play.dlsite.com/library");

  output.write("\nログイン後、Cookieを貼り付けてください。\n");
  output.write("形式1: name=value; name2=value2\n");
  output.write("形式2: [{\"name\":\"...\",\"value\":\"...\"}]\n\n");

  const raw = await rl.question("cookie> ");
  rl.close();

  const cookies = parseCookieInput(raw);
  if (cookies.length === 0) {
    throw new Error("有効なcookieを解析できませんでした");
  }

  process.stdout.write(JSON.stringify({ cookies }));
}

main().catch((e) => {
  process.stderr.write(`auth-helper error: ${String(e)}\n`);
  process.exit(1);
});
