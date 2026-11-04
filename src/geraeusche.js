/*
 * geraeusche.js — Soundeffekte per WebAudio-Synthese, keine Audio-Dateien.
 *
 * Alle Geräusche werden zur Laufzeit aus Oszillatoren und Rauschen
 * gebastelt — passend zum 8-Bit-Charme des Spiels.
 *
 * API:
 *   GERAUESCHE.bereitmachen()   — nach erster Nutzer-Aktion aufrufen
 *   GERAUESCHE.plopp()          — Flasche eingesammelt
 *   GERAUESCHE.graben()         — durch Erde graben
 *   GERAUESCHE.stein()          — Stein bricht
 *   GERAUESCHE.schritt()        — leiser Schritt auf Kachel
 *   GERAUESCHE.tod()            — Werner ist's
 *   GERAUESCHE.bulleTot()       — Bulle platt
 *   GERAUESCHE.tuer()           — Ausgang öffnet sich
 *   GERAUESCHE.schafft()        — Level geschafft
 *   GERAUESCHE.stummen(an/aus)  — Stummschalter (Taste M)
 */
'use strict';

const GERAUESCHE = (() => {
  let kontext = null;
  let stumm = false;

  // Audio-Kontext erst nach Nutzer-Aktion erzeugen (Browser-Vorgabe).
  function bereitmachen() {
    if (kontext) return;
    const AK = window.AudioContext || window.webkitAudioContext;
    if (!AK) return;
    kontext = new AK();
    if (kontext.state === 'suspended') kontext.resume();
  }

  function stummen(an) {
    stumm = an;
  }

  function istStumm() { return stumm; }

  // Kleiner Helfer: Oszillator mit Frequenz- und Lautstärken-Verlauf.
  function tone(f0, f1, dauer, typ, laut, verzögerung = 0) {
    if (!kontext || stumm) return;
    const t0 = kontext.currentTime + verzögerung;
    const osc = kontext.createOscillator();
    const g = kontext.createGain();
    osc.type = typ;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dauer);
    g.gain.setValueAtTime(laut, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dauer);
    osc.connect(g).connect(kontext.destination);
    osc.start(t0);
    osc.stop(t0 + dauer + 0.02);
  }

  // Rauschen-Burst (für Graben und Brechen).
  function rausch(dauer, laut, filterHz, verzögerung = 0) {
    if (!kontext || stumm) return;
    const t0 = kontext.currentTime + verzögerung;
    const laenge = Math.max(1, Math.floor(kontext.sampleRate * dauer));
    const puffer = kontext.createBuffer(1, laenge, kontext.sampleRate);
    const daten = puffer.getChannelData(0);
    for (let i = 0; i < laenge; i++) {
      // Abklingender Rauschverlauf
      daten[i] = (Math.random() * 2 - 1) * (1 - i / laenge);
    }
    const src = kontext.createBufferSource();
    src.buffer = puffer;
    const filter = kontext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterHz;
    const g = kontext.createGain();
    g.gain.setValueAtTime(laut, t0);
    src.connect(filter).connect(g).connect(kontext.destination);
    src.start(t0);
  }

  return {
    bereitmachen,
    stummen,
    istStumm,

    // "Plopp!" — der berühmte Bügelverschluss. Kurz, fröhlich, aufsteigend.
    plopp() {
      tone(520, 880, 0.09, 'square', 0.18);
      tone(1040, 1320, 0.12, 'sine', 0.14, 0.07);
    },

    // Gravierendes Kratzen durch die Erde.
    graben() {
      rausch(0.12, 0.16, 900);
    },

    // Stein bricht: dumpfes Knacken plus Splitter.
    stein() {
      tone(140, 60, 0.16, 'triangle', 0.3);
      rausch(0.2, 0.2, 2400, 0.02);
    },

    // Leiser Schritt: kurzes, sanftes Klick.
    schritt() {
      tone(220, 180, 0.03, 'triangle', 0.05);
    },

    // Werner ist's: tiefer, trauriger "Womp-Womp".
    tod() {
      tone(220, 110, 0.3, 'sawtooth', 0.22);
      tone(110, 55, 0.4, 'sawtooth', 0.2, 0.28);
    },

    // Bulle platt: kurzes "Plumps".
    bulleTot() {
      tone(300, 90, 0.18, 'square', 0.2);
    },

    // Die Tür knarrt und öffnet sich: aufsteigende Arpeggio.
    tuer() {
      tone(392, 392, 0.09, 'square', 0.14);
      tone(523, 523, 0.09, 'square', 0.14, 0.1);
      tone(659, 659, 0.14, 'square', 0.16, 0.2);
    },

    // Level geschafft: kleine Fanfare.
    schafft() {
      tone(523, 523, 0.1, 'square', 0.16);
      tone(659, 659, 0.1, 'square', 0.16, 0.11);
      tone(784, 784, 0.1, 'square', 0.16, 0.22);
      tone(1047, 1047, 0.22, 'square', 0.18, 0.33);
    },
  };
})();

if (typeof globalThis !== 'undefined') globalThis.GERAUESCHE = GERAUESCHE;
if (typeof module !== 'undefined' && module.exports) module.exports = GERAUESCHE;
