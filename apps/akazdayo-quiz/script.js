const quizData = [
  {
    question: "akazdayoのGitHubプロフィールに表示される名前は？",
    choices: ["Soma Noda", "Akira Sato", "Yuta Aki", "Noda Somae"],
    answer: 0,
    explanation: "GitHubのプロフィール見出しに『Soma Noda akazdayo』とあります。",
  },
  {
    question: "akazdayoの代表的な公開リポジトリとして確認できるものは？",
    choices: ["pixelart", "weather-bot", "unity-racing", "note-cms"],
    answer: 0,
    explanation: "Tavily結果で『akazdayo/pixelart: Pixelart converter』が確認できます。",
  },
  {
    question: "Streamlitフォーラム投稿で、Akazが興味を示している分野として述べたのは？",
    choices: ["データサイエンスとプログラミング", "法律と経営", "建築と土木", "天文学と量子化学"],
    answer: 0,
    explanation: "投稿文に『data science and programmingに強い関心』とあります。",
  },
  {
    question: "Tavily結果に含まれていた、akazdayoに関連するゲームプロフィールはどれ？",
    choices: ["osu!", "Valorant", "Apex Legends", "Steam Workshop"],
    answer: 0,
    explanation: "osu!のユーザーページ（/users/36394839/osu）がヒットしています。",
  },
  {
    question: "GitHubのピン留め情報などから読み取れるakazdayoの開発傾向として最も近いのは？",
    choices: ["Python/TypeScript系の個人開発を幅広く公開", "iOSアプリのみを専業開発", "機械学習を扱わずゲーム実況中心", "公開活動はほぼない"],
    answer: 0,
    explanation: "GitHubにはPython/TypeScriptなど複数言語の公開活動が見られます。",
  },
  {
    question: "『akazdayo/pixelart』の説明文として最も近いものはどれ？",
    choices: ["Pixelart converter", "Realtime stock predictor", "Discord moderation bot", "Docker image optimizer"],
    answer: 0,
    explanation: "リポジトリの説明は『Pixelart converter』です。",
  },
  {
    question: "Tavily検索で確認できた『pixelart』リポジトリのコミット履歴の規模感として正しいのは？",
    choices: ["100超のコミット履歴がある", "10未満しかない", "コミット履歴は非公開", "初回コミットのみ"],
    answer: 0,
    explanation: "検索結果スニペット上では『History 178 Commits』と表示されています。",
  },
  {
    question: "Streamlitフォーラムの投稿文で、AkazがPixelArt-Converterを作った理由に最も近いのは？",
    choices: ["既存アプリが自分の望む変換にならなかったから", "学校課題で必須だったから", "企業案件で納品が必要だったから", "GPU検証用ベンチマークだったから"],
    answer: 0,
    explanation: "『既存アプリが望み通りに変換してくれなかったので自作した』という趣旨です。",
  },
  {
    question: "GitHubプロフィールに表示されるAchievementとして、Tavily結果に含まれていたものは？",
    choices: ["Pull Shark", "Arctic Code Vault Contributor", "Mars Explorer", "Security Lab Champion"],
    answer: 0,
    explanation: "Tavilyの結果文面に『Pull Shark』が明記されています。",
  },
  {
    question: "GitHubプロフィールのPinnedに関する記述として、Tavily結果と一致するのはどれ？",
    choices: ["Pixelart converterがピン留め候補として見える", "全Pinnedが非公開で確認不可", "Go製CLIのみが並ぶ", "Webサイトは一切含まれない"],
    answer: 0,
    explanation: "スニペットに『Pinned』『Pixelart converter』の記載があります。",
  },
  {
    question: "Tavily結果に出たSnykの分析ページで、mc-server-auto-launchの状態として示されていたのは？",
    choices: ["Inactive寄り（直近コミットが少ない）", "急成長中で毎日更新", "重大脆弱性が多数", "スター数1万超"],
    answer: 0,
    explanation: "Snykの要約では更新頻度が低くInactive傾向とされています。",
  },
  {
    question: "Tavily結果に含まれたHugging Faceページで、akazdayo関連として見えるモデル名は？",
    choices: ["akazdayo/whisper-medium-onnx", "akazdayo/gpt-6-turbo", "akazdayo/stable-diffusion-xl-pro", "akazdayo/llama-500b"],
    answer: 0,
    explanation: "検索結果の一覧に『akazdayo/whisper-medium-onnx』が見えます。",
  },
  {
    question: "次のうち、Tavilyで得た『akazdayo像』として最も妥当なのは？",
    choices: ["開発・創作・ゲーム活動を横断して公開している", "金融機関向け監査業務のみをしている", "SNS運用のみで開発実績はない", "法務分野の論文投稿が中心"],
    answer: 0,
    explanation: "GitHub、osu!、Streamlit投稿など複数軸の公開活動が確認できます。",
  },
  {
    question: "このクイズの出典方針として正しいものはどれ？",
    choices: ["Tavily検索で得た公開情報のみを元にしている", "DMの非公開情報を混ぜている", "推測だけで作っている", "出典なしで作成している"],
    answer: 0,
    explanation: "ページ下部にTavily由来の公開ソースを明記しています。",
  },
  {
    question: "難問：Tavily結果だけを根拠にしたとき、最も慎重で正しい態度はどれ？",
    choices: ["断定しすぎず、ソースを併記して検証可能性を残す", "面白ければ事実確認は不要", "1件ヒットしたら全て真実として扱う", "出典URLは省略する"],
    answer: 0,
    explanation: "検索結果は要約や断片も含むため、出典提示と検証可能性が重要です。",
  },
];

let current = 0;
let score = 0;

const progressEl = document.getElementById("progress");
const questionEl = document.getElementById("question");
const choicesEl = document.getElementById("choices");
const feedbackEl = document.getElementById("feedback");
const nextBtn = document.getElementById("next-btn");
const resultEl = document.getElementById("result");
const scoreTextEl = document.getElementById("score-text");
const retryBtn = document.getElementById("retry-btn");
const quizCardEl = document.getElementById("quiz-card");

function renderQuestion() {
  const item = quizData[current];
  progressEl.textContent = `問題 ${current + 1} / ${quizData.length}`;
  questionEl.textContent = item.question;
  feedbackEl.textContent = "";
  nextBtn.hidden = true;
  choicesEl.innerHTML = "";

  const shuffledChoices = item.choices
    .map((choice, idx) => ({ text: choice, isCorrect: idx === item.answer }))
    .sort(() => Math.random() - 0.5);

  shuffledChoices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = choice.text;
    btn.dataset.correct = String(choice.isCorrect);
    btn.addEventListener("click", () => selectAnswer(choice.isCorrect, btn));
    choicesEl.appendChild(btn);
  });
}

function selectAnswer(selectedIsCorrect, selectedBtn) {
  const item = quizData[current];
  const buttons = Array.from(choicesEl.querySelectorAll("button"));

  buttons.forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.correct === "true") btn.classList.add("correct");
  });

  if (!selectedIsCorrect) {
    selectedBtn.classList.add("wrong");
  }

  if (selectedIsCorrect) {
    score += 1;
    feedbackEl.textContent = `正解！ ${item.explanation}`;
  } else {
    feedbackEl.textContent = `不正解… ${item.explanation}`;
  }

  nextBtn.hidden = false;
}

nextBtn.addEventListener("click", () => {
  current += 1;
  if (current >= quizData.length) {
    showResult();
  } else {
    renderQuestion();
  }
});

function showResult() {
  quizCardEl.hidden = true;
  resultEl.hidden = false;
  scoreTextEl.textContent = `${quizData.length}問中 ${score}問正解でした。`;
}

retryBtn.addEventListener("click", () => {
  current = 0;
  score = 0;
  resultEl.hidden = true;
  quizCardEl.hidden = false;
  renderQuestion();
});

renderQuestion();
