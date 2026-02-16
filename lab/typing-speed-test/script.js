// Talion Typing — Phase 1 (Monkeytype parity + extras)
// Assumes index.html includes gtag helper talionGtag(...) set earlier

(() => {
  // Elements
  const modeSelect = document.getElementById('modeSelect');
  const timeSelect = document.getElementById('timeSelect');
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const difficultySelect = document.getElementById('difficultySelect');
  const textDisplay = document.getElementById('textDisplay');
  const inputArea = document.getElementById('inputArea');
  const timeLeftEl = document.getElementById('timeLeft');
  const wpmEl = document.getElementById('wpm');
  const cpmEl = document.getElementById('cpm');
  const accuracyEl = document.getElementById('accuracy');
  const localLeaderboard = document.getElementById('localLeaderboard');
  const saveScoreBtn = document.getElementById('saveScoreBtn');
  const nameInput = document.getElementById('nameInput');
  const clearScoresBtn = document.getElementById('clearScoresBtn');
  const resultActions = document.getElementById('resultActions');
  const downloadCertBtn = document.getElementById('downloadCertBtn');
  const saveMessage = document.getElementById('saveMessage');

  // Settings modal
  const settingsModal = document.getElementById('settingsModal');
  const openSettings = document.getElementById('openSettings');
  const closeSettings = document.getElementById('closeSettings');
  const saveSettings = document.getElementById('saveSettings');
  const themeSelect = document.getElementById('themeSelect');
  const showLiveWpm = document.getElementById('showLiveWpm');
  const smoothCaret = document.getElementById('smoothCaret');
  const typedEffect = document.getElementById('typedEffect');
  const highlightMode = document.getElementById('highlightMode');
  const blindMode = document.getElementById('blindMode');

  // Paragraphs (pool)
  const paragraphs = [
    "Typing speed is an important skill in today's digital world. Regular practice can improve accuracy and increase your words per minute over time.",
    "Consistent short practice sessions produce better results than long sessions. Focus on accuracy first and speed will follow.",
    "Good posture and correct hand positioning help reduce fatigue and increase typing efficiency.",
    "Practice common words and punctuation. Real-text training gives better transfer to everyday typing tasks."
  ];

  // storage keys
  const STORAGE_SETTINGS = 'talion_typing_settings_v1';
  const STORAGE_SCORES = 'talion_typing_scores_v1';

  // state
  let currentText = '';
  let timer = null;
  let totalTime = 60;
  let timeLeft = 60;
  let started = false;
  let typedEvents = []; // timestamps for anti-cheat
  let keyErrors = {}; // per-character error counts
  let mode = 'time'; // time / words / quote / custom
  let settings = loadSettings();

  // --- util ---
  function $(id){return document.getElementById(id)}

  function loadSettings(){
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS)
      if(raw) return JSON.parse(raw)
    } catch(e){/*ignore*/}
    // defaults
    return {
      theme:'light', showLiveWpm:true, smoothCaret:true,
      typedEffect:'keep', highlightMode:'letter', blindMode:false
    }
  }
  function saveSettingsToStore(){
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings))
  }

  // apply settings UI
  function applySettingsToUI(){
    themeSelect.value = settings.theme;
    showLiveWpm.checked = !!settings.showLiveWpm;
    smoothCaret.checked = !!settings.smoothCaret;
    typedEffect.value = settings.typedEffect;
    highlightMode.value = settings.highlightMode;
    blindMode.checked = !!settings.blindMode;
    document.documentElement.setAttribute('data-theme', settings.theme);
  }

  // settings modal handlers
  openSettings.addEventListener('click', ()=> settingsModal.classList.remove('hidden'));
  closeSettings.addEventListener('click', ()=> settingsModal.classList.add('hidden'));
  saveSettings.addEventListener('click', ()=>{
    settings.theme = themeSelect.value;
    settings.showLiveWpm = showLiveWpm.checked;
    settings.smoothCaret = smoothCaret.checked;
    settings.typedEffect = typedEffect.value;
    settings.highlightMode = highlightMode.value;
    settings.blindMode = blindMode.checked;
    saveSettingsToStore();
    applySettingsToUI();
    settingsModal.classList.add('hidden');
  });

  // fill initial timeSelect values depending on mode
  function populateTimeSelect(){
    timeSelect.innerHTML = '';
    if(mode === 'time'){
      [15,30,60,120].forEach(v => {
        const o = document.createElement('option'); o.value = v; o.text = v + ' seconds'; timeSelect.appendChild(o);
      });
      timeSelect.value = totalTime;
    } else if(mode === 'words'){
      [10,25,50,100].forEach(v => {
        const o = document.createElement('option'); o.value = v; o.text = v + ' words'; timeSelect.appendChild(o);
      });
      timeSelect.value = 25; // default words
    } else if(mode === 'quote' || mode === 'custom'){
      const o = document.createElement('option'); o.value = 'single'; o.text = 'single passage'; timeSelect.appendChild(o);
      timeSelect.value = 'single';
    }
  }

  // choose paragraph
  function chooseParagraph(){
    return paragraphs[Math.floor(Math.random()*paragraphs.length)];
  }

  // render text into spans
  function renderText(text){
    textDisplay.innerHTML = '';
    for(let i=0;i<text.length;i++){
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = text[i];
      textDisplay.appendChild(span);
    }
    // first caret
    const first = textDisplay.querySelector('span');
    if(first) first.classList.add('current');
    if(settings.typedEffect === 'hide'){ textDisplay.querySelectorAll('.char').forEach(s=>s.classList.add('hidden')) }
  }

  // reset UI
  function resetUI(newParagraph){
    clearInterval(timer);
    started = false;
    inputArea.value = '';
    inputArea.disabled = true;
    resultActions.classList.add('hidden');
    saveMessage.textContent = '';
    typedEvents = [];
    keyErrors = {};
    // set mode/time defaults
    if(mode === 'time'){ totalTime = parseInt(timeSelect.value,10) || 60; timeLeft = totalTime }
    else if(mode === 'words'){ totalTime = null; timeLeft = parseInt(timeSelect.value,10) || 25 } // word count governs end
    else { totalTime = 60; timeLeft = 60 }
    timeLeftEl.textContent = timeLeft;
    wpmEl.textContent = 0; cpmEl.textContent = 0; accuracyEl.textContent = '100%';
    currentText = newParagraph ? newParagraph : (mode==='quote'? chooseParagraph() : chooseParagraph());
    renderText(currentText);
  }

  // start test
  function startTest(){
    if(started) return;
    started = true;
    // emit GA4 event
    if(typeof window.talionGtag==='function') window.talionGtag('test_start', {mode, difficulty: difficultySelect.value});
    typedEvents = [];
    // choose new paragraph for each run
    if(mode === 'custom'){
      const custom = prompt('Paste your custom text (short).','') || chooseParagraph();
      currentText = custom;
    } else if(mode === 'quote' || mode === 'time' || mode==='words'){
      currentText = chooseParagraph();
    }
    renderText(currentText);
    // compute totalTime for time-mode; for words mode totalTime will be null and we watch word count
    if(mode === 'time') totalTime = parseInt(timeSelect.value,10) || 60;
    timeLeft = (mode==='time')? totalTime : (mode==='words'? 9999 : totalTime);
    timeLeftEl.textContent = (mode==='time')? timeLeft : (mode==='words'? timeSelect.value : timeLeft);
    inputArea.disabled = false; inputArea.value = ''; inputArea.focus();
    resultActions.classList.add('hidden');

    // timer for time mode
    if(mode === 'time'){
      timer = setInterval(()=>{
        timeLeft--;
        timeLeftEl.textContent = timeLeft;
        liveUpdate();
        if(timeLeft<=0){ clearInterval(timer); finishTest(); }
      },1000);
    } else {
      // for words/quote/custom we still update live stats on interval (not countdown)
      timer = setInterval(()=>{ liveUpdate(); }, 500);
    }
  }

  // live update (WPM/CPM/accuracy)
  function liveUpdate(){
    const typed = inputArea.value || '';
    // update per-char highlights
    highlightTyped(typed);
    // compute correct chars
    const spans = textDisplay.querySelectorAll('span');
    let correctChars = 0;
    for(let i=0;i<typed.length;i++){
      if(!spans[i]) break;
      if(typed[i] === spans[i].textContent) correctChars++;
    }
    // elapsed minutes
    const elapsedSecs = ( (mode==='time' ? (totalTime - timeLeft) : 0) ) || 0;
    const elapsed = (elapsedSecs>0)? (elapsedSecs/60) : ( (mode==='time')? (0.0001) : (1/60) );
    const cpm = Math.round( (correctChars / (elapsed||1)) );
    const wpm = Math.round( (correctChars / 5) / (elapsed||1) );
    const accuracy = typed.length === 0 ? 100 : Math.round((correctChars / typed.length) * 100);
    if(settings.showLiveWpm) { wpmEl.textContent = Math.max(0,wpm); }
    cpmEl.textContent = Math.max(0,cpm);
    accuracyEl.textContent = (accuracy || 0) + '%';
  }

  // highlight typed letters / words and enforce difficulty
  function highlightTyped(typed){
    const spans = textDisplay.querySelectorAll('span');
    spans.forEach((s, idx) => {
      s.classList.remove('correct','incorrect','current','fade','hidden');
      if(settings.typedEffect === 'hide' && idx < typed.length) s.classList.remove('hidden');
      if(settings.typedEffect === 'fade' && idx < typed.length) s.classList.add('fade');
      const ch = typed[idx];
      if(ch==null){ /* not typed */ }
      else if(ch === s.textContent){ s.classList.add('correct') }
      else { s.classList.add('incorrect'); keyErrors[s.textContent] = (keyErrors[s.textContent]||0)+1 }
    });
    // mark caret
    const caret = typed.length;
    if(spans[caret]) spans[caret].classList.add('current');
    // difficulty checks
    if(difficultySelect.value === 'master'){
      // fail on any incorrect key immediately
      for(let i=0;i<typed.length;i++){
        if(!spans[i]) break;
        if(typed[i] !== spans[i].textContent){
          // end test
          clearInterval(timer);
          finishTest(true); // forced
          return;
        }
      }
    }
    if(difficultySelect.value === 'expert'){
      // if user presses space to submit word and last word is wrong -> fail on submit
      // For simplicity, check last typed char; actual expert behavior on space handled on keydown
    }
  }

  // finish test
  function finishTest(forced){
    inputArea.disabled = true;
    started = false;
    clearInterval(timer);
    resultActions.classList.remove('hidden');

    const typed = inputArea.value || '';
    const spans = textDisplay.querySelectorAll('span');
    let correctChars = 0;
    for(let i=0;i<typed.length;i++){
      if(!spans[i]) break;
      if(typed[i] === spans[i].textContent) correctChars++;
    }
    // compute metrics
    const minutes = (mode==='time') ? (totalTime/60) : (1); // approximate
    const wpm = Math.round( (correctChars / 5) / (mode==='time' ? (totalTime/60):1) );
    const cpm = Math.round( (correctChars) / (mode==='time' ? (totalTime/60):1) );
    const accuracy = typed.length === 0 ? 0 : Math.round((correctChars / typed.length) * 100);
    wpmEl.textContent = Math.max(0,wpm);
    cpmEl.textContent = Math.max(0,cpm);
    accuracyEl.textContent = (accuracy || 0) + '%';

    // per-key stats available in keyErrors
    // anti-cheat basic heuristic: if average inter-keystroke < 30ms or impossible CPM
    let cheatFlag = false;
    if(typedEvents.length > 5){
      let diffs = [], last = typedEvents[0];
      for(let i=1;i<typedEvents.length;i++){ diffs.push(typedEvents[i]-last); last=typedEvents[i]; }
      const avg = diffs.reduce((a,b)=>a+b,0)/diffs.length;
      if(avg < 20 || cpm > 2000) cheatFlag = true;
    }

    // GA event
    if(typeof window.talionGtag === 'function'){
      window.talionGtag('test_finish',{mode,difficulty:difficultySelect.value,wpm,accuracy,cheatFlag});
    }

    // store latest metrics in DOM dataset for save
    resultActions.dataset.latest = JSON.stringify({wpm,accuracy,cheatFlag});
    // mark spans for final view
    // already styled via highlightTyped
  }

  // keydown listener to detect expert submit (space) and record keystroke times
  inputArea.addEventListener('keydown', (e)=>{
    typedEvents.push(Date.now());
    if(difficultySelect.value === 'expert' && e.key === ' '){
      // check last word correctness: compare typed last word to displayed word
      const typed = inputArea.value;
      const typedWords = typed.trim().split(/\s+/);
      const lastWord = typedWords[typedWords.length-1] || '';
      // compute last displayed word by slicing spans
      const spans = Array.from(textDisplay.querySelectorAll('span')).map(s=>s.textContent).join('');
      const wordsOnDisplay = spans.split(/\s+/);
      const currentIndex = typedWords.length - 1;
      if(wordsOnDisplay[currentIndex] !== lastWord){
        // fail test immediately
        clearInterval(timer);
        finishTest(true);
      }
    }
  });

  // input listener to update live stats continually
  inputArea.addEventListener('input', (e)=>{
    // store key times for anti-cheat
    typedEvents.push(Date.now());
    liveUpdate();

    // if words mode and typed word count >= target -> finish
    if(mode === 'words'){
      const typedWords = (inputArea.value.trim()==='')?0:inputArea.value.trim().split(/\s+/).length;
      if(typedWords >= parseInt(timeSelect.value,10)){
        clearInterval(timer);
        finishTest();
      }
    }
  });

  // leaderboard local storage
  function getScores(){
    try { return JSON.parse(localStorage.getItem(STORAGE_SCORES) || '[]') } catch(e){ return [] }
  }
  function saveScoreObj(obj){
    const arr = getScores();
    arr.push(obj);
    arr.sort((a,b)=>b.wpm - a.wpm || b.accuracy - a.accuracy);
    localStorage.setItem(STORAGE_SCORES, JSON.stringify(arr.slice(0,30)));
    renderLeaderboard();
  }
  function renderLeaderboard(){
    const arr = getScores();
    if(arr.length===0) localLeaderboard.innerHTML = '<div>No saved scores yet.</div>';
    else {
      localLeaderboard.innerHTML = arr.map((s,i)=>`<div>${i+1}. <strong>${escapeHtml(s.name||'You')}</strong> — ${s.wpm} WPM • ${s.accuracy}% • ${new Date(s.time).toLocaleDateString()}</div>`).join('');
    }
  }
  function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m])) }

  saveScoreBtn.addEventListener('click', ()=>{
    const latest = JSON.parse(resultActions.dataset.latest || '{}');
    const name = (nameInput.value||'You').trim().substring(0,30);
    if(!latest.wpm || latest.wpm<=0){ saveMessage.textContent = 'Score must be > 0 to save.'; return; }
    const obj = { name, wpm: latest.wpm, accuracy: latest.accuracy, time: new Date().toISOString(), cheat: latest.cheatFlag||false };
    saveScoreObj(obj);
    saveMessage.textContent = 'Saved locally';
    setTimeout(()=>saveMessage.textContent='',2200);
    if(typeof window.talionGtag==='function') window.talionGtag('score_saved',{wpm:obj.wpm,accuracy:obj.accuracy});
  });

  clearScoresBtn.addEventListener('click', ()=>{ localStorage.removeItem(STORAGE_SCORES); renderLeaderboard(); });

  // certificate download (canvas)
  downloadCertBtn.addEventListener('click', ()=>{
    const latest = JSON.parse(resultActions.dataset.latest || '{}');
    const name = (nameInput.value||'You').trim().substring(0,30);
    const wpm = latest.wpm || 0;
    const acc = latest.accuracy || '0%';
    // canvas
    const canvas = document.createElement('canvas'); canvas.width=1200; canvas.height=675;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='#0d1b2a'; ctx.fillRect(0,0,canvas.width,120);
    ctx.fillStyle='#fff'; ctx.font='bold 34px Arial'; ctx.fillText('TalionCalcs — Typing Certificate',40,78);
    ctx.fillStyle='#111'; ctx.font='28px Arial'; ctx.fillText(`Name: ${name}`,40,200); ctx.fillText(`WPM: ${wpm}`,40,250); ctx.fillText(`Accuracy: ${acc}`,40,300);
    ctx.font='16px Arial'; ctx.fillStyle='#6b7280'; ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`,40,360);
    const url = canvas.toDataURL('image/png'); const a = document.createElement('a'); a.href=url; a.download=`typing-cert-${name.replace(/\s+/g,'_')}.png`; a.click();
  });

  // wire controls
  modeSelect.addEventListener('change', (e)=>{ mode = e.target.value; populateTimeSelect(); resetUI(); });
  timeSelect.addEventListener('change', ()=> resetUI());
  difficultySelect.addEventListener('change', ()=> resetUI());
  startBtn.addEventListener('click', ()=> startTest());
  resetBtn.addEventListener('click', ()=> resetUI());

  // init
  function init(){
    // load settings
    applySettingsToUI();
    // populate initial
    mode = modeSelect.value;
    populateTimeSelect();
    totalTime = 60; timeLeft = totalTime;
    document.getElementById('year').textContent = (new Date()).getFullYear();
    resetUI();
    renderLeaderboard();
    // recall saved settings to UI
    // disable textarea until start
    inputArea.disabled = true;

    // persist settings UI -> settings object
    themeSelect.addEventListener('change', ()=> settings.theme = themeSelect.value );
    showLiveWpm.addEventListener('change', ()=> settings.showLiveWpm = showLiveWpm.checked );
    smoothCaret.addEventListener('change', ()=> settings.smoothCaret = smoothCaret.checked );
    typedEffect.addEventListener('change', ()=> settings.typedEffect = typedEffect.value );
    highlightMode.addEventListener('change', ()=> settings.highlightMode = highlightMode.value );
    blindMode.addEventListener('change', ()=> settings.blindMode = blindMode.checked );
  }

  init();
})();
