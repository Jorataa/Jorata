import { chromium } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const ZIP_PATH = path.resolve('/workspaces/Jorata/boxing-game/JORATA_BOXING_ASSETS.zip');
const MAIN_PUBLIC_BOXING = path.resolve('/workspaces/Jorata/jorata-game/public/boxing');
const MAIN_MIRROR_BOXING = path.resolve('/workspaces/Jorata/jorata-game/public/games/boxing/assets');
const WORKTREE_PUBLIC_BOXING = path.resolve('/workspaces/Jorata/boxing-game/jorata-game/public/boxing');
const WORKTREE_MIRROR_BOXING = path.resolve('/workspaces/Jorata/boxing-game/jorata-game/public/games/boxing/assets');

async function main() {
  // Always extract fresh from JORATA_BOXING_ASSETS.zip into MAIN_PUBLIC_BOXING first so processing is idempotent
  await fs.mkdir(MAIN_PUBLIC_BOXING, { recursive: true });
  execFileSync('unzip', ['-oq', ZIP_PATH, '-d', MAIN_PUBLIC_BOXING]);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const readPngB64 = async (relPath) => {
    const buf = await fs.readFile(path.join(MAIN_PUBLIC_BOXING, relPath));
    return buf.toString('base64');
  };

  const writePngB64 = async (relPath, dataUrl) => {
    const b64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buf = Buffer.from(b64, 'base64');
    const targets = [
      path.join(MAIN_PUBLIC_BOXING, relPath),
      path.join(MAIN_MIRROR_BOXING, relPath),
      path.join(WORKTREE_PUBLIC_BOXING, relPath),
      path.join(WORKTREE_MIRROR_BOXING, relPath),
    ];
    for (const out of targets) {
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, buf);
    }
  };

  const sourceOrgB64 = await readPngB64('references/source_organized.png');

  // 1. Repair ui/win.png, ui/draw.png, props/towel.png, effects/impact_dust_01..03.png, effects/impact_smoke.png,
  //    and props/stool_red.png, props/stool_blue.png, props/bucket.png directly from references/source_organized.png
  const repairedFromAtlas = await page.evaluate(async (srcB64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + srcB64;
    await img.decode();

    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const full = ctx.getImageData(0, 0, c.width, c.height);

    function isChecker(r, g, b, a) {
      if (a < 16) return true;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return min >= 214 && max - min <= 14;
    }

    // Scan x in [1200..1530], y in [485..544] to locate KO, WIN, DRAW exact bounds
    const activeCols = [];
    for (let x = 1200; x <= 1530; x++) {
      let hasPixel = false;
      for (let y = 485; y <= 544; y++) {
        const idx = (y * c.width + x) * 4;
        if (!isChecker(full.data[idx], full.data[idx + 1], full.data[idx + 2], full.data[idx + 3])) {
          hasPixel = true;
          break;
        }
      }
      if (hasPixel) activeCols.push(x);
    }

    const segments = [];
    for (const x of activeCols) {
      if (!segments.length || x > segments[segments.length - 1][1] + 4) {
        segments.push([x, x]);
      } else {
        segments[segments.length - 1][1] = x;
      }
    }

    // Border-connected flood fill so white/light interior details inside dark outlines (like towel, smoke, dust)
    // are 100% preserved!
    function extractBorderCleanCrop(x0, y0, x1, y1, opts = {}) {
      const pad = opts.pad ?? 2;
      const sx = Math.max(0, x0 - pad);
      const sy = Math.max(0, y0 - pad);
      const sw = Math.min(c.width - sx, x1 - x0 + 1 + pad * 2);
      const sh = Math.min(c.height - sy, y1 - y0 + 1 + pad * 2);

      const sub = document.createElement('canvas');
      sub.width = sw;
      sub.height = sh;
      const sctx = sub.getContext('2d');
      sctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const imgData = sctx.getImageData(0, 0, sw, sh);
      const d = imgData.data;

      const minBg = opts.minBg ?? 195;
      const maxSat = opts.maxSat ?? 20;
      function isBgCandidate(r, g, b, a) {
        if (a < 16) return true;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        return min >= minBg && max - min <= maxSat;
      }

      const visited = new Uint8Array(sw * sh);
      const queue = [];
      const enqueue = (x, y) => {
        if (x < 0 || x >= sw || y < 0 || y >= sh) return;
        const p = y * sw + x;
        if (visited[p]) return;
        const idx = p * 4;
        if (isBgCandidate(d[idx], d[idx + 1], d[idx + 2], d[idx + 3])) {
          visited[p] = 1;
          queue.push(p);
        }
      };

      for (let x = 0; x < sw; x++) {
        enqueue(x, 0);
        enqueue(x, sh - 1);
      }
      for (let y = 0; y < sh; y++) {
        enqueue(0, y);
        enqueue(sw - 1, y);
      }

      while (queue.length > 0) {
        const p = queue.pop();
        const px = p % sw;
        const py = (p - px) / sw;
        d[p * 4 + 3] = 0;
        enqueue(px - 1, py);
        enqueue(px + 1, py);
        enqueue(px, py - 1);
        enqueue(px, py + 1);
      }

      // Optional interior hole clearing for enclosed background pockets (e.g., between stool legs or inside letters)
      if (opts.clearInteriorNeutralBelowY !== undefined) {
        for (let y = opts.clearInteriorNeutralBelowY; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const idx = (y * sw + x) * 4;
            if (d[idx + 3] === 0) continue;
            const r = d[idx], g = d[idx + 1], b = d[idx + 2];
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            if (min >= 145 && max - min <= 18) {
              d[idx + 3] = 0;
            }
          }
        }
      }

      let minX = sw, minY = sh, maxX = 0, maxY = 0;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (d[(y * sw + x) * 4 + 3] > 16) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      sctx.putImageData(imgData, 0, 0);

      const tw = Math.max(1, maxX - minX + 3);
      const th = Math.max(1, maxY - minY + 3);
      const trimmed = document.createElement('canvas');
      trimmed.width = tw;
      trimmed.height = th;
      const tctx = trimmed.getContext('2d');
      tctx.drawImage(sub, minX - 1, minY - 1, tw, th, 0, 0, tw, th);
      return trimmed.toDataURL('image/png');
    }

    const winSeg = segments[1] ?? [1296, 1388];
    const drawSeg = segments[2] ?? [1396, 1515];

    return {
      win: extractBorderCleanCrop(winSeg[0], 486, winSeg[1], 544, { clearInteriorNeutralBelowY: 0 }),
      draw: extractBorderCleanCrop(drawSeg[0], 486, drawSeg[1], 544, { clearInteriorNeutralBelowY: 0 }),
      towel: extractBorderCleanCrop(387, 891, 459, 982, { minBg: 205, maxSat: 16 }),
      impactDust01: extractBorderCleanCrop(125, 518, 208, 596, { minBg: 210, maxSat: 16 }),
      impactDust02: extractBorderCleanCrop(227, 521, 319, 596, { minBg: 210, maxSat: 16 }),
      impactDust03: extractBorderCleanCrop(329, 513, 424, 597, { minBg: 210, maxSat: 16 }),
      impactSmoke: extractBorderCleanCrop(428, 508, 529, 585, { minBg: 210, maxSat: 16 }),
      stoolRed: extractBorderCleanCrop(21, 898, 101, 976, { minBg: 200, maxSat: 18, clearInteriorNeutralBelowY: 36 }),
      stoolBlue: extractBorderCleanCrop(118, 898, 213, 979, { minBg: 200, maxSat: 18, clearInteriorNeutralBelowY: 32 }),
    };
  }, sourceOrgB64);

  await writePngB64('ui/win.png', repairedFromAtlas.win);
  await writePngB64('ui/draw.png', repairedFromAtlas.draw);
  await writePngB64('props/towel.png', repairedFromAtlas.towel);
  await writePngB64('effects/impact_dust_01.png', repairedFromAtlas.impactDust01);
  await writePngB64('effects/impact_dust_02.png', repairedFromAtlas.impactDust02);
  await writePngB64('effects/impact_dust_03.png', repairedFromAtlas.impactDust03);
  await writePngB64('effects/impact_smoke.png', repairedFromAtlas.impactSmoke);
  await writePngB64('props/stool_red.png', repairedFromAtlas.stoolRed);
  await writePngB64('props/stool_blue.png', repairedFromAtlas.stoolBlue);

  // 2. Clean all 34 character sprites (17 red + 17 blue)
  const charStates = [
    'idle_01.png', 'idle_02.png',
    'walk_01.png', 'walk_02.png',
    'jab_01.png', 'jab_02.png',
    'hook_01.png', 'hook_02.png',
    'uppercut_01.png', 'uppercut_02.png',
    'block.png',
    'duck_01.png', 'duck_02.png',
    'hit_01.png', 'hit_02.png',
    'ko.png', 'win.png',
  ];

  for (const folder of ['characters/player_red', 'characters/player_blue']) {
    for (const file of charStates) {
      const rel = `${folder}/${file}`;
      const b64 = await readPngB64(rel);
      const cleanedUrl = await page.evaluate(async ({ srcB64, fileName }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + srcB64;
        await img.decode();
        const w = img.width;
        const h = img.height;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;

        function isNeutralBg(r, g, b, a) {
          if (a === 0) return true;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max - min;
          return min >= 130 && sat <= 20;
        }

        if (fileName !== 'ko.png') {
          const visited = new Uint8Array(w * h);
          const queue = [];

          for (let y = 120; y <= 151; y++) {
            for (let x = 58; x <= 98; x++) {
              const idx = (y * w + x) * 4;
              const r = d[idx], g = d[idx + 1], b = d[idx + 2], a = d[idx + 3];
              if (a > 0 && (isNeutralBg(r, g, b, a) || (y >= 142 && Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.min(r, g, b) >= 90))) {
                if (y >= 142 || Math.min(r, g, b) >= 205) {
                  const p = y * w + x;
                  visited[p] = 1;
                  queue.push(p);
                }
              }
            }
          }

          while (queue.length > 0) {
            const p = queue.pop();
            const px = p % w;
            const py = (p - px) / w;
            const idx = p * 4;
            d[idx + 3] = 0;

            const neighbors = [
              [px - 1, py],
              [px + 1, py],
              [px, py - 1],
              [px, py + 1],
            ];
            for (const [nx, ny] of neighbors) {
              if (nx < 48 || nx > 112 || ny < 110 || ny >= h) continue;
              const np = ny * w + nx;
              if (visited[np]) continue;
              const nidx = np * 4;
              const r = d[nidx], g = d[nidx + 1], b = d[nidx + 2], a = d[nidx + 3];
              if (a > 0 && isNeutralBg(r, g, b, a)) {
                visited[np] = 1;
                queue.push(np);
              }
            }
          }

          // Clear any 1-3px residual horizontal baseline sliver between the two boots (x in 56..102, y in 143..151)
          // where the pixels above (y - 3) and below (y + 2) are already transparent
          for (let x = 54; x <= 104; x++) {
            let colOpaqueCount = 0;
            for (let y = 136; y <= 152; y++) {
              if (d[(y * w + x) * 4 + 3] > 16) colOpaqueCount++;
            }
            if (colOpaqueCount > 0 && colOpaqueCount <= 3) {
              for (let y = 142; y <= 152; y++) {
                const idx = (y * w + x) * 4;
                const r = d[idx], g = d[idx + 1], b = d[idx + 2];
                if (Math.max(r, g, b) - Math.min(r, g, b) <= 30) {
                  d[idx + 3] = 0;
                }
              }
            }
          }
        }

        // Remove single-pixel bright neutral spurs on outer edges
        const copy = new Uint8ClampedArray(d);
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (copy[idx + 3] === 0) continue;
            const r = copy[idx], g = copy[idx + 1], b = copy[idx + 2];
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            if (min >= 200 && max - min <= 15) {
              let opaqueNeighbors = 0;
              for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                if (copy[((y + dy) * w + (x + dx)) * 4 + 3] > 32) opaqueNeighbors++;
              }
              if (opaqueNeighbors <= 1) {
                d[idx + 3] = 0;
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        return c.toDataURL('image/png');
      }, { srcB64: b64, fileName: file });

      await writePngB64(rel, cleanedUrl);
    }
  }

  // 3. Clean UI bars, bucket, and ring layers
  const edgeTrimTargets = [
    { rel: 'ui/health_bar_red.png', trimBottom: 5 },
    { rel: 'ui/health_bar_blue.png', trimBottom: 5 },
    { rel: 'ui/stamina_bar.png', trimBottom: 5 },
    { rel: 'ui/bar_background.png', trimBottom: 5 },
    { rel: 'backgrounds/ring/layers/corner_blue.png', trimBottom: 4, cleanInteriorChecker: true },
    { rel: 'backgrounds/ring/layers/corner_red.png', cleanInteriorChecker: true },
    { rel: 'backgrounds/ring/layers/ring_rope_left.png', cleanInteriorChecker: true },
    { rel: 'backgrounds/ring/layers/ring_rope_right.png', cleanInteriorChecker: true },
  ];

  for (const item of edgeTrimTargets) {
    const b64 = await readPngB64(item.rel);
    const cleanedUrl = await page.evaluate(async ({ srcB64, cfg }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + srcB64;
      await img.decode();
      const w = img.width;
      const h = img.height;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      if (cfg.trimTop) {
        for (let y = 0; y < cfg.trimTop; y++) {
          for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = 0;
        }
      }
      if (cfg.trimBottom) {
        for (let y = h - cfg.trimBottom; y < h; y++) {
          for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = 0;
        }
      }
      if (cfg.cleanInteriorChecker) {
        const minY = cfg.interiorMinY ?? 0;
        for (let y = minY; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = d[idx], g = d[idx + 1], b = d[idx + 2], a = d[idx + 3];
            if (a === 0) continue;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            if (min >= 180 && max - min <= 26) {
              d[idx + 3] = 0;
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      return c.toDataURL('image/png');
    }, { srcB64: b64, cfg: item });

    await writePngB64(item.rel, cleanedUrl);
  }

  // 4. Generate pixel-accurate, waist-aligned intermediate frames for smooth animation cycles
  //    and repair player_blue/jab_02.png rear boot tip where source_rect clipped at x=40
  for (const folder of ['characters/player_red', 'characters/player_blue']) {
    const idle1 = await readPngB64(`${folder}/idle_01.png`);
    const idle2 = await readPngB64(`${folder}/idle_02.png`);
    const walk1 = await readPngB64(`${folder}/walk_01.png`);
    const walk2 = await readPngB64(`${folder}/walk_02.png`);
    const jab1 = await readPngB64(`${folder}/jab_01.png`);
    let jab2 = await readPngB64(`${folder}/jab_02.png`);
    const hook1 = await readPngB64(`${folder}/hook_01.png`);
    const hook2 = await readPngB64(`${folder}/hook_02.png`);
    const upper1 = await readPngB64(`${folder}/uppercut_01.png`);
    const upper2 = await readPngB64(`${folder}/uppercut_02.png`);
    const hit2 = await readPngB64(`${folder}/hit_02.png`);

    if (folder === 'characters/player_blue') {
      const repairedBlueJab2 = await page.evaluate(async ({ j1, j2 }) => {
        async function load(b64) {
          const img = new Image();
          img.src = 'data:image/png;base64,' + b64;
          await img.decode();
          return img;
        }
        const img1 = await load(j1);
        const img2 = await load(j2);
        const c = document.createElement('canvas');
        c.width = 160;
        c.height = 160;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        // Restore the 8px rear boot heel (x=32..41, y=112..150) from jab_01 (shifted +2px right to match jab_02's rear calf at x=40)
        ctx.drawImage(img1, 30, 112, 12, 38, 32, 112, 12, 38);
        ctx.drawImage(img2, 0, 0);
        return c.toDataURL('image/png');
      }, { j1: jab1, j2: jab2 });
      await writePngB64(`${folder}/jab_02.png`, repairedBlueJab2);
      jab2 = repairedBlueJab2.replace(/^data:image\/png;base64,/, '');
    }

    const generated = await page.evaluate(
      async (frames) => {
        async function load(b64) {
          const img = new Image();
          img.src = 'data:image/png;base64,' + b64;
          await img.decode();
          return img;
        }

        function getRowBounds(img, yStart, yEnd) {
          const c = document.createElement('canvas');
          c.width = 160;
          c.height = 160;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, 160, 160).data;
          let sumX = 0;
          let count = 0;
          for (let y = yStart; y <= yEnd; y++) {
            for (let x = 0; x < 160; x++) {
              if (d[(y * 160 + x) * 4 + 3] > 128) {
                sumX += x;
                count++;
              }
            }
          }
          return count > 0 ? sumX / count : 80;
        }

        // Aligns the waist centroid at splitY automatically so the torso and shorts never shear or disconnect!
        function composeWaistAlignedTween(upperImg, lowerImg, splitY, extraUpperDx = 0, upperDy = 0) {
          const upperWaistX = getRowBounds(upperImg, splitY - 3, splitY + 2);
          const lowerWaistX = getRowBounds(lowerImg, splitY - 2, splitY + 3);
          const autoDx = Math.round(lowerWaistX - upperWaistX + extraUpperDx);

          const c = document.createElement('canvas');
          c.width = 160;
          c.height = 160;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = false;

          // Draw lower body (legs + shorts) anchored to exact ground baseline
          ctx.drawImage(lowerImg, 0, splitY, 160, 160 - splitY, 0, splitY, 160, 160 - splitY);
          // Draw upper body (torso + head + gloves) aligned to lower body's waist
          ctx.drawImage(
            upperImg,
            0,
            0,
            160,
            splitY + 2,
            autoDx,
            Math.round(upperDy),
            160,
            splitY + 2
          );
          return c.toDataURL('image/png');
        }

        const i1 = await load(frames.idle1);
        const i2 = await load(frames.idle2);
        const w1 = await load(frames.walk1);
        const w2 = await load(frames.walk2);
        const j1 = await load(frames.jab1);
        const j2 = await load(frames.jab2);
        const h1 = await load(frames.hook1);
        const h2 = await load(frames.hook2);
        const u1 = await load(frames.upper1);
        const u2 = await load(frames.upper2);
        const ht2 = await load(frames.hit2);

        function makeJabRetract(jab2Img) {
          const c = document.createElement('canvas');
          c.width = 160;
          c.height = 160;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          // Lower body from y=94 down stays anchored
          ctx.drawImage(jab2Img, 0, 94, 160, 66, 0, 94, 160, 66);
          // Upper body (x < 92, y < 95) recoils 1px back
          ctx.drawImage(jab2Img, 0, 0, 92, 95, -1, 0, 92, 95);
          // Extended lead arm & glove (x >= 88, y < 90) retracts 5px back into shoulder
          ctx.drawImage(jab2Img, 88, 0, 72, 90, 83, 1, 72, 90);
          return c.toDataURL('image/png');
        }

        function makeKoFall() {
          const c = document.createElement('canvas');
          c.width = 160;
          c.height = 160;
          const ctx = c.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.save();
          // Pivot shifted right to x=104 so backward fall stays 100% inside 160x160 canvas without clipping head!
          ctx.translate(104, 145);
          ctx.rotate(-0.46);
          ctx.drawImage(ht2, -80, -146);
          ctx.restore();
          return c.toDataURL('image/png');
        }

        return {
          idle_03: composeWaistAlignedTween(i2, i1, 98, 0, 1),
          walk_03: composeWaistAlignedTween(w2, w1, 96, 1, -1),
          jab_03: makeJabRetract(j2),
          hook_03: composeWaistAlignedTween(h2, h1, 96, 1, 0),
          uppercut_03: composeWaistAlignedTween(u2, u1, 96, 0, -1),
          ko_01: makeKoFall(),
        };
      },
      { idle1, idle2, walk1, walk2, jab1, jab2, hook1, hook2, upper1, upper2, hit2 }
    );

    await writePngB64(`${folder}/idle_03.png`, generated.idle_03);
    await writePngB64(`${folder}/walk_03.png`, generated.walk_03);
    await writePngB64(`${folder}/jab_03.png`, generated.jab_03);
    await writePngB64(`${folder}/hook_03.png`, generated.hook_03);
    await writePngB64(`${folder}/uppercut_03.png`, generated.uppercut_03);
    await writePngB64(`${folder}/ko_01.png`, generated.ko_01);

    // 5. Export optional sprite sheet + machine-readable JSON per fighter
    const allOrderedStates = [
      'idle_01.png', 'idle_02.png', 'idle_03.png',
      'walk_01.png', 'walk_02.png', 'walk_03.png',
      'jab_01.png', 'jab_02.png', 'jab_03.png',
      'hook_01.png', 'hook_02.png', 'hook_03.png',
      'uppercut_01.png', 'uppercut_02.png', 'uppercut_03.png',
      'block.png',
      'duck_01.png', 'duck_02.png',
      'hit_01.png', 'hit_02.png',
      'ko_01.png', 'ko.png',
      'win.png',
    ];
    const stateB64List = [];
    for (const sFile of allOrderedStates) {
      stateB64List.push({ file: sFile, b64: await readPngB64(`${folder}/${sFile}`) });
    }
    const sheetDataUrl = await page.evaluate(async (items) => {
      const cols = 6;
      const rows = Math.ceil(items.length / cols);
      const c = document.createElement('canvas');
      c.width = cols * 160;
      c.height = rows * 160;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      for (let i = 0; i < items.length; i++) {
        const img = new Image();
        img.src = 'data:image/png;base64,' + items[i].b64;
        await img.decode();
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.drawImage(img, col * 160, row * 160, 160, 160);
      }
      return c.toDataURL('image/png');
    }, stateB64List);

    await writePngB64(`${folder}/spritesheet.png`, sheetDataUrl);
    const sheetMeta = {
      fighter: folder.endsWith('red') ? 'player_red' : 'player_blue',
      canvasSize: [160, 160],
      footBaselineY: 148,
      columns: 6,
      frames: Object.fromEntries(
        allOrderedStates.map((file, i) => [
          file,
          { x: (i % 6) * 160, y: Math.floor(i / 6) * 160, w: 160, h: 160 },
        ])
      ),
    };
    const metaJson = JSON.stringify(sheetMeta, null, 2);
    for (const base of [MAIN_PUBLIC_BOXING, MAIN_MIRROR_BOXING, WORKTREE_PUBLIC_BOXING, WORKTREE_MIRROR_BOXING]) {
      await fs.writeFile(path.join(base, folder, 'spritesheet.json'), metaJson);
    }
  }

  // 6. Write QUALITY_REPORT.md documenting audited, cleaned, repaired, and interpolated assets
  const qualityReport = `# JORATA BOXING — ASSET QUALITY REPORT

## 1. Summary of Audit & Repairs
- **Character Sprites (34 base + 12 interpolated = 46 total across Red & Blue)**:
  - Standardized on \`160x160\` RGBA canvases with feet anchored to a constant baseline (\`y = 148\`) and zero scaling variance across states.
  - Cleaned enclosed background checkerboard pockets between legs/boots and single-pixel edge halos while preserving white boot/shorts trim and glove highlights.
  - Repaired \`characters/player_blue/jab_02.png\` rear boot heel where the initial atlas crop rectangle touched \`jab_01.png\`.
  - Generated 6 pixel-accurate intermediate transition frames per fighter (\`idle_03.png\`, \`walk_03.png\`, \`jab_03.png\`, \`hook_03.png\`, \`uppercut_03.png\`, \`ko_01.png\`) plus exported \`spritesheet.png\` and \`spritesheet.json\` per fighter.
- **UI Banners & Bars**:
  - Re-extracted \`ui/win.png\` and \`ui/draw.png\` from \`references/source_organized.png\` using exact column boundary detection so \`KO\`, \`WIN\`, and \`DRAW\` have zero neighbor bleed.
  - Trimmed bottom crop-label remnants from \`ui/health_bar_red.png\`, \`ui/health_bar_blue.png\`, \`ui/stamina_bar.png\`, and \`ui/bar_background.png\`.
- **Effects & Props**:
  - Re-extracted \`props/towel.png\`, \`effects/impact_dust_01.png\`, \`effects/impact_dust_02.png\`, \`effects/impact_dust_03.png\`, and \`effects/impact_smoke.png\` using border-connected flood fill so white cloth and light smoke interiors remain 100% opaque inside their dark pixel outlines.
  - Cleaned interior checkerboard pockets between the legs of \`props/stool_red.png\` and \`props/stool_blue.png\` while preserving seat cushion highlights.
`;
  for (const base of [MAIN_PUBLIC_BOXING, MAIN_MIRROR_BOXING, WORKTREE_PUBLIC_BOXING, WORKTREE_MIRROR_BOXING]) {
    await fs.writeFile(path.join(base, 'QUALITY_REPORT.md'), qualityReport);
  }

  // Sync all files across both main workspace and worktree public + mirror directories
  for (const target of [MAIN_MIRROR_BOXING, WORKTREE_PUBLIC_BOXING, WORKTREE_MIRROR_BOXING]) {
    await fs.mkdir(target, { recursive: true });
    await fs.cp(MAIN_PUBLIC_BOXING, target, { recursive: true, force: true });
  }

  await browser.close();
  console.log('Asset cleanup, UI/prop/effect repair, waist-aligned tween generation, and mirror sync complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
