import * as THREE from 'three';

export const FONT = "'Baloo 2', 'Arial Black', 'Segoe UI', sans-serif";
export const COMIC_FONT = "'Bangers', 'Impact', 'Arial Black', sans-serif";

const cache = new Map<string, THREE.CanvasTexture>();

export function canvasTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: boolean; srgb?: boolean } = {},
): THREE.CanvasTexture {
  const existing = cache.get(key);
  if (existing) return existing;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Textures are cheap to keep; this exists for completeness / tests. */
export function disposeTextures(): void {
  cache.forEach((t) => t.dispose());
  cache.clear();
}

export function stripes(key: string, a: string, b: string, n = 6): THREE.CanvasTexture {
  return canvasTexture(
    'stripes:' + key,
    128,
    32,
    (ctx, w, h) => {
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = b;
      const sw = w / n;
      for (let i = -1; i < n + 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * sw, h);
        ctx.lineTo(i * sw + sw / 2, h);
        ctx.lineTo(i * sw + sw, 0);
        ctx.lineTo(i * sw + sw / 2, 0);
        ctx.closePath();
        ctx.fill();
      }
    },
    { repeat: true },
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

export interface SignOpts {
  bg: string;
  fg: string;
  border?: string;
  sub?: string;
  subColor?: string;
  font?: string;
  stripe?: boolean;
  w?: number;
  h?: number;
}

/** A signboard / poster / banner with auto-fitting text. */
export function sign(text: string, o: SignOpts): THREE.CanvasTexture {
  const w = o.w ?? 512;
  const h = o.h ?? 256;
  return canvasTexture(`sign:${text}|${JSON.stringify(o)}`, w, h, (ctx) => {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, w, h);
    if (o.stripe) {
      ctx.save();
      ctx.fillStyle = '#111';
      for (let i = -h; i < w; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 20, 0);
        ctx.lineTo(i + 20 + h * 0.1, h * 0.1);
        ctx.lineTo(i + h * 0.1, h * 0.1);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(i, h * 0.9);
        ctx.lineTo(i + 20, h * 0.9);
        ctx.lineTo(i + 20 + h * 0.1, h);
        ctx.lineTo(i + h * 0.1, h);
        ctx.fill();
      }
      ctx.restore();
    }
    if (o.border) {
      ctx.strokeStyle = o.border;
      ctx.lineWidth = Math.max(6, w / 50);
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
    }
    const font = o.font ?? FONT;
    const pad = w * 0.07;
    const subH = o.sub ? h * 0.16 : 0;
    const area = h * (o.stripe ? 0.72 : 0.84) - subH;
    let size = Math.floor(h * 0.42);
    let lines: string[] = [];
    for (; size > 10; size -= 2) {
      ctx.font = `900 ${size}px ${font}`;
      lines = wrapText(ctx, text, w - pad * 2);
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if (lines.length * size * 1.02 <= area && widest <= w - pad * 2) break;
    }
    ctx.fillStyle = o.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const top = (h - subH - lines.length * size * 1.02) / 2 + size * 0.55;
    lines.forEach((l, i) => ctx.fillText(l, w / 2, top + i * size * 1.02));
    if (o.sub) {
      let subSize = Math.floor(subH * 0.7);
      ctx.font = `700 ${subSize}px ${FONT}`;
      while (subSize > 8 && ctx.measureText(o.sub).width > w - pad * 2) {
        subSize -= 1;
        ctx.font = `700 ${subSize}px ${FONT}`;
      }
      ctx.fillStyle = o.subColor ?? o.fg;
      ctx.fillText(o.sub, w / 2, h - subH * 0.75 - (o.stripe ? h * 0.1 : 0));
    }
  });
}

export function roadTexture(): THREE.CanvasTexture {
  return canvasTexture(
    'road',
    256,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#4b4b55';
      ctx.fillRect(0, 0, w, h);
      // Asphalt grain.
      for (let i = 0; i < 1800; i++) {
        const g = 60 + Math.random() * 40;
        ctx.fillStyle = `rgba(${g},${g},${g + 6},0.5)`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      // Lane width 2.2 of 6.6 → boundaries at 1/3 and 2/3.
      ctx.fillStyle = '#f4f4f0';
      for (const fx of [1 / 3, 2 / 3]) {
        for (let y = 0; y < h; y += 128) ctx.fillRect(fx * w - 3, y + 16, 6, 72);
      }
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(4, 0, 6, h);
      ctx.fillRect(w - 10, 0, 6, h);
      // Decorative (non-colliding) cracks and patches.
      ctx.strokeStyle = 'rgba(30,30,34,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        let x = Math.random() * w;
        let y = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (Math.random() - 0.5) * 30;
          y += Math.random() * 18;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(70,70,78,0.8)';
      ctx.fillRect(40, 300, 50, 30);
      ctx.fillRect(170, 80, 40, 22);
    },
    { repeat: true },
  );
}

export function tilesTexture(): THREE.CanvasTexture {
  return canvasTexture(
    'tiles',
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo((i * w) / 4, 0);
        ctx.lineTo((i * w) / 4, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, (i * h) / 4);
        ctx.lineTo(w, (i * h) / 4);
        ctx.stroke();
      }
    },
    { repeat: true },
  );
}

export function dustTexture(): THREE.CanvasTexture {
  return canvasTexture(
    'dust',
    128,
    128,
    (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const g = 150 + Math.random() * 105;
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
      }
    },
    { repeat: true },
  );
}

export type FacadeStyle = 'shop' | 'apartment' | 'haveli' | 'glass';

/** Greyscale facade (multiplied by the building colour). */
export function facadeTexture(style: FacadeStyle, floors: number): THREE.CanvasTexture {
  return canvasTexture(`facade:${style}:${floors}`, 256, 64 * floors, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const fh = h / floors;
    for (let f = 0; f < floors; f++) {
      const y0 = f * fh;
      if (style === 'glass') {
        ctx.fillStyle = '#9fb4c8';
        ctx.fillRect(6, y0 + 6, w - 12, fh - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let x = 10; x < w; x += 32) ctx.fillRect(x, y0 + 8, 3, fh - 16);
        continue;
      }
      const n = style === 'apartment' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const ww = w / n;
        const x = i * ww + ww * 0.22;
        const wy = y0 + fh * 0.22;
        const wwid = ww * 0.56;
        const whei = fh * 0.56;
        ctx.fillStyle = '#5f6f86';
        if (style === 'haveli') {
          ctx.beginPath();
          ctx.moveTo(x, wy + whei);
          ctx.lineTo(x, wy + whei * 0.4);
          ctx.arc(x + wwid / 2, wy + whei * 0.4, wwid / 2, Math.PI, 0);
          ctx.lineTo(x + wwid, wy + whei);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          ctx.fillRect(x, wy, wwid, whei);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(x + 3, wy + 3, wwid * 0.3, whei - 6);
          // Little balcony rail.
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x - 4, wy + whei, wwid + 8, 5);
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, y0 + fh - 4, w, 4);
    }
    if (style === 'shop') {
      // Ground-floor shutter.
      ctx.fillStyle = '#8a8f99';
      ctx.fillRect(w * 0.1, h - fh * 0.85, w * 0.8, fh * 0.85);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = h - fh * 0.85; y < h; y += 6) ctx.fillRect(w * 0.1, y, w * 0.8, 2);
    }
  });
}

export function blobShadow(): THREE.CanvasTexture {
  return canvasTexture('blob', 64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function sunburst(c1: string, c2: string): THREE.CanvasTexture {
  return canvasTexture(`burst:${c1}:${c2}`, 512, 512, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 0.5) / 24) * Math.PI * 2;
      ctx.lineTo(cx + Math.cos(a0) * w, cy + Math.sin(a0) * h);
      ctx.lineTo(cx + Math.cos(a1) * w, cy + Math.sin(a1) * h);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? c1 : c2;
      ctx.fill();
    }
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, w / 2);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.0)');
    g.addColorStop(0.95, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Fade edges to transparent.
    ctx.globalCompositeOperation = 'destination-in';
    const m = ctx.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(0.7, 'rgba(0,0,0,0.8)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = m;
    ctx.fillRect(0, 0, w, h);
  });
}

/** 4-tile particle atlas: puff, square (confetti), star, petal. */
export function particleAtlas(): THREE.CanvasTexture {
  return canvasTexture(
    'atlas',
    256,
    64,
    (ctx) => {
      // puff
      let g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      // square
      ctx.fillStyle = '#fff';
      ctx.fillRect(64 + 18, 22, 28, 20);
      // star
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 11 : 28;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(160 + Math.cos(a) * r, 32 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      // petal
      ctx.beginPath();
      ctx.ellipse(224, 32, 12, 24, 0.6, 0, Math.PI * 2);
      ctx.fill();
      g = ctx.createRadialGradient(224, 32, 1, 224, 32, 24);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = g;
      ctx.fill();
    },
    { srgb: true },
  );
}

export function coinFace(): THREE.CanvasTexture {
  return canvasTexture('coinface', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.4, h * 0.35, 5, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(0.6, '#ffd23a');
    g.addColorStop(1, '#e09a00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b87400';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#b87400';
    ctx.font = `900 ${Math.floor(h * 0.5)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('₹', w / 2, h / 2 + 4);
  });
}

export function skyGradient(top: string, bottom: string): THREE.CanvasTexture {
  return canvasTexture(`sky:${top}:${bottom}`, 2, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(0.75, bottom);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function bunting(): THREE.CanvasTexture {
  return canvasTexture('bunting', 512, 64, (ctx, w) => {
    const cols = ['#ff8c1a', '#ffffff', '#19a34a', '#e8262c', '#2d6cdf', '#ffd23a'];
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(w, 4);
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.moveTo(i * 32 + 2, 4);
      ctx.lineTo(i * 32 + 30, 4);
      ctx.lineTo(i * 32 + 16, 56);
      ctx.closePath();
      ctx.fill();
    }
  });
}
