/*
 * rendert-vorschau.js — rendert alle Sprites ohne Browser:
 *  1) ASCII-Darstellung direkt im Terminal
 *  2) PNG-Bild (assets/sprites-vorschau.png) für die visuelle Kontrolle
 *
 * Aufruf: node skripte/rendert-vorschau.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const SPRITES = require('../src/sprites.js');

// ---------- ASCII ----------
const ZEICHEN = { '0': ' ', '1': '.', '2': ':', '3': 'o', '4': 'O', '5': '#', '6': '@', '7': '%', '8': '*', '9': '&', a: '+', b: '=', c: '~', d: 'x', e: 'X', f: '-' };
function asciiDarstellung(def) {
  // Farben auf ASCII-Zeichen mappen (sortiert nach Häufigkeit, hell nach dunkel)
  const zahlen = {};
  const liste = [];
  for (const zeile of def.pixels) {
    for (const ch of zeile) {
      const farbe = def.palette[ch];
      if (!farbe) continue;
      if (!(farbe in zahlen)) { zahlen[farbe] = liste.length; liste.push(farbe); }
    }
  }
  // Sortierung: nach Helligkeit absteend, damit helle Pixel "offener" aussehen
  const hellig = f => {
    const r = parseInt(f.slice(1, 3), 16), g = parseInt(f.slice(3, 5), 16), b = parseInt(f.slice(5, 7), 16);
    return (r + g + b) / 3;
  };
  liste.sort((a, b) => hellig(b) - hellig(a));
  const zeichen = {};
  liste.forEach((farbe, i) => { zeichen[farbe] = ZEICHEN[i] || '?'; });
  let out = '';
  for (const zeile of def.pixels) {
    let row = '';
    for (const ch of zeile) {
      const farbe = def.palette[ch];
      row += farbe ? zeichen[farbe] : ' ';
    }
    out += row + '\n';
  }
  return out;
}

console.log('=== ASCII-Vorschau (Helligkeit: hell = dunkles Zeichen) ===');
for (const [name, def] of Object.entries(SPRITES.DEFINITION)) {
  console.log(`\n--- ${name} ---`);
  console.log(asciiDarstellung(def));
}

// ---------- PNG ----------
// Minimaler PNG-Encoder (zlib ist in Node eingebaut)
function crc32(buf) {
  let tabelle = crc32.tabelle;
  if (!tabelle) {
    tabelle = crc32.tabelle = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelle[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ tabelle[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function pngChunk(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const inhalt = Buffer.concat([Buffer.from(typ, 'ascii'), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(inhalt));
  return Buffer.concat([laenge, inhalt, crc]);
}
function pngSchreiben(pfad, breite, hoehe, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 Bit, RGBA
  const roh = Buffer.alloc((breite * 4 + 1) * hoehe);
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 4 + 1)] = 0; // Filter: keiner
    rgba.copy(roh, y * (breite * 4 + 1) + 1, y * breite * 4, (y + 1) * breite * 4);
  }
  const iDAT = pngChunk('IHDR', ihdr);
  const iDDA = pngChunk('IDAT', zlib.deflateSync(roh));
  const iEND = pngChunk('IEND', Buffer.alloc(0));
  fs.writeFileSync(pfad, Buffer.concat([sig, iDAT, iDDA, iEND]));
}

const SKALA = 8;
const NAMEN = Object.keys(SPRITES.DEFINITION);
const BREITE = NAMEN.length * 16 * SKALA + (NAMEN.length + 1) * 16;
const HÖHE = 16 * SKALA + 64;
const rgba = Buffer.alloc(BREITE * HÖHE * 4);
// Hintergrund dunkel
for (let i = 0; i < BREITE * HÖHE; i++) {
  rgba[i * 4] = 22; rgba[i * 4 + 1] = 22; rgba[i * 4 + 2] = 46; rgba[i * 4 + 3] = 255;
}
// Farbwert aus Hex lesen
function hexWert(f) { return [parseInt(f.slice(1, 3), 16), parseInt(f.slice(3, 5), 16), parseInt(f.slice(5, 7), 16)]; }
NAMEN.forEach((name, idx) => {
  const def = SPRITES.DEFINITION[name];
  const x0 = 16 + idx * (16 * SKALA + 16);
  const [br, bg, bb] = hexWert('#c9c9e0');
  // Beschriftung: 8x8 Blockbuchstaben reichen nicht — stattdessen nur ein Rahmen + Name via ASCII?
  // Einfach: heller Rahmen um jedes Sprite
  for (let y = 0; y < 16 * SKALA; y++) {
    for (let x = 0; x < 16 * SKALA; x++) {
      const rand = x === 0 || y === 0 || x === 16 * SKALA - 1 || y === 16 * SKALA - 1;
      if (rand) {
        const i = ((y) * BREITE + (x0 + x)) * 4;
        rgba[i] = 60; rgba[i + 1] = 60; rgba[i + 2] = 90; rgba[i + 3] = 255;
      }
    }
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const farbe = def.palette[def.pixels[y][x]];
      if (!farbe) continue;
      const [r, g, b] = hexWert(farbe);
      for (let sy = 0; sy < SKALA; sy++) {
        for (let sx = 0; sx < SKALA; sx++) {
          const i = ((y * SKALA + sy) * BREITE + (x0 + x * SKALA + sx)) * 4;
          rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
        }
      }
    }
  }
});
const ziel = path.join(__dirname, '..', 'assets', 'sprites-vorschau.png');
pngSchreiben(ziel, BREITE, HÖHE, rgba);
console.log(`\nPNG geschrieben: ${ziel} (${BREITE}x${HÖHE})`);
console.log('Reihenfolge:', NAMEN.join(', '));
