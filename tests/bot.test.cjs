/*
 * bot.test.cjs — der „Bullenspieler": ein simpler Bot, der jedes Level
 * spielerisch durchspielt. Damit ist objektiv belegt, dass alle 10 Level
 * lösbar (und mit 8 Neustarts pro Saat nicht zu brutal) sind.
 *
 * Strategie: BFS zum nächsten Ziel (Flasche, bzw. Tür wenn alles pladdert),
 * Kacheln wie ein Mensch passierbar (Erde grabbar, Stein nur wenn er steht),
 * Bullen werden gemieden, aber nicht gefürchtet (Tod -> Neustart).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const LOGIK = require('../src/logik.js');
const LEVELS = require('../src/levels.js');

// Deterministischer Zufall (mulberry32)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Kachel aus Sicht des Boten passierbar?
function passierbar(state, x, y) {
  const { breite, hoehe, gitter } = state;
  if (x < 0 || y < 0 || x >= breite || y >= hoehe) return false;
  const k = gitter[y * breite + x];
  if (k === LOGIK.WAND) return false;
  if (k === LOGIK.STEIN) {
    // Stein bricht nur, wenn unten etwas liegt
    return y + 1 < hoehe ? gitter[(y + 1) * breite + x] !== LOGIK.LUFT : false;
  }
  if (k === LOGIK.TUER) return state.tuer.offen;
  return true; // LUFT, ERDE, FLASCHE
}

// BFS: erster Schritt Richtung Ziel, null wenn kein Weg.
function botRichtung(state, ziel) {
  const { breite, hoehe } = state;
  const werner = state.werner;
  if (werner.x === ziel.x && werner.y === ziel.y) return null;

  // Gefahrenzellen: Bullen-Position plus voraussichtliche Positionen im
  // naechsten Tick (weiter, Wende, Pause) — sonst prallt der Bot frontal
  // in einen herankommenden Bullen, weil beide im selben Tick ziehen.
  const gefahr = new Set();
  for (const g of state.gegner) {
    if (!g.lebt) continue;
    const dx = g.dir === 'rechts' ? 1 : -1;
    gefahr.add(`${g.x},${g.y}`);
    gefahr.add(`${g.x + dx},${g.y}`);
    gefahr.add(`${g.x - dx},${g.y}`);
  }

  const start = werner.y * breite + werner.x;
  const zielIdx = ziel.y * breite + ziel.x;
  const vormals = new Int32Array(breite * hoehe).fill(-2);
  vormals[start] = -1;
  const queue = [start];
  const richtung = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }];
  let gefunden = -1;

  for (let qi = 0; qi < queue.length && gefunden < 0; qi++) {
    const idx = queue[qi];
    const x = idx % breite, y = Math.floor(idx / breite);
    for (const r of richtung) {
      const nx = x + r.dx, ny = y + r.dy;
      if (nx < 0 || ny < 0 || nx >= breite || ny >= hoehe) continue;
      const nidx = ny * breite + nx;
      if (vormals[nidx] !== -2) continue;
      const bulleDa = state.gegner.some(g => g.lebt && g.x === nx && g.y === ny);
      if ((bulleDa || gefahr.has(`${nx},${ny}`) || !passierbar(state, nx, ny)) && nidx !== zielIdx) continue;
      vormals[nidx] = idx;
      if (nidx === zielIdx) { gefunden = nidx; break; }
      queue.push(nidx);
    }
  }
  if (gefunden < 0) return null;

  // Erste Kachel des Weges ermitteln
  let k = gefunden;
  while (vormals[k] !== start && vormals[k] !== -1) k = vormals[k];
  const dx = k % breite - werner.x, dy = Math.floor(k / breite) - werner.y;
  if (dx === -1) return 'links';
  if (dx === 1) return 'rechts';
  if (dy === -1) return 'oben';
  if (dy === 1) return 'unten';
  return null;
}

// Nächstes Ziel: ungesammelte Flasche (manhatten-nächste), sonst die Tür.
function naechstesZiel(state) {
  if (state.gesammelt.size === state.flaschenTotal) return { x: state.tuer.x, y: state.tuer.y };
  let beste = null, besteD = Infinity;
  const { breite, gitter } = state;
  for (let y = 0; y < state.hoehe; y++) {
    for (let x = 0; x < breite; x++) {
      if (gitter[y * breite + x] !== LOGIK.FLASCHE) continue;
      const d = Math.abs(x - state.werner.x) + Math.abs(y - state.werner.y);
      if (d < besteD) { besteD = d; beste = { x, y }; }
    }
  }
  return beste;
}

// Ein Bot-Durchlauf: true wenn das Level geschafft wurde.
function botSpielt(levelIndex, saatkorn, maxTicks = 6000, maxTode = 8) {
  const state = LOGIK.neu(levelIndex, { zufall: mulberry32(saatkorn) });
  let ticks = 0, tode = 0;
  while (!state.levelFertig && ticks < maxTicks) {
    if (state.tod) {
      tode++;
      if (tode > maxTode) return null;
      LOGIK.erneut(state);
      continue;
    }
    const ziel = naechstesZiel(state);
    if (ziel === null) {
      console.error(`DEBUG Ziel null: gesammelt=${state.gesammelt.size}/${state.flaschenTotal}, W=(${state.werner.x},${state.werner.y}), tick=${state.tick}`);
      console.error('gesammelt:', [...state.gesammelt].join(' | '));
      for (let y = 0; y < state.hoehe; y++) {
        let z = '';
        for (let x = 0; x < state.breite; x++) {
          const k = state.gitter[y * state.breite + x];
          z += k === LOGIK.LUFT ? '.' : k === LOGIK.WAND ? '#' : k === LOGIK.ERDE ? ',' : k === LOGIK.STEIN ? '-' : k === LOGIK.FLASCHE ? 'o' : (state.tuer.offen ? 'e' : 'E');
        }
        console.error(z);
      }
      console.error('Bullen:', state.gegner.map(g => `${g.typ}${g.lebt ? '' : '†'}(${g.x},${g.y})`).join(' '));
      return 'ZIELNULL';
    }
    let dir = ziel ? botRichtung(state, ziel) : null;
    // Gefahrenzellen fuer den Fallback (Bullen-Position + naechster Tick)
    const gefahrSet = new Set();
    for (const g of state.gegner) {
      if (!g.lebt) continue;
      const dx = g.dir === 'rechts' ? 1 : -1;
      gefahrSet.add(`${g.x},${g.y}`);
      gefahrSet.add(`${g.x + dx},${g.y}`);
      gefahrSet.add(`${g.x - dx},${g.y}`);
    }
    if (!dir) {
      // Fallback: Richtung zum Ziel, dann die sicherste freie Seite
      const dx = ziel.x - state.werner.x, dy = ziel.y - state.werner.y;
      const kands = [
        { r: 'unten', d: [0, 1], s: dy > 0 ? 2 : (dy < 0 ? 0 : 1) },
        { r: 'oben', d: [0, -1], s: dy < 0 ? 2 : (dy > 0 ? 0 : 1) },
        { r: 'rechts', d: [1, 0], s: dx > 0 ? 2 : (dx < 0 ? 0 : 1) },
        { r: 'links', d: [-1, 0], s: dx < 0 ? 2 : (dx > 0 ? 0 : 1) },
      ].sort((a, b) => b.s - a.s);
      for (const k of kands) {
        const nx = state.werner.x + k.d[0], ny = state.werner.y + k.d[1];
        if (passierbar(state, nx, ny) && !gefahrSet.has(`${nx},${ny}`)) { dir = k.r; break; }
      }
    }
    LOGIK.tick(state, { richtung: dir });
    ticks++;
  }
  return state.levelFertig ? { ticks, tode } : null;
}

test('Alle 10 Level sind vom Bot lösbar (nicht zu schwer, nicht unspielbar)', { timeout: 120000 }, t => {
  for (let i = 0; i < LEVELS.length; i++) {
    let gelöst = null;
    for (let saatkorn = 1; saatkorn <= 5 && !gelöst; saatkorn++) {
      const ergebnis = botSpielt(i, saatkorn);
      if (ergebnis) gelöst = { saatkorn, ...ergebnis };
    }
    console.log(`Level ${i + 1} „${LEVELS[i].name}“: ` +
      (gelöst ? `gelöst (Saat ${gelöst.saatkorn}, ${gelöst.ticks} Ticks, ${gelöst.tode} Tode)` : 'NICHT gelöst'));
    assert.ok(gelöst, `Level ${i + 1} „${LEVELS[i].name}“ nicht vom Bot gelöst`);
    // Sanke-Check: kein Level soll absurd viel brauchen
    assert.ok(gelöst.ticks < 6000, `Level ${i + 1} brauchte ${gelöst.ticks} Ticks`);
  }
});
