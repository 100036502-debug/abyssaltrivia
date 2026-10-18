let userPassword = sessionStorage.getItem('abyssal_pw') || '';
let prompts = [];
let previousPrompts = [];
let currentRound = 0;
let totalScore = 0;
let totalDepth = 0;
let diveHistory = [];
let timerInterval = null;
let timeLeft = 25;

// PWA Install Prompt Handler
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('install-pwa-btn').classList.remove('hidden');
});

document.getElementById('install-pwa-btn').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('install-pwa-btn').classList.add('hidden');
    }
    deferredPrompt = null;
  }
});

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const screenLogin = document.getElementById('screen-login');
const screenLobby = document.getElementById('screen-lobby');
const screenGame = document.getElementById('screen-game');
const screenSummary = document.getElementById('screen-summary');
const screenIntro = document.getElementById('screen-intro');
const hudStats = document.getElementById('hud-stats');
const depthSidebar = document.getElementById('depth-sidebar');
const oceanBg = document.getElementById('ocean-bg');
const depthLines = document.getElementById('depth-lines');
const subMarker = document.getElementById('sub-marker');
const subDepthLabel = document.getElementById('sub-depth-label');

function create Bubbles() {
  const container = document.getElementById('bubbles-container');
  container.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = Math.random() * 12 + 4;
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDuration = `${Math.random() * 6 + 4}s`;
    b.style.animationDelay = `${Math.random() * 5}s`;
    container.appendChild(b);
  }
}
createBubbles();

if (userPassword) showScreen(screenLobby);

function showScreen(screen) {
  [screenLogin, screenLobby, screenGame, screenSummary, screenIntro].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

// Password verification
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwInput = document.getElementById('password-input').value.trim();
  const loginBtn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  loginBtn.disabled = true;
  loginBtn.textContent = 'Verifying Sonar Key...';

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwInput })
    });
    const data = await res.json();
    if (res.ok && data.authenticated) {
      userPassword = pwInput;
      sessionStorage.setItem('abyssal_pw', userPassword);
      showScreen(screenLobby);
    } else {
      throw new Error(data.error || 'Invalid password');
    }
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Unlock Submersible';
  }
});

document.getElementById('start-dive-btn').addEventListener('click', startNewDive);
document.getElementById('play-again-btn').addEventListener('click', startNewDive);

async function startNewDive() {
  const startBtn = document.getElementById('start-dive-btn');
  const statusText = document.getElementById('lobby-status');

  startBtn.disabled = true;
  statusText.classList.remove('hidden');

  try {
    const res = await fetch('/api/start-dive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: userPassword, previousPrompts })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start dive');

    prompts = data.prompts;
    previousPrompts.push(...prompts);
    currentRound = 0;
    totalScore = 0;
    totalDepth = 0;
    diveHistory = [];

    // Trigger Cinematic Submarine Descent Intro before showing board
    showScreen(screenIntro);
    setTimeout(() => {
      updateDepthVisuals(0);
      hudStats.classList.remove('hidden');
      depthSidebar.classList.remove('hidden');
      showScreen(screenGame);
      loadRound();
    }, 2400);

  } catch (err) {
    alert(err.message);
  } finally {
    startBtn.disabled = false;
    statusText.classList.add('hidden');
  }
}

function loadRound() {
  document.getElementById('hud-round').textContent = `${currentRound + 1}/7`;
  document.getElementById('prompt-text').textContent = prompts[currentRound];
  document.getElementById('round-result').classList.add('hidden');
  document.getElementById('answer-form').classList.remove('hidden');
  document.getElementById('answer-feedback').classList.add('hidden');

  const input = document.getElementById('answer-input');
  input.value = '';
  input.disabled = false;
  input.focus();

  document.getElementById('submit-answer-btn').disabled = false;
  startTimer();
}

function startTimer() {
  clearInterval(timerInterval);
  timeLeft = 25;
  const timerCount = document.getElementById('timer-count');
  const timerBar = document.getElementById('timer-bar');

  timerCount.textContent = timeLeft;
  timerBar.style.width = '100%';

  timerInterval = setInterval(() => {
    timeLeft--;
    timerCount.textContent = timeLeft;
    timerBar.style.width = `${(timeLeft / 25) * 100}%`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      submitAnswer(''); // Auto submit blank if oxygen runs out
    }
  }, 1000);
}

// Answer submission with non-resetting timer for invalid/retry guesses
document.getElementById('answer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const answer = document.getElementById('answer-input').value;
  submitAnswer(answer);
});

async function submitAnswer(answer) {
  const input = document.getElementById('answer-input');
  const submitBtn = document.getElementById('submit-answer-btn');
  const feedbackEl = document.getElementById('answer-feedback');

  input.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Scanning Sonar...';
  feedbackEl.classList.add('hidden');

  try {
    const res = await fetch('/api/judge-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: userPassword, prompt: prompts[currentRound], answer })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error judging answer');

    // If answer is invalid or incorrect, allow user to keep guessing without restarting/resetting timer
    if (!data.valid || data.tier === 'Invalid') {
      input.disabled = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Answer ⬇️';
      feedbackEl.textContent = data.wittyComment || 'Invalid answer! Try another guess. Oxygen is still ticking!';
      feedbackEl.classList.remove('hidden');
      input.value = '';
      input.focus();
      return;
    }

    // Valid answer locked in! Stop timer for this round
    clearInterval(timerInterval);

    const startDepth = totalDepth;
    totalScore += data.points;
    totalDepth += data.meters;

    diveHistory.push({
      prompt: prompts[currentRound],
      answer: data.normalizedAnswer || answer,
      tier: data.tier,
      points: data.points,
      meters: data.meters,
      emoji: data.emoji
    });

    if (data.meters > 0) triggerDiveAnimation(startDepth, totalDepth);

    document.getElementById('hud-score').textContent = totalScore;
    document.getElementById('answer-form').classList.add('hidden');
    
    const resultBox = document.getElementById('round-result');
    const badge = document.getElementById('tier-badge');
    badge.textContent = `${data.emoji} ${data.tier.toUpperCase()}`;
    badge.style.background = getTierColor(data.tier);
    badge.style.color = data.tier === 'One in a Krillian' ? '#020617' : '#fff';

    document.getElementById('result-points').textContent = data.points;
    document.getElementById('result-meters').textContent = data.meters;
    document.getElementById('result-comment').textContent = data.wittyComment;
    document.getElementById('result-example').textContent = data.exampleOneInAKrillian;

    const nextBtn = document.getElementById('next-prompt-btn');
    nextBtn.textContent = currentRound < 6 ? 'Next Depth Prompt ➡️' : 'Surface & View Final Score ⚓';
    resultBox.classList.remove('hidden');

  } catch (err) {
    alert(err.message);
    input.disabled = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Answer ⬇️';
  }
}

function triggerDiveAnimation(fromDepth, toDepth) {
  const duration = 1200;
  const startTime = performance.now();
  const hudDepth = document.getElementById('hud-depth');

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const current = Math.floor(fromDepth + (toDepth - fromDepth) * progress);
    hudDepth.textContent = current;
    subDepthLabel.textContent = `${current}m`;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  updateDepthVisuals(toDepth);
}

function updateDepthVisuals(depth) {
  const ratio = Math.min(depth / 7000, 1);
  subMarker.style.top = `${ratio * 94}%`;
  depthLines.style.transform = `translateY(${ratio * 600}px)`;
  document.getElementById('hud-depth').textContent = depth;
  subDepthLabel.textContent = `${depth}m`;

  const zoneNameEl = document.getElementById('current-zone-name');
  if (depth < 1000) {
    document.documentElement.style.setProperty('--bg-top', '#0284c7');
    document.documentElement.style.setProperty('--bg-bottom', '#0f172a');
    zoneNameEl.textContent = '☀️ Sunlight Zone (0m - 1,000m)';
  } else if (depth < 2500) {
    document.documentElement.style.setProperty('--bg-top', '#0369a1');
    document.documentElement.style.setProperty('--bg-bottom', '#090d16');
    zoneNameEl.textContent = '🌅 Twilight Zone (1,000m - 2,500m)';
  } else if (depth < 4500) {
    document.documentElement.style.setProperty('--bg-top', '#1e1b4b');
    document.documentElement.style.setProperty('--bg-bottom', '#020617');
    zoneNameEl.textContent = '🌑 Midnight Zone (2,500m - 4,500m)';
  } else if (depth < 6000) {
    document.documentElement.style.setProperty('--bg-top', '#0f172a');
    document.documentElement.style.setProperty('--bg-bottom', '#000000');
    zoneNameEl.textContent = '🦑 Abyssal Zone (4,500m - 6,000m)';
  } else {
    document.documentElement.style.setProperty('--bg-top', '#020617');
    document.documentElement.style.setProperty('--bg-bottom', '#000000');
    zoneNameEl.textContent = '🏮 Hadal Trench (6,000m - 7,000m)';
  }
}

function getTierColor(tier) {
  switch (tier) {
    case 'Plankton': return '#475569';
    case 'Too Clever': return '#ea580c';
    case 'Schooler': return '#0284c7';
    case 'Rare': return '#9333ea';
    case 'Deep Cut': return '#db2777';
    case 'One in a Krillian': return '#fbbf24';
    default: return '#1e293b';
  }
}

document.getElementById('next-prompt-btn').addEventListener('click', () => {
  currentRound++;
  if (currentRound < 7) {
    loadRound();
  } else {
    showSummary();
  }
});

function showSummary() {
  showScreen(screenSummary);
  document.getElementById('final-depth').textContent = totalDepth;
  document.getElementById('final-score').textContent = totalScore;

  let rankTitle = 'Surface Drifter 🫧';
  if (totalScore >= 600) rankTitle = 'Legendary Trench Sovereign 🌟';
  else if (totalScore >= 480) rankTitle = 'Hadal Deep-Cut Master 🏮';
  else if (totalScore >= 350) rankTitle = 'Abyssal Giant Squid 🦑';
  else if (totalScore >= 200) rankTitle = 'Twilight Reef Schooler 🐟';
  else if (totalScore >= 100) rankTitle = 'Clever Shoal Diver 🤡';

  document.getElementById('final-rank-title').textContent = rankTitle;
  document.getElementById('emoji-share-strip').textContent = diveHistory.map(d => d.emoji).join('');

  document.getElementById('summary-log').innerHTML = diveHistory.map((item, idx) => `
    <div class="log-row">
      <div>
        <strong>${idx + 1}. ${item.answer}</strong>
        <span style="color:var(--text-muted);font-size:0.75rem">${item.prompt}</span>
      </div>
      <div style="text-align:right">
        <div>${item.emoji} ${item.tier}</div>
        <small style="color:#38bdf8">+${item.points} pts (${item.meters}m)</small>
      </div>
    </div>
  `).join('');
}

document.getElementById('copy-results-btn').addEventListener('click', () => {
  const emojis = diveHistory.map(d => d.emoji).join('');
  const text = `🤿 Abyssal Trivia\nDepth: ${totalDepth}m / 7,000m\nScore: ${totalScore} / 700\n${emojis}`;
  navigator.clipboard.writeText(text);
  const btn = document.getElementById('copy-results-btn');
  btn.textContent = '✅ Copied!';
  setTimeout(() => (btn.textContent = '📋 Share Dive Log'), 2000);
});
