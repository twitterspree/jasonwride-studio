// Ambient particle field — a lightweight stand-in for tsParticles.
// Soft dots drift randomly and swell when the cursor is near ("bubble" mode).
// Colour follows --accent-color, so theme switches recolour it for free.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
}

const DENSITY_AREA = 1920 * 1080; // 60 dots on a 1080p screen, scaled by viewport area
const DENSITY_COUNT = 60;
const BUBBLE_DISTANCE = 300;
const BUBBLE_SIZE = 8;

export function startParticles(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let particles: Particle[] = [];
  let width = 0;
  let height = 0;
  let color = readAccent();
  let mouse: { x: number; y: number } | null = null;
  let frame = 0;

  function readAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#FF9248';
  }

  function spawn(): Particle {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      r: 1 + Math.random() * 4,
      alpha: 0.05 + Math.random() * 0.15,
    };
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    const target = Math.max(20, Math.round((DENSITY_COUNT * width * height) / DENSITY_AREA));
    while (particles.length < target) particles.push(spawn());
    particles.length = Math.min(particles.length, target);
    draw();
  }

  function draw() {
    ctx!.clearRect(0, 0, width, height);
    ctx!.fillStyle = color;
    for (const p of particles) {
      let r = p.r;
      let alpha = p.alpha;
      if (mouse) {
        const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (d < BUBBLE_DISTANCE) {
          const t = 1 - d / BUBBLE_DISTANCE;
          r += (BUBBLE_SIZE - r) * t;
          alpha += (0.3 - alpha) * t;
        }
      }
      ctx!.globalAlpha = alpha;
      ctx!.beginPath();
      ctx!.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.globalAlpha = 1;
  }

  function step() {
    for (const p of particles) {
      // Gentle random wander
      p.vx += (Math.random() - 0.5) * 0.05;
      p.vy += (Math.random() - 0.5) * 0.05;
      p.vx = Math.max(-0.6, Math.min(0.6, p.vx));
      p.vy = Math.max(-0.6, Math.min(0.6, p.vy));
      p.x += p.vx;
      p.y += p.vy;
      // Wrap around the edges
      if (p.x < -10) p.x = width + 10;
      else if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10;
      else if (p.y > height + 10) p.y = -10;
    }
    draw();
    frame = requestAnimationFrame(step);
  }

  function start() {
    cancelAnimationFrame(frame);
    if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(step);
    else draw();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') mouse = { x: e.clientX, y: e.clientY };
  });
  document.documentElement.addEventListener('mouseleave', () => (mouse = null));
  document.addEventListener('visibilitychange', start);
  reducedMotion.addEventListener('change', start);

  // Recolour when ThemeDock changes data-theme or the custom accent
  new MutationObserver(() => {
    color = readAccent();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });

  resize();
  start();
}
