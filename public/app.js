// State Management
let userPassword = sessionStorage.getItem('krillian_pw') || '';
let prompts = [];
let previousPrompts = [];
let currentRound = 0;
let totalScore = 0;
let totalDepth = 0; // Max 7,000m
let diveHistory = [];
let timerInterval = null;
let timeLeft = 25;

// DOM Elements
const screenLogin = document.getElementById('screen-login');
const screenLobby = document.getElementById('screen-lobby');
const screenGame = document.getElementById('screen-game');
const screenSummary = document.getElementById('screen-summary');
const hudStats = document.getElementById('hud-stats');
const depthSidebar = document.getElementById('depth-sidebar');

const oceanBg = document.getElementById('ocean-bg');
const depthLines = document.getElementById('depth-lines');
const subMarker = document.getElementById('sub-marker');
const subDepthLabel = document.getElementById('sub-depth-label');

// Initialize Background Bubbles
function createBubbles() {
  const container = document.getElementById('bubbles-container');
  container.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = Math.random() * 14 + 4;
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDuration = `${Math.random() * 6 + 4}s`;
    b.style.animationDelay = `${Math.random() * 5}s`;
    container.appendChild(b);
  }
}
createBubbles();

// Check saved password
if (userPassword) {
  showScreen(screenLobby);
}

function showScreen(screen) {
  [screenLogin, screenLobby, screenGame, screenSummary].forEach(s => s.classList.add('hidden'));
  screen.classList.remove('hidden');
}

// 1. Password Login Handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwInput = document.getElementById('password-input').value.trim();
  const loginBtn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');

  loginBtn.disabled = true;
  loginBtn.textContent = 'Verifying Sonar Key...';
  errorEl.classList.add('hidden');

  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwInput })
    });
    const data = await res.json();

    if (res.ok && data.authenticated) {
      userPassword = pwInput;
      sessionStorage.setItem('krillian_pw', userPassword);
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

// 2. Start New Dive (Fetches 7 AI Prompts from Vercel Serverless Function)
document.getElementById('start-dive-btn').addEventListener('click', startNewDive);
document.getElementById('play-again-btn').addEventListener('click', startNewDive);

async function startNewDive() {
  const startBtn = document.getElementById('start-dive-btn');
  const statusText = document.getElementById('lobby-status');

  showScreen(screenLobby);
  startBtn.disabled = true;
  statusText.classList.remove('hidden');

  try {
    const res = await fetch('/api/start-dive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: userPassword,
        previousPrompts
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start dive');

    prompts = data.prompts;
    previousPrompts.push(...prompts);
    currentRound = 0;
    totalScore = 0;
    totalDepth = 0;
    diveHistory = [];

    updateDepthVisuals(0);
    hudStats.classList.remove('hidden');
    depthSidebar.classList.remove('hidden');
    showScreen(screenGame);
    loadRound();
  } catch (err) {
    alert(err.message);
  } finally {
    startBtn.disabled = false;
    statusText.classList.add('hidden');
  }
}

// 3. Load Active Round & Start 25s Timer
function loadRound() {
  document.getElementById('hud-round').textContent = `${currentRound + 1}/7`;
  document.getElementById('prompt-text').textContent = prompts[currentRound];
  document.getElementById('round-result').classList.add('hidden');
  document.getElementById('answer-form').classList.remove('hidden');

  const input = document.getElementById('answer-input');
  input.value = '';
  input.disabled = false;
  input.focus();

  const submitBtn = document.getElementById('submit-answer-btn');
  submitBtn.disabled = false;
  submitBtn.textContent = 'Dive Deeper ⬇️';

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
      submitAnswer(''); // Auto-submit blank if oxygen runs out
    }
  }, 1000);
}

// 4. Submit Answer & Trigger Dive Animation
document.getElementById('answer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  clearInterval(timerInterval);
  const answer = document.getElementById('answer-input').value;
  submitAnswer(answer);
});

async function submitAnswer(answer) {
  const input = document.getElementById('answer-input');
  const submitBtn = document.getElementById('submit-answer-btn');
  input.disabled = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Scanning Sonar Reef...';

  try {
    const res = await fetch('/api/judge-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: userPassword,
        prompt: prompts[currentRound],
        answer
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error judging answer');

    // Update totals
    const startDepth = totalDepth;
    totalScore += data.points;
    totalDepth += data.meters;

    diveHistory.push({
      prompt: prompts[currentRound],
      answer: data.normalizedAnswer || answer || '(No Answer)',
      tier: data.tier,
      points: data.points,
      meters: data.meters,
      emoji: data.emoji
    });

    // Trigger Dive Animation if points > 0
    if (data.meters > 0) {
      triggerDiveAnimation(startDepth, totalDepth);
    }

    document.getElementById('hud-score').textContent = totalScore;

    // Populate Result Card
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
  }
}

// 5. Dive Animation & Ocean Depth Transitions
function triggerDiveAnimation(fromDepth, toDepth) {
  oceanBg.classList.add('diving-surge');
  screenGame.classList.add('diving-shake');

  // Animate numeric depth counter
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

  setTimeout(() => {
    oceanBg.classList.remove('diving-surge');
    screenGame.classList.remove('diving-shake');
  }, 1300);
}

function updateDepthVisuals(depth) {
  const ratio = Math.min(depth / 7000, 1);

  // Move Submarine Marker & Parallax Background Lines
  subMarker.style.top = `${ratio * 94}%`;
  depthLines.style.transform = `translateY(${ratio * 600}px)`;
  document.getElementById('hud-depth').textContent = depth;
  subDepthLabel.textContent = `${depth}m`;

  // Shift Ocean Color Palette by Depth Zone
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

// 6. Next Prompt or Final Summary
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

  // Overall Rank Title
  let rankTitle = 'Surface Drifter 🫧';
  if (totalScore >= 600) rankTitle = 'Legendary Trench Sovereign 🌟';
  else if (totalScore >= 480) rankTitle = 'Hadal Deep-Cut Master 🏮';
  else if (totalScore >= 350) rankTitle = 'Abyssal Giant Squid 🦑';
  else if (totalScore >= 200) rankTitle = 'Twilight Reef Schooler 🐟';
  else if (totalScore >= 100) rankTitle = 'Clever Shoal Diver 🤡';

  document.getElementById('final-rank-title').textContent = rankTitle;
  document.getElementById('emoji-share-strip').textContent = diveHistory.map(d => d.emoji).join('');

  const logContainer = document.getElementById('summary-log');
  logContainer.innerHTML = diveHistory.map((item, idx) => `
    <div class="log-row">
      <div class="log-left">
        <strong>${idx + 1}. ${item.answer}</strong>
        <span>${item.prompt}</span>
      </div>
      <div class="log-right">
        <div>${item.emoji} ${item.tier}</div>
        <small style="color:#38bdf8">+${item.points} pts (${item.meters}m)</small>
      </div>
    </div>
  `).join('');
}

// Shareable Dive Log
document.getElementById('copy-results-btn').addEventListener('click', () => {
  const emojis = diveHistory.map(d => d.emoji).join('');
  const text = `🦐 Krillian Unlimited\nDepth Reached: ${totalDepth}m / 7,000m\nOverall Score: ${totalScore} / 700\n${emojis}`;
  navigator.clipboard.writeText(text);
  const btn = document.getElementById('copy-results-btn');
  btn.textContent = '✅ Copied to Clipboard!';
  setTimeout(() => (btn.textContent = '📋 Share Dive Log'), 2000);
});
