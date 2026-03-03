#!/usr/bin/env -S npx tsx
import { Codex } from "@openai/codex-sdk";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type Lang = "ja" | "en";

function runGit(args: string[]) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || "Unknown git error.";
    throw new Error(stderr);
  }
  return result.stdout;
}

function getStagedDiff() {
  return runGit(["diff", "--staged", "--no-color"]);
}

function sanitizeMessage(raw: string) {
  const firstLine = raw
    .trim()
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0) ?? "";

  return firstLine.replace(/^['"`]+|['"`]+$/g, "").trim();
}

function buildPrompt(diff: string, lang: Lang) {
  const langInstruction =
    lang === "ja"
      ? "コミットメッセージは日本語で作成してください。"
      : "Write the commit message in English.";

  return [
    "あなたはGitコミットメッセージ生成の専門家です。",
    langInstruction,
    "以下の条件を厳守してください:",
    "- git diff --staged の内容から意図を要約する",
    "- Conventional Commits 形式で1行のみ返す（feat:, fix:, chore:, refactor:, docs:, test:, ci: など）",
    "- 余計な説明、引用符、コードブロック、接頭辞は出力しない",
    "- 返答はコミットメッセージ本文のみ",
    "",
    "### git diff --staged",
    diff,
  ].join("\n");
}

async function generateMessage(diff: string, lang: Lang): Promise<string> {
  const codex = new Codex();
  const thread = codex.startThread();
  const turn = await thread.run(buildPrompt(diff, lang));
  const message = sanitizeMessage(turn.finalResponse ?? "");

  if (!message) {
    throw new Error("Codex returned an empty message.");
  }

  return message;
}

async function main() {
  const supportsRegenerate = process.argv.includes("--regenerate");
  const lang = ((process.env.COMMIT_LANG || "en").toLowerCase() === "ja" ? "ja" : "en") as Lang;

  let diff: string;
  try {
    diff = getStagedDiff();
  } catch (error) {
    console.error("❌ Failed to read staged diff:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (!diff.trim()) {
    console.error("❌ No staged changes found. Stage files first (git add ...) and try again.");
    process.exit(1);
  }

  const rl = createInterface({ input, output });

  try {
    while (true) {
      console.log(":robot: Generating commit message with Codex...\n");
      const message = await generateMessage(diff, lang);
      console.log(`  ${message}\n`);

      const prompt = supportsRegenerate
        ? "Commit with this message? (y/n/r): "
        : "Commit with this message? (y/n): ";

      const answer = (await rl.question(prompt)).trim().toLowerCase();

      if (answer === "y") {
        runGit(["commit", "-m", message]);
        console.log("✅ Committed.");
        break;
      }

      if (supportsRegenerate && answer === "r") {
        continue;
      }

      if (answer === "n") {
        console.log("⏹️ Commit canceled. Staging area was kept as-is.");
        break;
      }

      console.log("Please answer y or n" + (supportsRegenerate ? " or r." : "."));
    }
  } catch (error) {
    console.error("❌ Failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

void main();
