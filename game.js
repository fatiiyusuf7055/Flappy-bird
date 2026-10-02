// ========= CONFIG =========
const CONFIG = {
  gravity: 0.5,
  flapStrength: -8,
  pipeWidth: 70,
  pipeGap: { easy: 220, normal: 170, hard: 130 },
  pipeSpacing: { easy: 320, normal: 280, hard: 240 },
  pipeSpeed: { easy: 3.2, normal: 4, hard: 4.8 },
  birdSize: 34,
};

// ========= STATE =========
let canvasW, canvasH;
let bird, pipes, particles, score, bestScore, state, frameCount = 0;
let difficulty = 'normal';
let theme = 'classic';
let soundEnabled = true;
let particlesEnabled = true;
let dayNightAuto = true;
let isNightMode = false;
let dayNightTimer = 0;
let audioCtx = null;
let lastFlap = 0;

const THEMES = {
  classic: { sky: [135, 206, 235], ground: [222, 184, 135], pipe: [80, 200, 80], pipeDark: [40, 140, 40] },
  space:   { sky: [10, 5, 40],     ground: [40, 20, 60],    pipe: [150, 100, 220], pipeDark: [80, 40, 140] },
  night:   { sky: [20, 24, 82],    ground: [30, 30, 50],    pipe: [100, 150, 220], pipeDark: [50, 80, 140] },
  sunset:  { sky: [255, 140, 90],  ground: [120, 60, 40],   pipe: [200, 100, 100], pipeDark: [140, 60, 60] },
};

// ========= DOM =========
const menuEl = document.getElementById('menu');
const settingsEl = document.getElementById('settings');
const gameoverEl = document.getElementById('gameover');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseBtn = document.getElementById('pause-btn');

// ========= P5 SETUP =========
function setup() {
  const container = document.getElementById('game-container');
  canvasW = container.clientWidth;
  canvasH = container.clientHeight;
  const cnv = createCanvas(canvasW, canvasH);
  cnv.parent(container);
  cnv.style('position', 'absolute');
  cnv.style('top', '0');
  cnv.style('left', '0');
  cnv.style('z-index', '1');

  bestScore = parseInt(localStorage.getItem('flappy_best') || '0');
  document.getElementById('menu-best').textContent = bestScore;

  resetGame();
  state = 'menu';
  bindUI();
  noStroke();
}

// ========= UI BINDINGS =========
function bindUI() {
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      difficulty = btn.dataset.diff;
    });
  });
  // Sélection par défaut
  document.querySelector('.diff-btn[data-diff="normal"]').classList.add('selected');

  document.getElementById('btn-play').addEventListener('click', startGame);
  document.getElementById('btn-settings').addEventListener('click', () => {
    menuEl.classList.remove('active');
    settingsEl.classList.add('active');
  });
  document.getElementById('btn-back').addEventListener('click', () => {
    settingsEl.classList.remove('active');
    menuEl.classList.add('active');
  });
  document.getElementById('btn-retry').addEventListener('click', startGame);
  document.getElementById('btn-home').addEventListener('click', () => {
    gameoverEl.classList.remove('active');
    menuEl.classList.add('active');
    document.getElementById('menu-best').textContent = bestScore;
    state = 'menu';
    resetGame();
    pauseBtn.classList.remove('visible');
  });

  // Thèmes
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      theme = btn.dataset.theme;
    });
  });
  document.querySelector('.theme-btn[data-theme="classic"]').classList.add('selected');

  document.getElementById('sound-toggle').addEventListener('change', e => soundEnabled = e.target.checked);
  document.getElementById('particles-toggle').addEventListener('change', e => particlesEnabled = e.target.checked);
  document.getElementById('daynight-toggle').addEventListener('change', e => dayNightAuto = e.target.checked);

  // Pause
  pauseBtn.addEventListener('click', togglePause);
  pauseOverlay.addEventListener('click', togglePause);
}

// ========= GAME CONTROL =========
function resetGame() {
  bird = { x: canvasW * 0.3, y: canvasH / 2, vy: 0, rotation: 0 };
  pipes = [];
  particles = [];
  score = 0;
  frameCount = 0;
  dayNightTimer = 0;
}

function startGame() {
  menuEl.classList.remove('active');
  settingsEl.classList.remove('active');
  gameoverEl.classList.remove('active');
  pauseOverlay.classList.remove('active');
  resetGame();
  state = 'playing';
  pauseBtn.classList.add('visible');
  flap();
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    pauseOverlay.classList.add('active');
  } else if (state === 'paused') {
    state = 'playing';
    pauseOverlay.classList.remove('active');
  }
}

function gameOver() {
  state = 'gameover';
  pauseBtn.classList.remove('visible');
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('flappy_best', bestScore);
  }
  document.getElementById('final-score').textContent = score;
  document.getElementById('best-score').textContent = bestScore;
  gameoverEl.classList.add('active');
  playSound('hit');
  if (particlesEnabled) burstParticles(bird.x, bird.y, 30);
}

// ========= INPUT =========
function flap() {
  if (state !== 'playing') return;
  bird.vy = CONFIG.flapStrength;
  lastFlap = millis();
  playSound('flap');
  if (particlesEnabled) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: bird.x - 10, y: bird.y + 10,
        vx: random(-2, -0.5), vy: random(-1, 1),
        life: 20, color: [255, 255, 255]
      });
    }
  }
}

function keyPressed() {
  if (key === ' ' || keyCode === UP_ARROW) {
    if (state === 'playing') flap();
    else if (state === 'menu') startGame();
    return false;
  }
  if (key === 'p' || key === 'P') togglePause();
}

function mousePressed() {
  if (state === 'playing') flap();
}

function touchStarted() {
  if (state === 'playing') {
    flap();
    return false;
  }
}

// ========= SONS (Web Audio API) =========
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
  if (!soundEnabled) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'flap') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'score') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  } else if (type === 'hit') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.4);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  }
}

// ========= PARTICULES =========
function burstParticles(x, y, n) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: random(-5, 5), vy: random(-6, 2),
      life: 40, color: [random(180, 255), random(100, 200), random(0, 100)]
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.25;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ========= UPDATE =========
function update() {
  if (state !== 'playing') return;

  // Bird
  bird.vy += CONFIG.gravity;
  bird.y += bird.vy;
  bird.rotation = constrain(map(bird.vy, -10, 10, -0.5, 1.2), -0.5, 1.2);

  // Collision sol/plafond
  if (bird.y + CONFIG.birdSize / 2 >= canvasH - 60) {
    bird.y = canvasH - 60 - CONFIG.birdSize / 2;
    return gameOver();
  }
  if (bird.y - CONFIG.birdSize / 2 < 0) {
    bird.y = CONFIG.birdSize / 2;
    bird.vy = 0;
  }

  // Pipes
  const speed = CONFIG.pipeSpeed[difficulty];
  const spacing = CONFIG.pipeSpacing[difficulty];
  const gap = CONFIG.pipeGap[difficulty];

  // Spawn
  if (pipes.length === 0 || pipes[pipes.length - 1].x < canvasW - spacing) {
    const minTop = 80;
    const maxTop = canvasH - 60 - gap - 80;
    const topH = random(minTop, maxTop);
    pipes.push({
      x: canvasW,
      topH,
      gap,
      width: CONFIG.pipeWidth,
      scored: false
    });
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= speed;

    // Score
    if (!p.scored && p.x + p.width < bird.x) {
      p.scored = true;
      score++;
      playSound('score');
      if (particlesEnabled) {
        for (let k = 0; k < 8; k++) {
          particles.push({
            x: bird.x, y: bird.y,
            vx: random(-3, 3), vy: random(-3, 3),
            life: 30, color: [255, 215, 0]
          });
        }
      }
    }

    // Collision
    if (bird.x + CONFIG.birdSize / 2 > p.x && bird.x - CONFIG.birdSize / 2 < p.x + p.width) {
      if (bird.y - CONFIG.birdSize / 2 < p.topH || bird.y + CONFIG.birdSize / 2 > p.topH + p.gap) {
        return gameOver();
      }
    }

    // Suppression
    if (p.x + p.width < 0) pipes.splice(i, 1);
  }

  updateParticles();

  // Cycle jour/nuit
  if (dayNightAuto) {
    dayNightTimer++;
    if (dayNightTimer > 900) { // ~15 sec
      isNightMode = !isNightMode;
      dayNightTimer = 0;
    }
  } else {
    isNightMode = (theme === 'night' || theme === 'space');
  }
}

// ========= DRAW =========
function draw() {
  update();
  drawBackground();
  drawPipes();
  drawGround();
  drawParticles();
  if (state !== 'menu') drawBird();
  drawScore();
  if (state === 'menu') drawMenuBird();
}

function drawBackground() {
  const t = THEMES[theme];
  let skyColor = [...t.sky];

  // Assombrir en mode nuit
  if (isNightMode) {
    skyColor = skyColor.map(c => c * 0.35);
  }

  // Dégradé
  for (let y = 0; y < canvasH; y++) {
    const inter = map(y, 0, canvasH, 0, 1);
    const c = lerpColor(
      color(skyColor[0], skyColor[1], skyColor[2]),
      color(skyColor[0] * 0.8, skyColor[1] * 0.85, skyColor[2]),
      inter
    );
    stroke(c);
    line(0, y, canvasW, y);
  }
  noStroke();

  // Étoiles en mode nuit
  if (isNightMode) {
    fill(255, 255, 255, 200);
    for (let i = 0; i < 40; i++) {
      const x = (i * 137.5) % canvasW;
      const y = (i * 71.3) % (canvasH - 60);
      circle(x, y, random(1, 3));
    }
  }

  // Nuages / planètes
  if (theme === 'space') {
    fill(180, 130, 220, 150);
    circle(canvasW * 0.8, 120, 90);
    fill(120, 80, 180, 100);
    circle(canvasW * 0.2, 250, 60);
  } else if (!isNightMode) {
    fill(255, 255, 255, 200);
    const cl = (frameCount * 0.3) % (canvasW + 200);
    circle(canvasW - cl + 100, 100, 60);
    circle(canvasW - cl + 140, 120, 45);
    const cl2 = (frameCount * 0.15 + 300) % (canvasW + 200);
    circle(canvasW - cl2 + 100, 200, 50);
  } else {
    // Lune
    fill(240, 240, 200, 220);
    circle(canvasW * 0.8, 90, 55);
    fill(220, 220, 180, 150);
    circle(canvasW * 0.78, 85, 12);
    circle(canvasW * 0.83, 100, 8);
  }
}

function drawPipes() {
  const t = THEMES[theme];
  for (const p of pipes) {
    // Corps du tuyau
    fill(t.pipe[0], t.pipe[1], t.pipe[2]);
    rect(p.x, 0, p.width, p.topH);
    rect(p.x, p.topH + p.gap, p.width, canvasH - 60 - p.topH - p.gap);

    // Ombre
    fill(t.pipeDark[0], t.pipeDark[1], t.pipeDark[2]);
    rect(p.x + p.width - 12, 0, 12, p.topH);
    rect(p.x + p.width - 12, p.topH + p.gap, 12, canvasH - 60 - p.topH - p.gap);

    // Contour
    noFill();
    stroke(0, 100);
    strokeWeight(2);
    rect(p.x, 0, p.width, p.topH);
    rect(p.x, p.topH + p.gap, p.width, canvasH - 60 - p.topH - p.gap);
    noStroke();

    // Bords (capuchons)
    fill(t.pipe[0] - 20, t.pipe[1] - 20, t.pipe[2] - 20);
    rect(p.x - 5, p.topH - 25, p.width + 10, 25, 4);
    rect(p.x - 5, p.topH + p.gap, p.width + 10, 25, 4);
    fill(t.pipe[0], t.pipe[1], t.pipe[2]);
    rect(p.x - 5, p.topH - 25, p.width + 10, 5, 4);
    rect(p.x - 5, p.topH + p.gap, p.width + 10, 5, 4);
  }
}

function drawGround() {
  const t = THEMES[theme];
  let g = t.ground;
  if (isNightMode) g = g.map(c => c * 0.4);
  fill(g[0], g[1], g[2]);
  rect(0, canvasH - 60, canvasW, 60);

  // Motif
  fill(0, 60);
  const offset = (frameCount * CONFIG.pipeSpeed[difficulty]) % 40;
  for (let x = -offset; x < canvasW; x += 40) {
    rect(x, canvasH - 55, 20, 4);
  }

  // Ligne supérieure
  fill(0, 100);
  rect(0, canvasH - 60, canvasW, 4);
}

function drawBird() {
  push();
  translate(bird.x, bird.y);
  rotate(bird.rotation);

  // Corps
  fill(255, 220, 60);
  stroke(0);
  strokeWeight(2);
  ellipse(0, 0, CONFIG.birdSize, CONFIG.birdSize * 0.85);

  // Aile
  const wingY = sin(frameCount * 0.5) * 3;
  fill(255, 180, 30);
  ellipse(-4, wingY, 16, 12);

  // Œil
  fill(255);
  ellipse(6, -6, 12, 12);
  fill(0);
  circle(8, -6, 6);
  fill(255);
  circle(9, -7, 2);

  // Bec
  fill(255, 100, 30);
  triangle(14, -2, 24, 2, 14, 6);

  // Contour corps
  noFill();
  stroke(0);
  strokeWeight(2);
  ellipse(0, 0, CONFIG.birdSize, CONFIG.birdSize * 0.85);

  pop();
}

function drawMenuBird() {
  push();
  translate(canvasW / 2, canvasH * 0.7);
  rotate(sin(frameCount * 0.05) * 0.2);
  fill(255, 220, 60);
  stroke(0);
  strokeWeight(2);
  ellipse(0, 0, CONFIG.birdSize + 10, CONFIG.birdSize);
  fill(255);
  ellipse(6, -6, 12, 12);
  fill(0);
  circle(8, -6, 6);
  fill(255, 100, 30);
  triangle(14, -2, 24, 2, 14, 6);
  noFill();
  ellipse(0, 0, CONFIG.birdSize + 10, CONFIG.birdSize);
  pop();
}

function drawParticles() {
  if (!particlesEnabled) return;
  for (const p of particles) {
    const a = p.life / 40 * 255;
    fill(p.color[0], p.color[1], p.color[2], a);
    circle(p.x, p.y, 6);
  }
}

function drawScore() {
  if (state === 'menu') return;
  fill(255);
  stroke(0);
  strokeWeight(4);
  textAlign(CENTER, TOP);
  textSize(48);
  text(score, canvasW / 2, 30);
  noStroke();
}

// ========= RESIZE =========
function windowResized() {
  const container = document.getElementById('game-container');
  canvasW = container.clientWidth;
  canvasH = container.clientHeight;
  resizeCanvas(canvasW, canvasH);
  if (state === 'menu') resetGame();
}