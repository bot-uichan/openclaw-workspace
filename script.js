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

  item.choices.forEach((choice, idx) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = choice;
    btn.addEventListener("click", () => selectAnswer(idx));
    choicesEl.appendChild(btn);
  });
}

function selectAnswer(selectedIndex) {
  const item = quizData[current];
  const buttons = Array.from(choicesEl.querySelectorAll("button"));

  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === item.answer) btn.classList.add("correct");
    if (idx === selectedIndex && idx !== item.answer) btn.classList.add("wrong");
  });

  if (selectedIndex === item.answer) {
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
