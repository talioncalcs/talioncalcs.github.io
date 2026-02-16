/* Talion Typing — Upgraded Phase 1
   Features:
   - settings modal fixed
   - timer starts on first typed character
   - vocab difficulty (easy/standard/hard/brutal)
   - anti-cheat: paste block, visibility/focus, keystroke timing analysis
   - weak-key heatmap, WPM graph, error breakdown
   - training modes
   - gamification (XP, levels, streak)
   - monetization placeholders and GA4 events
*/

// ------------ Helpers & DOM ------------
const $ = id => document.getElementById(id);

const modeSelect = $('modeSelect'), timeSelect = $('timeSelect'), vocabSelect = $('vocabSelect');
const difficultySelect = $('difficultySelect'), trainingMode = $('trainingMode');
const textDisplay = $('textDisplay'), inputArea = $('inputArea'), startBtn = $('startBtn'), resetBtn = $('resetBtn');
const timeLeftEl = $('timeLeft'), wpmEl = $('wpm'), cpmEl = $('cpm'), accuracyEl = $('accuracy');
const localLeaderboard = $('localLeaderboard'), saveScoreBtn = $('saveScoreBtn'), nameInput = $('nameInput');
const clearScoresBtn = $('clearScoresBtn'), resultActions = $('resultActions'), downloadCertBtn = $('downloadCertBtn');
const saveMessage = $('saveMessage'), keyboardEl = $('keyboard'), wpmChart = $('wpmChart'), errorBreakdown = $('errorBreakdown');
const openSettings = $('openSettings'), settingsModal = $('settingsModal'), closeSettings = $('closeSettings'), saveSettings = $('saveSettings');
const themeSelect = $('themeSelect'), showLiveWpm = $('showLiveWpm'), smoothCaret = $('smoothCaret'), typedEffect = $('typedEffect'), highlightMode = $('highlightMode'), blindMode = $('blindMode');

const STORAGE_SETTINGS = 'talion_typing_settings_v2';
const STORAGE_SCORES = 'talion_typing_scores_v2';
const STORAGE_STATS = 'talion_typing_stats_v2';

let timer = null, timerStarted = false, started = false;
let totalTime = 60, timeLeft = 60, mode = 'time';
let currentText = '', typedEvents = [], keyErrors = {}; // keyErrors: { 'a': count }
let runHistory = []; // last runs for chart
let settings = loadSettings();
let gamestate = loadGamestate();

// -------------- Vocabulary pools (tiered) --------------
const easyWords = "the and a to in is it you that he was for on are with as I his they be at one have this from or had by hot".split(' ');
const standardWords = "ability achieve across action activity actually address affect agency ahead allow almost among amount analysis apply area argue arrive article assume attention author avoid available average".split(' ');
const hardWords = "aberration acquiesce ameliorate amelioration anachronistic clandestine confluence consanguineous consummate contingent deleterious dichotomy disingenuous".split(' ');
const brutalWords = "juxtaposition sesquipedalian perspicacious vicissitude indefatigable obfuscation sycophant anfractuous concatenation antidisestablishmentarianism".split(' ');

// -------------- Keyboard layout for heatmap --------------
const keyboardRows = [
  ['~','1','2','3','4','5','6','7','8','9','0','-','='],
  ['q','w','e','r','t','y','u','i','o','p','[',']'],
  ['a','s','d','f','g','h','j','k','l',';','\''],
  ['z','x','c','v','b','n','m',',','.','/']
];

// ------------------ Settings & Storage ------------------
function loadSettings(){
  try { const raw = localStorage.getItem(STORAGE_SETTINGS); return raw ? JSON.parse(raw) : { theme:'light', showLiveWpm:true, smoothCaret:true, typedEffect:'keep', highlightMode:'letter', blindMode:false }; }
  catch(e){ return { theme:'light', showLiveWpm:true, smoothCaret:true, typedEffect:'keep', highlightMode:'letter', blindMode:false }; }
}
function saveSettings(){ localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings)); }
function loadGamestate(){
  try { const raw = localStorage.getItem('talion_gamestate_v1'); return raw ? JSON.parse(raw) : { xp:0, level:1, streak:0, lastDate:null }; }
  catch(e){ return { xp:0, level:1, streak:0, lastDate:null }; }
}
function persistGamestate(){ localStorage.setItem('talion_gamestate_v1', JSON.stringify(gamestate)); }

// ----------------- Utility -----------------
function randChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function now(){ return Date.now(); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// ---------------- Populate timeSelect depending on mode ----------------
function populateTimeSelect(){
  timeSelect.innerHTML = '';
  if(mode === 'time'){ [15,30,60,120].forEach(v=> { const o=document.createElement('option'); o.value=v; o.text=v+' seconds'; timeSelect.appendChild(o); }); timeSelect.value = totalTime; }
  else if(mode === 'words'){ [10,25,50,100].forEach(v=> { const o=document.createElement('option'); o.value=v; o.text=v+' words'; timeSelect.appendChild(o); }); timeSelect.value = 25; }
  else { const o=document.createElement('option'); o.value='single'; o.text='single passage'; timeSelect.appendChild(o); timeSelect.value='single'; }
}

// ------------------ Paragraph & word generation ------------------
function generateWordList(count, difficulty){
  let pool = standardWords;
  if(difficulty==='easy') pool = easyWords;
  else if(difficulty==='hard') pool = standardWords.concat(hardWords);
  else if(difficulty==='brutal') pool = standardWords.concat(hardWords).concat(brutalWords);
  const arr=[];
  for(let i=0;i<count;i++) arr.push(randChoice(pool));
  return arr.join(' ');
}
function chooseParagraph(){
  // training mode adjustments
  const vocab = vocabSelect.value;
  if(mode==='quote'){
    // pick a sentence-like text from combined pools
    const sentence = generateWordList(18, vocab);
    return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
  }
  // words mode/time mode default: random words (better speed practice)
  if(mode === 'time' || mode === 'words' || mode === 'custom'){
    // training modes override: weak-keys -> produce words containing weak letters; left/right hand -> filter pool
    const training = trainingMode.value;
    if(training === 'weak-keys'){
      // pick words containing user's weak letters (top errors)
      const weak = Object.keys(keyErrors).sort((a,b)=>keyErrors[b]-keyErrors[a]).slice(0,5).filter(Boolean);
      if(weak.length){
        // build words including weak letters
        const pool = standardWords.filter(w => weak.some(ch => w.includes(ch)));
        if(pool.length >= 5) return randChoice(pool) + ' ' + randChoice(pool) + ' ' + randChoice(pool) + ' ' + randChoice(pool);
      }
    }
    // fallback general random words
    return generateWordList(mode==='words' ? parseInt(timeSelect.value||25,10) : 30, vocab);
  }
  return generateWordList(30, vocab);
}

// ------------- Render text as spans --------------
function renderText(text){
  textDisplay.innerHTML = '';
  for(let i=0;i<text.length;i++){
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = text[i];
    textDisplay.appendChild(span);
  }
  const first = textDisplay.querySelector('span');
  if(first) first.classList.add('current');
  if(settings.typedEffect === 'hide') textDisplay.querySelectorAll('.char').forEach(s=>s.classList.add('hidden'));
}

// ------------- Keyboard heatmap render -------------
function renderKeyboard(){
  keyboardEl.innerHTML = '';
  keyboardRows.forEach(row => {
    const r = document.createElement('div'); r.className = 'krow';
    row.forEach(k => {
      const key = document.createElement('div'); key.className = 'key'; key.dataset.k = k;
      key.textContent = k.length>1? k : k.toUpperCase();
      r.appendChild(key);
    });
    keyboardEl.appendChild(r);
  });
  recolorKeyboard();
}
function recolorKeyboard(){
  // compute max errors
  const vals = Object.values(keyErrors); const max = vals.length? Math.max(...vals):1;
  keyboardEl.querySelectorAll('.key').forEach(el=>{
    const k = el.dataset.k.toLowerCase();
    const count = keyErrors[k] || 0;
    const ratio = count / (max || 1);
    if(count === 0){ el.classList.remove('high'); el.classList.remove('low'); el.style.background = ''; }
    else {
      // map ratio -> color: low -> light green, high -> light red
      const r = Math.round(255 * ratio), g = Math.round(240 - 120 * ratio);
      el.style.background = `rgba(${200 + r/2},${220 - r/3},${220 - r/2},0.95)`;
      el.classList.add('high');
    }
  });
}

// --------------- Chart (simple sparkline) ----------------
function renderWpmChart(){
  const ctx = wpmChart.getContext('2d');
  const w = wpmChart.width, h = wpmChart.height;
  ctx.clearRect(0,0,w,h);
  const data = runHistory.map(r=>r.wpm);
  if(!data.length) return ctx.fillText('No runs yet',10,20);
  const max = Math.max(...data), min = Math.min(...data);
  const pad = 10;
  ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 2; ctx.beginPath();
  data.forEach((v,i)=>{
    const x = pad + (i/(data.length-1 || 1))*(w-2*pad);
    const y = h - pad - ((v - min)/(max-min || 1))*(h-2*pad);
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill();
  });
  ctx.stroke();
}

// --------------- Error breakdown ----------------
function renderErrorBreakdown(){
  const entries = Object.entries(keyErrors).sort((a,b)=>b[1]-a[1]).slice(0,20);
  if(!entries.length) { errorBreakdown.innerHTML = '<div>No errors yet</div>'; return; }
  errorBreakdown.innerHTML = entries.map(([k,c]) => `<div>${k.toUpperCase()}: ${c}</div>`).join('');
}

// --------------- Local leaderboard ----------------
function getScores(){ try{ return JSON.parse(localStorage.getItem(STORAGE_SCORES) || '[]'); }catch(e){return []} }
function saveScoreObj(obj){ const arr = getScores(); arr.push(obj); arr.sort((a,b)=>b.wpm - a.wpm || b.accuracy - a.accuracy); localStorage.setItem(STORAGE_SCORES, JSON.stringify(arr.slice(0,50))); renderLeaderboard(); }
function renderLeaderboard(){ const arr = getScores(); localLeaderboard.innerHTML = arr.length? arr.map((s,i)=>`<div>${i+1}. <strong>${escapeHtml(s.name||'You')}</strong> — ${s.wpm} WPM • ${s.accuracy}% • ${new Date(s.time).toLocaleDateString()}</div>`).join('') : '<div>No saved scores yet.</div>'; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])); }

// ------------- Anti-cheat ----------------
let visibilityLost = false;
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) visibilityLost = true; });
window.addEventListener('blur', ()=> visibilityLost = true);
inputArea.addEventListener('paste', (e)=>{ e.preventDefault(); alert('Pasting is not allowed during test'); });

function detectCheat(typedEvents, correctChars, minutes){
  // simple heuristics: extremely low average keystroke, impossible CPM or visibility lost
  if(visibilityLost) return { flagged:true, reason:'Focus lost during run' };
  if(typedEvents.length < 2) return { flagged:false };
  const diffs = []; for(let i=1;i<typedEvents.length;i++) diffs.push(typedEvents[i]-typedEvents[i-1]);
  const avg = diffs.reduce((a,b)=>a+b,0)/diffs.length;
  const cpm = Math.round(correctChars / (minutes || 1));
  if(avg < 20) return { flagged:true, reason:'Unnaturally fast keystrokes' };
  if(cpm > 2000) return { flagged:true, reason:'Impossible CPM' };
  return { flagged:false };
}

// --------------- timer & test flow ----------------
function resetUI(newPara){
  clearInterval(timer); timerStarted=false; started=false;
  inputArea.value=''; inputArea.disabled = true; resultActions.classList.add('hidden'); saveMessage.textContent='';
  typedEvents=[]; keyErrors={}; recolorKeyboard();
  timeLeft = (mode==='time')? totalTime : (mode==='words'? parseInt(timeSelect.value,10) : totalTime);
  timeLeftEl.textContent = timeLeft; wpmEl.textContent = 0; cpmEl.textContent = 0; accuracyEl.textContent='100%';
  currentText = newPara || chooseParagraph();
  renderText(currentText);
}
function prepareTest(){
  // set mode/time
  mode = modeSelect.value;
  populateTimeSelect();
  totalTime = (mode==='time')? parseInt(timeSelect.value,10) : 60;
  resetUI();
  inputArea.disabled = false; inputArea.value=''; inputArea.focus();
  // GA: prepared
  if(typeof window.talionGtag === 'function') window.talionGtag('test_prepared',{mode, vocab:vocabSelect.value, difficulty:difficultySelect.value});
}
function startTimerOnFirstKey(){
  if(timerStarted || !mode || started) return;
  timerStarted = true;
  // GA: test_start
  try{ if(typeof window.talionGtag === 'function') window.talionGtag('test_start',{mode,difficulty:difficultySelect.value,vocab:vocabSelect.value}); }catch(e){}
  if(mode === 'time'){
    timeLeft = parseInt(timeSelect.value,10) || 60;
    timeLeftEl.textContent = timeLeft;
    timer = setInterval(()=>{
      timeLeft--; timeLeftEl.textContent = timeLeft; liveUpdate();
      if(timeLeft<=0){ clearInterval(timer); finishTest(); }
    },1000);
  } else {
    // for words/quote modes we still compute liveUpdate frequently
    timer = setInterval(()=>{ liveUpdate(); }, 400);
  }
  started = true;
}

// live update metrics while typing
function liveUpdate(){
  const typed = inputArea.value || '';
  highlightTyped(typed);
  const spans = textDisplay.querySelectorAll('span');
  let correctChars = 0;
  for(let i=0;i<typed.length;i++){ if(!spans[i]) break; if(typed[i] === spans[i].textContent) correctChars++; }
  const elapsedSecs = (mode==='time')? ( (parseInt(timeSelect.value,10)||60) - timeLeft ) : Math.max(1, (typed.length>0? (typedEvents.length? ((typedEvents[typedEvents.length-1]-typedEvents[0])/1000):1) : 1));
  const minutes = Math.max( (elapsedSecs/60), 1/60 );
  const cpm = Math.round((correctChars)/minutes); const wpm = Math.round((correctChars/5)/minutes);
  const accuracy = typed.length === 0 ? 100 : Math.round((correctChars / typed.length) * 100);
  if(settings.showLiveWpm) wpmEl.textContent = Math.max(0,wpm);
  cpmEl.textContent = Math.max(0,cpm); accuracyEl.textContent = (accuracy || 0) + '%';
}

// highlight typed (letter/word mode respected)
function highlightTyped(typed){
  const spans = textDisplay.querySelectorAll('span');
  spans.forEach((s,idx)=>{
    s.classList.remove('correct','incorrect','current','fade','hidden');
    const ch = typed[idx];
    if(ch == null) return;
    if(ch === s.textContent) s.classList.add('correct'); else { s.classList.add('incorrect'); const k = s.textContent.toLowerCase(); keyErrors[k] = (keyErrors[k]||0)+1; }
    if(settings.typedEffect === 'hide' && idx < typed.length) s.classList.remove('hidden');
    if(settings.typedEffect === 'fade' && idx < typed.length) s.classList.add('fade');
  });
  const caret = typed.length; if(spans[caret]) spans[caret].classList.add('current');
  recolorKeyboard();
  renderErrorBreakdown();
}

// finish test
function finishTest(forced){
  inputArea.disabled = true; started=false; clearInterval(timer);
  const typed = inputArea.value || ''; const spans = textDisplay.querySelectorAll('span');
  let correctChars = 0;
  for(let i=0;i<typed.length;i++){ if(!spans[i]) break; if(typed[i] === spans[i].textContent) correctChars++; }
  const minutes = (mode==='time')? (parseInt(timeSelect.value,10)/60) : Math.max(1, ((typedEvents.length>1)? ((typedEvents[typedEvents.length-1]-typedEvents[0])/1000)/60 : 1/60));
  const wpm = Math.round((correctChars/5)/minutes); const cpm = Math.round((correctChars)/minutes);
  const accuracy = typed.length===0 ? 0 : Math.round((correctChars/typed.length)*100);
  wpmEl.textContent = Math.max(0,wpm); cpmEl.textContent = Math.max(0,cpm); accuracyEl.textContent = (accuracy || 0) + '%';

  // anti-cheat
  const cheat = detectCheat(typedEvents, correctChars, minutes);
  if(cheat.flagged){ saveMessage.textContent = '⚠️ Suspicious run: ' + cheat.reason; }
  // GA event
  if(typeof window.talionGtag === 'function') window.talionGtag('test_finish',{mode,difficulty:difficultySelect.value,wpm,accuracy,cheat:!!cheat.flagged});

  // update runHistory & chart
  const run = { wpm, accuracy, time: new Date().toISOString() };
  runHistory = JSON.parse(localStorage.getItem(STORAGE_STATS) || '[]');
  runHistory.unshift(run); runHistory = runHistory.slice(0,20);
  localStorage.setItem(STORAGE_STATS, JSON.stringify(runHistory));
  renderWpmChart();

  // gamification: xp & streaks
  const xpGain = Math.round(wpm/2 + (accuracy/2));
  gamestate.xp += xpGain;
  if(gamestate.xp >= gamestate.level * 100){ gamestate.level++; gamestate.xp = 0; }
  const today = new Date().toDateString();
  if(gamestate.lastDate === today) { gamestate.streak = gamestate.streak + 1; } else { gamestate.streak = 1; gamestate.lastDate = today; }
  persistGamestate();

  // expose latest data to resultActions for saving
  resultActions.dataset.latest = JSON.stringify({ wpm, accuracy, cheat: cheat.flagged });
  resultActions.classList.remove('hidden');
  renderLeaderboard();
  renderErrorBreakdown();
  recolorKeyboard();
}

// ------------- event wiring ----------------
startBtn.addEventListener('click', ()=> { prepareTest(); });
resetBtn.addEventListener('click', ()=> { resetUI(); });

inputArea.addEventListener('keydown', (e)=>{
  // start on first real character (not control keys)
  if(!timerStarted && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
    startTimerOnFirstKey();
  }
  // expert difficulty: check space submission
  if(difficultySelect.value === 'expert' && e.key === ' '){
    const typedWords = inputArea.value.trim().split(/\s+/);
    const idx = typedWords.length - 1;
    const spans = Array.from(textDisplay.querySelectorAll('span')).map(s=>s.textContent).join('');
    const wordsOnDisplay = spans.split(/\s+/);
    if(wordsOnDisplay[idx] && wordsOnDisplay[idx] !== typedWords[idx]){
      clearInterval(timer); finishTest(true); return;
    }
  }
});

inputArea.addEventListener('input', (e)=>{
  // capture keystroke times (for anti-cheat)
  typedEvents.push(now());
  // start timer on first actual input character (also handles mobile)
  if(!timerStarted && inputArea.value.length > 0){ startTimerOnFirstKey(); }
  liveUpdate();
  // words mode finish when word count reached
  if(mode === 'words'){
    const typedWords = inputArea.value.trim()===''?0:inputArea.value.trim().split(/\s+/).length;
    if(typedWords >= parseInt(timeSelect.value||25,10)){ clearInterval(timer); finishTest(); }
  }
});

// prevent paste (already set) and block drag/drop text
inputArea.addEventListener('paste', e=>{ e.preventDefault(); alert('Pasting is not allowed during tests.'); });

// save score
saveScoreBtn.addEventListener('click', ()=>{
  const latest = JSON.parse(resultActions.dataset.latest || '{}');
  const name = (nameInput.value || 'You').trim().substring(0,30);
  if(!latest.wpm || latest.wpm <= 0){ saveMessage.textContent='Score must be > 0 to save.'; return; }
  const obj = { name, wpm: latest.wpm, accuracy: latest.accuracy, time: new Date().toISOString(), cheat: latest.cheat };
  saveScoreObj(obj);
  saveMessage.textContent = 'Saved locally';
  setTimeout(()=> saveMessage.textContent = '', 2500);
  if(typeof window.talionGtag === 'function') window.talionGtag('score_saved',{wpm:obj.wpm,accuracy:obj.accuracy});
});

clearScoresBtn.addEventListener('click', ()=>{ localStorage.removeItem(STORAGE_SCORES); renderLeaderboard(); });

// certificate download
downloadCertBtn.addEventListener('click', ()=>{
  const latest = JSON.parse(resultActions.dataset.latest || '{}');
  const name = (nameInput.value || 'You').trim().substring(0,30);
  const wpm = latest.wpm || 0; const acc = latest.accuracy || '0%';
  const canvas = document.createElement('canvas'); canvas.width=1200; canvas.height=675; const ctx = canvas.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#0d1b2a'; ctx.fillRect(0,0,canvas.width,120);
  ctx.fillStyle='#fff'; ctx.font='bold 34px Arial'; ctx.fillText('TalionCalcs — Typing Certificate',40,78);
  ctx.fillStyle='#111'; ctx.font='28px Arial'; ctx.fillText(`Name: ${name}`,40,200); ctx.fillText(`WPM: ${wpm}`,40,250); ctx.fillText(`Accuracy: ${acc}`,40,300);
  ctx.font='16px Arial'; ctx.fillStyle='#6b7280'; ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`,40,360);
  const url = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href=url; a.download=`typing-cert-${name.replace(/\s+/g,'_')}.png`; a.click();
});

// -------------- settings modal fix ----------------
openSettings.addEventListener('click', ()=> settingsModal.classList.remove('hidden'));
closeSettings && closeSettings.addEventListener('click', ()=> settingsModal.classList.add('hidden'));
// clicking outside closes
settingsModal.addEventListener('click', (e)=> { if(e.target === settingsModal) settingsModal.classList.add('hidden'); });
// esc key closes
document.addEventListener('keydown', (e)=> { if(e.key === 'Escape') settingsModal.classList.add('hidden'); });
// save settings
saveSettings && saveSettings.addEventListener('click', ()=>{
  settings.theme = themeSelect.value; settings.showLiveWpm = showLiveWpm.checked;
  settings.smoothCaret = smoothCaret.checked; settings.typedEffect = typedEffect.value;
  settings.highlightMode = highlightMode.value; settings.blindMode = blindMode.checked;
  saveSettings(); settingsModal.classList.add('hidden');
  alert('Settings saved.');
});

// ------------- initial boot -------------
function init(){
  // attach DOM defaults
  mode = modeSelect.value;
  populateTimeSelect();
  // apply settings UI
  themeSelect.value = settings.theme; showLiveWpm.checked = settings.showLiveWpm;
  smoothCaret.checked = settings.smoothCaret; typedEffect.value = settings.typedEffect;
  highlightMode.value = settings.highlightMode; blindMode.checked = settings.blindMode;
  // render keyboard & initial paragraph
  renderKeyboard();
  currentText = chooseParagraph();
  renderText(currentText);
  timeLeft = totalTime; timeLeftEl.textContent = timeLeft;
  renderLeaderboard();
  runHistory = JSON.parse(localStorage.getItem(STORAGE_STATS) || '[]');
  renderWpmChart();
  renderErrorBreakdown();
  document.getElementById('year').textContent = new Date().getFullYear();
}
init();
