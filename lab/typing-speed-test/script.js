// Typing test script (vanilla JS)
// Features: multiple paragraphs, 30/60/120s, live char highlighting, WPM/CPM/accuracy,
// local leaderboard (localStorage), save score, download certificate (PNG)

(function () {
  // elements
  const textDisplay = document.getElementById("textDisplay");
  const inputArea = document.getElementById("inputArea");
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");
  const timeSelect = document.getElementById("timeSelect");
  const timeLeftEl = document.getElementById("timeLeft");
  const wpmEl = document.getElementById("wpm");
  const cpmEl = document.getElementById("cpm");
  const accuracyEl = document.getElementById("accuracy");
  const localLeaderboard = document.getElementById("localLeaderboard");
  const saveScoreBtn = document.getElementById("saveScoreBtn");
  const nameInput = document.getElementById("nameInput");
  const clearScoresBtn = document.getElementById("clearScoresBtn");
  const resultActions = document.getElementById("resultActions");
  const downloadCertBtn = document.getElementById("downloadCertBtn");
  const saveMessage = document.getElementById("saveMessage");

  // paragraphs pool (you can extend)
  const paragraphs = [
    "Typing speed is an important skill in today's digital world. Regular practice can improve accuracy and increase your words per minute over time.",
    "Consistent short practice sessions produce better results than long irregular sessions. Focus on accuracy first and speed will follow.",
    "Good posture and correct hand positioning help reduce fatigue and increase typing efficiency during long typing sessions.",
    "Practice common words and punctuation. Real-text training gives better transfer to everyday typing tasks.",
    "Many typing trainers use short sprints of 30 to 60 seconds to build both speed and focus in a single session.",
    "Try to minimize looking at the keyboard and train muscle memory for each letter. That is the fastest way to improve typing speed."
  ];

  let currentText = "";
  let timer = null;
  let totalTime = 60;
  let timeLeft = 60;
  let started = false;

  // helpers
  function chooseParagraph() {
    return paragraphs[Math.floor(Math.random() * paragraphs.length)];
  }

  function renderText(text) {
    textDisplay.innerHTML = "";
    for (let i = 0; i < text.length; i++) {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = text[i];
      textDisplay.appendChild(span);
    }
    // Mark first visible char as current (if any)
    const firstSpan = textDisplay.querySelector("span");
    if (firstSpan) firstSpan.classList.add("current");
  }

  function resetUI() {
    clearInterval(timer);
    started = false;
    inputArea.value = "";
    inputArea.disabled = true;
    resultActions.classList.add("hidden");
    saveMessage.textContent = "";
    timeLeft = parseInt(timeSelect.value, 10);
    timeLeftEl.textContent = timeLeft;
    wpmEl.textContent = 0;
    cpmEl.textContent = 0;
    accuracyEl.textContent = "100%";
    currentText = chooseParagraph();
    renderText(currentText);
  }

  function startTest() {
    if (started) return;
    started = true;
    totalTime = parseInt(timeSelect.value, 10);
    timeLeft = totalTime;
    timeLeftEl.textContent = timeLeft;
    inputArea.value = "";
    inputArea.disabled = false;
    inputArea.focus();
    resultActions.classList.add("hidden");
    saveMessage.textContent = "";

    // ensure we have a paragraph
    if (!currentText) {
      currentText = chooseParagraph();
      renderText(currentText);
    }

    timer = setInterval(() => {
      timeLeft--;
      timeLeftEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timer);
        finishTest();
      } else {
        // update live stats as user types
        calculateLiveStats();
      }
    }, 1000);
  }

  function calculateLiveStats() {
    const typed = inputArea.value || "";
    let correctChars = 0;
    const spans = textDisplay.querySelectorAll("span");
    for (let i = 0; i < typed.length; i++) {
      if (!spans[i]) break;
      if (typed[i] === spans[i].textContent) correctChars++;
    }
    const elapsed = (totalTime - timeLeft) / 60 || 1 / 60; // minutes
    const cpm = Math.round((correctChars / (elapsed || 1)) || 0);
    const wpm = Math.round((correctChars / 5) / (elapsed || 1));
    const accuracy = typed.length === 0 ? 100 : Math.round((correctChars / typed.length) * 100);

    wpmEl.textContent = Math.max(0, wpm);
    cpmEl.textContent = Math.max(0, cpm);
    accuracyEl.textContent = (accuracy || 0) + "%";
  }

  function finishTest() {
    inputArea.disabled = true;
    started = false;
    resultActions.classList.remove("hidden");

    const typed = inputArea.value || "";
    const spans = textDisplay.querySelectorAll("span");
    let correctChars = 0;
    for (let i = 0; i < typed.length; i++) {
      if (!spans[i]) break;
      if (typed[i] === spans[i].textContent) correctChars++;
    }

    const minutes = totalTime / 60;
    const wpm = Math.round((correctChars / 5) / (minutes || 1));
    const cpm = Math.round((correctChars) / (minutes || 1));
    const accuracy = typed.length === 0 ? 0 : Math.round((correctChars / typed.length) * 100);

    wpmEl.textContent = Math.max(0, wpm);
    cpmEl.textContent = Math.max(0, cpm);
    accuracyEl.textContent = (accuracy || 0) + "%";

    // mark remaining spans without input as neutral
    markSpansForInput(typed);
  }

  function markSpansForInput(typed) {
    const spans = textDisplay.querySelectorAll("span");
    spans.forEach((span, idx) => {
      span.classList.remove("correct", "incorrect", "current");
      const ch = typed[idx];
      if (ch == null) {
        // not typed yet
      } else if (ch === span.textContent) {
        span.classList.add("correct");
      } else {
        span.classList.add("incorrect");
      }
    });
  }

  // live highlighting as user types
  inputArea.addEventListener("input", (e) => {
    const typed = e.target.value;
    const spans = textDisplay.querySelectorAll("span");
    spans.forEach((span, idx) => {
      span.classList.remove("correct", "incorrect", "current");
      const ch = typed[idx];
      if (ch == null) {
        // not typed yet
      } else if (ch === span.textContent) {
        span.classList.add("correct");
      } else {
        span.classList.add("incorrect");
      }
    });
    // highlight current caret char
    const caretIndex = typed.length;
    if (spans[caretIndex]) spans[caretIndex].classList.add("current");

    // update live stats quickly
    if (started) calculateLiveStats();
  });

  // start/reset handlers
  startBtn.addEventListener("click", startTest);
  resetBtn.addEventListener("click", function () {
    resetUI();
  });

  // keyboard: allow Enter to start when focused on textarea (first Enter starts)
  inputArea.addEventListener("keydown", (e) => {
    if (!started && e.key.length === 1) {
      // start on first typed character if not started
      startTest();
    }
  });

  // local leaderboard helpers
  const STORAGE_KEY = "talion_typing_scores_v1";

  function getScores() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function saveScoreObj(obj) {
    const arr = getScores();
    arr.push(obj);
    arr.sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy);
    const trimmed = arr.slice(0, 20); // keep top 20
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    renderLeaderboard();
  }

  function renderLeaderboard() {
    const scores = getScores();
    if (!scores || scores.length === 0) {
      localLeaderboard.innerHTML = "<div>No saved scores yet. Save your first attempt!</div>";
      return;
    }
    localLeaderboard.innerHTML = scores.map((s, i) => {
      const d = new Date(s.time);
      return `<div>${i+1}. <strong>${escapeHtml(s.name || "You")}</strong> — ${s.wpm} WPM • ${s.accuracy}% • ${d.toLocaleDateString()}</div>`;
    }).join("");
  }

  // escape small html in names
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]; });
  }

  saveScoreBtn.addEventListener("click", () => {
    const typedName = (nameInput.value || "").trim().substring(0,30);
    const name = typedName || "You";
    const wpm = parseInt(wpmEl.textContent || "0", 10);
    const accText = accuracyEl.textContent || "0%";
    const accuracy = parseInt(accText.replace("%", ""), 10) || 0;
    const scoreObj = {
      name: name,
      wpm: wpm,
      accuracy: accuracy,
      time: new Date().toISOString()
    };
    if (wpm <= 0) {
      saveMessage.textContent = "Score must be > 0 to save.";
      return;
    }
    saveScoreObj(scoreObj);
    saveMessage.textContent = "Saved locally. View under Your Best Scores.";
    setTimeout(() => saveMessage.textContent = "", 3000);
  });

  clearScoresBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    renderLeaderboard();
  });

  // simple certificate download using canvas
  downloadCertBtn.addEventListener("click", () => {
    const name = (nameInput.value || "You").trim().substring(0,30);
    const wpm = wpmEl.textContent || "0";
    const acc = accuracyEl.textContent || "0%";
    const date = new Date().toLocaleDateString();

    // create canvas
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 675;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // header
    ctx.fillStyle = "#0d1b2a";
    ctx.fillRect(0,0,canvas.width,120);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 36px Arial";
    ctx.fillText("TalionCalcs — Typing Certificate", 40, 76);

    // content
    ctx.fillStyle = "#111827";
    ctx.font = "28px Arial";
    ctx.fillText(`Name: ${name}`, 40, 200);
    ctx.fillText(`WPM: ${wpm}`, 40, 250);
    ctx.fillText(`Accuracy: ${acc}`, 40, 300);
    ctx.fillText(`Date: ${date}`, 40, 350);

    ctx.font = "18px Arial";
    ctx.fillText("This certifies that the above individual completed an online typing test.", 40, 420);

    // footer
    ctx.font = "16px Arial";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("talioncalcs.github.io — Talion Labs", 40, canvas.height - 40);

    // download
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `typing-certificate-${name.replace(/\s+/g,'_')}.png`;
    a.click();
  });

  // initial boot
  function init() {
    document.getElementById("year").textContent = new Date().getFullYear();
    currentText = chooseParagraph();
    renderText(currentText);
    timeLeft = parseInt(timeSelect.value, 10);
    timeLeftEl.textContent = timeLeft;
    renderLeaderboard();

    // enable live char highlighting by clicking Start or typing
    inputArea.disabled = true;

    // ensure we pick a new paragraph after each reset/start
    timeSelect.addEventListener("change", () => {
      timeLeft = parseInt(timeSelect.value, 10);
      timeLeftEl.textContent = timeLeft;
    });

    // pick new paragraph each time start is pressed (optional)
    startBtn.addEventListener("click", () => {
      currentText = chooseParagraph();
      renderText(currentText);
    });
  }

  init();
})();
