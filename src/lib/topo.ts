// Build-time topographic contour generator (marching squares over a
// sum-of-hills height field). Returns one SVG path per contour level.

interface Hill {
  x: number;
  y: number;
  h: number;
  r: number;
}

// Small deterministic PRNG so the map is the same on every build
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function contours({ width = 1200, height = 800, cols = 110, rows = 74, levels = 14, seed = 7 } = {}) {
  const rand = mulberry32(seed);
  const hills: Hill[] = Array.from({ length: 9 }, () => ({
    x: rand() * width,
    y: rand() * height,
    h: 0.4 + rand() * 0.8,
    r: 120 + rand() * 260,
  }));

  const field = (x: number, y: number) => {
    let v = 0;
    for (const k of hills) {
      const d2 = ((x - k.x) ** 2 + (y - k.y) ** 2) / (k.r * k.r);
      v += k.h * Math.exp(-d2);
    }
    // gentle ridging so the lines aren't perfect circles
    return v + 0.06 * Math.sin(x / 70 + Math.cos(y / 90)) + 0.05 * Math.cos(y / 55 - x / 140);
  };

  const dx = width / cols;
  const dy = height / rows;
  const grid: number[][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j <= rows; j++) {
    grid[j] = [];
    for (let i = 0; i <= cols; i++) {
      const v = field(i * dx, j * dy);
      grid[j][i] = v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }

  const paths: { d: string; index: boolean }[] = [];
  for (let l = 1; l <= levels; l++) {
    const iso = min + ((max - min) * l) / (levels + 1);
    let d = '';
    const lerp = (a: number, b: number) => (iso - a) / (b - a);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const tl = grid[j][i], tr = grid[j][i + 1], br = grid[j + 1][i + 1], bl = grid[j + 1][i];
        const c = (tl > iso ? 8 : 0) | (tr > iso ? 4 : 0) | (br > iso ? 2 : 0) | (bl > iso ? 1 : 0);
        if (c === 0 || c === 15) continue;
        const x = i * dx, y = j * dy;
        const top = [x + dx * lerp(tl, tr), y];
        const right = [x + dx, y + dy * lerp(tr, br)];
        const bottom = [x + dx * lerp(bl, br), y + dy];
        const left = [x, y + dy * lerp(tl, bl)];
        const seg = (a: number[], b: number[]) => {
          d += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
        };
        switch (c) {
          case 1: case 14: seg(left, bottom); break;
          case 2: case 13: seg(bottom, right); break;
          case 3: case 12: seg(left, right); break;
          case 4: case 11: seg(top, right); break;
          case 5: seg(left, top); seg(bottom, right); break;
          case 6: case 9: seg(top, bottom); break;
          case 7: case 8: seg(left, top); break;
          case 10: seg(top, right); seg(left, bottom); break;
        }
      }
    }
    // Every 5th line is a thicker "index contour", like a real USGS map
    paths.push({ d, index: l % 5 === 0 });
  }
  return { width, height, paths, peaks: hills.filter((h) => h.h > 0.9).map((h) => ({ x: h.x, y: h.y })) };
}
