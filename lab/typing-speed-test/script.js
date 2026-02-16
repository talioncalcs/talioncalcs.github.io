const textDisplay = document.getElementById("text-display");
const inputArea = document.getElementById("input-area");
const startBtn = document.getElementById("start-btn");
const timerElement = document.querySelector(".timer");
const resultBox = document.getElementById("result-box");
const wpmElement = document.getElementById("wpm");
const accuracyElement = document.getElementById("accuracy");

const sampleText = "Typing speed improves with regular practice and focus.";

let timeLeft = 60;
let timer;
let started = false;

textDisplay.innerText = sampleText;

startBtn.addEventListener("click", () => {
  if (!started) {
    inputArea.disabled = false;
    inputArea.focus();
    started = true;

    timer = setInterval(() => {
      timeLeft--;
      timerElement.innerText = timeLeft;

      if (timeLeft === 0) {
        clearInterval(timer);
        finishTest();
      }
    }, 1000);
  }
});

function finishTest() {
  inputArea.disabled = true;
  resultBox.classList.remove("hidden");

  const typedText = inputArea.value;
  const wordsTyped = typedText.trim().split(/\s+/).length;
  const minutes = 1;

  const wpm = wordsTyped / minutes;
  wpmElement.innerText = wpm;

  let correctChars = 0;
  for (let i = 0; i < typedText.length; i++) {
    if (typedText[i] === sampleText[i]) {
      correctChars++;
    }
  }

  const accuracy = (correctChars / typedText.length) * 100 || 0;
  accuracyElement.innerText = accuracy.toFixed(2);
}
