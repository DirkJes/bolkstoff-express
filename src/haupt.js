/*
 * haupt.js — die Spielhülle von „Bölkstoff-Express".
 *
 * Rendering, Eingabe, Game-Loop und Benutzeroberfläche. Die Spiellogik
 * lebt in logik.js (DOM-frei), die Sprites in sprites.js, die Töne in
 * geraeusche.js. Alle Texte sind auf Deutsch.
 *
 * Steuerung:
 *   Pfeiltasten oder WASD  — Werner steuern
 *   Enter                  — starten / weiter
 *   M                      — Ton an/aus
 *   P                      — Pause
 *   R                      — Level neu
 */
'use strict';

(() => {
  const KACHEL = 32;          // Kachelgröße in Pixeln
  const TICK_MS = 140;        // Spieltakt
  const STAND_KEY = 'bolkstoff-express:stand';

  const canvas = document.getElementById('spiel');
  const ctx = canvas.getContext('2d');
  const hudLevel = document.getElementById('hud-level');
  const hudFlaschen = document.getElementById('hud-flaschen');
  const hudTode = document.getElementById('hud-tode');
  const hudTon = document.getElementById('hud-ton');
  const ueberschrift = document.getElementById('overlay');
  const overlayTitel = document.getElementById('overlay-titel');
  const overlayText = document.getElementById('overlay-text');
  const overlayHinweis = document.getElementById('overlay-hinweis');
  const levelWahl = document.getElementById('level-wahl');

  // ---------- Fortschritt (localStorage) -----------------------
  function standLaden() {
    try { return JSON.parse(localStorage.getItem(STAND_KEY)) || { fertig: [] }; }
    catch { return { fertig: [] }; }
  }
  function standSpeichern(stand) {
    try { localStorage.setItem(STAND_KEY, JSON.stringify(stand)); } catch { /* egal */ }
  }
  let stand = standLaden();

  // ---------- Sprites vorbereiten ------------------------------
  // Alle Sprites einmalig in 32x32 (2-fach) rändern und cachen.
  const spriteCache = {};
  function sprite(name) {
    if (!spriteCache[name]) spriteCache[name] = SPRITES.rendere(name, 2);
    return spriteCache[name];
  }

  // Höhlen-Hintergrund mit leichtem Schmutz — einmalig rändern.
  const hintergrund = document.createElement('canvas');
  (function hintergrundMalen() {
    hintergrund.width = canvas.width;
    hintergrund.height = canvas.height;
    const g = hintergrund.getContext('2d');
    g.fillStyle = '#141428';
    g.fillRect(0, 0, hintergrund.width, hintergrund.height);
    // Feiner Schmutz: helle und dunkle Punkte
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * hintergrund.width;
      const y = Math.random() * hintergrund.height;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.18)';
      g.fillRect(x, y, 2, 2);
    }
    // Vignette: Ränder dunkler
    const rad = g.createRadialGradient(
      hintergrund.width / 2, hintergrund.height / 2, hintergrund.height * 0.35,
      hintergrund.width / 2, hintergrund.height / 2, hintergrund.width * 0.72);
    rad.addColorStop(0, 'rgba(0,0,0,0)');
    rad.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = rad;
    g.fillRect(0, 0, hintergrund.width, hintergrund.height);
  })();

  // ---------- Spielzustand -------------------------------------
  let state = null;           // LOGIK-Zustand
  let modus = 'start';        // 'start' | 'spiel' | 'tod' | 'fertig' | 'pausiert'
  let todTimer = 0;           // Millisekunden bis zum Neustart nach Tod
  let todBlitz = 0;           // Rot-Blitz-Intensität (0..1)
  let tuerGlueh = 0;          // Goldenes Glühen um die offene Tür
  let tode = 0;               // Tode im aktuellen Level

  function levelStart(index) {
    state = LOGIK.neu(index);
    tode = 0;
    todBlitz = 0;
    tuerGlueh = 0;
    demoKarte.clear();
    demoPanik = 0;
    demoPanikRichtung = null;
    modus = 'spiel';
    overlayVerstecken();
    hudAktualisieren();
    levelWahlAktualisieren();
  }

  function levelAktiv() {
    return state ? state.levelIndex : -1;
  }

  // ---------- Benutzeroberfläche -------------------------------
  function overlayZeigen(titel, text, hinweis) {
    overlayTitel.textContent = titel;
    overlayText.textContent = text;
    overlayHinweis.textContent = hinweis || '';
    ueberschrift.classList.remove('versteckt');
  }
  function overlayVerstecken() {
    ueberschrift.classList.add('versteckt');
  }
  function hudAktualisieren() {
    if (!state) return;
    hudLevel.textContent = `Level ${state.levelIndex + 1}: ${state.name}`;
    if (demoLevel != null) {
      // Demo-Modus: Tick-Zähler für die Testauswertung
      hudLevel.textContent += ` · tick ${state.tick} · ${modus}`;
    }
    hudFlaschen.textContent = `Flaschen ${state.gesammelt.size}/${state.flaschenTotal}`;
    hudTode.textContent = `Tode ${tode}`;
    hudTon.textContent = GERAUESCHE.istStumm() ? 'Ton: aus (M)' : 'Ton: an (M)';
  }
  function levelWahlAktualisieren() {
    for (const knopf of levelWahl.querySelectorAll('button')) {
      const idx = parseInt(knopf.dataset.level, 10);
      knopf.classList.toggle('aktiv', idx === levelAktiv() && modus !== 'start');
      knopf.classList.toggle('fertig', stand.fertig.includes(idx));
    }
  }

  // ---------- Level-Auswahl anlegen ----------------------------
  function levelWahlAufbauen() {
    levelWahl.innerHTML = ''; // nur leeren (leerer String, kein untrusted Inhalt)
    LEVELS.forEach((lvl, idx) => {
      const b = document.createElement('button');
      b.dataset.level = idx;
      b.textContent = `${idx + 1}. ${lvl.name}`;
      b.title = lvl.name;
      b.addEventListener('click', () => {
        GERAUESCHE.bereitmachen();
        levelStart(idx);
      });
      levelWahl.appendChild(b);
    });
    levelWahlAktualisieren();
  }

  // ---------- Demo-Modus (URL-Parameter ?demo=<level>) ----------------
  // Ein kleiner Bot spielt das Level ohne Tastatur — zum Testen und zum
  // Anschauen. Das Ergebnis landet in #demo-ergebnis (für --dump-dom).
  const urlParams = new URLSearchParams(window.location.search);
  const demoLevel = urlParams.has('demo') ? parseInt(urlParams.get('demo'), 10) : null;

  // Stau-Erkennung für den Demo-Bot: gleiche Position ohne Fortschritt
  // für zu lange → kurzer Zufallsausflug, damit er aus Schleifen
  // (z. B. ewiges Klettern an einer Wand) herauskommt.
  const demoKarte = new Map();   // „x,y:flaschen" → letzter Tick
  let demoPanik = 0;             // verbleibende Panik-Ticks
  let demoPanikRichtung = null;

  function demoRichtung(state) {
    // Stau-Check zuerst: gleiche Position + gleicher Flaschenstand
    // innerhalb kurzer Zeit = Schleife → kurzer Zufallsausflug.
    const signatur = `${state.werner.x},${state.werner.y}:${state.gesammelt.size}`;
    const vorherTick = demoKarte.get(signatur);
    demoKarte.set(signatur, state.tick);
    if (demoKarte.size > 500) demoKarte.clear();
    if (demoPanik > 0) {
      demoPanik--;
      return demoPanikRichtung;
    }
    if (vorherTick !== undefined && state.tick - vorherTick < 30) {
      // Alle freien Richtungen sammeln
      const breite = state.breite, hoehe = state.hoehe;
      const kachel = (x, y) => (x >= 0 && y >= 0 && x < breite && y < hoehe)
        ? state.gitter[y * breite + x] : LOGIK.WAND;
      const moeglich = [];
      for (const [name, d] of Object.entries(LOGIK.R)) {
        const nx = state.werner.x + d.dx, ny = state.werner.y + d.dy;
        if (nx < 0 || ny < 0 || nx >= breite || ny >= hoehe) continue;
        const k = kachel(nx, ny);
        const boden = (ny + 1 < hoehe) ? kachel(nx, ny + 1) !== LOGIK.LUFT : false;
        const ok = k === LOGIK.LUFT || k === LOGIK.ERDE || k === LOGIK.FLASCHE
          || (k === LOGIK.STEIN && boden)
          || (k === LOGIK.TUER && state.tuer.offen);
        if (ok) moeglich.push(name);
      }
      if (moeglich.length) {
        demoPanik = 4;
        demoPanikRichtung = moeglich[Math.floor(Math.random() * moeglich.length)];
        return demoPanikRichtung;
      }
    }

    // Nächstes Ziel: manhattan-nächste ungesammelte Flasche, sonst die Tür.
    let ziel = null;
    if (state.gesammelt.size === state.flaschenTotal) {
      ziel = { x: state.tuer.x, y: state.tuer.y };
    } else {
      let besteD = Infinity;
      for (const f of state.flaschen) {
        if (f.gesammelt) continue;
        const d = Math.abs(f.x - state.werner.x) + Math.abs(f.y - state.werner.y);
        if (d < besteD) { besteD = d; ziel = { x: f.x, y: f.y }; }
      }
    }
    if (!ziel) return null;

    // BFS über das Gitter; Bullen-Zellen und Gefahrenzellen werden gemieden.
    // (Gleiche Strategie wie der Test-Bot in tests/bot.test.cjs.)
    const breite = state.breite, hoehe = state.hoehe;
    const idx = (x, y) => y * breite + x;
    const inGrenzen = (x, y) => x >= 0 && y >= 0 && x < breite && y < hoehe;
    const kachel = (x, y) => inGrenzen(x, y) ? state.gitter[idx(x, y)] : LOGIK.WAND;
    const passierbar = (x, y) => {
      const k = kachel(x, y);
      if (k === LOGIK.WAND) return false;
      if (k === LOGIK.STEIN) return y + 1 < hoehe ? kachel(x, y + 1) !== LOGIK.LUFT : false;
      if (k === LOGIK.TUER) return state.tuer.offen;
      return true; // LUFT, ERDE, FLASCHE
    };
    // Gefahrenzellen: Bullen-Position plus voraussichtliche Positionen im
    // nächsten Tick (weiter, Wende) — sonst prallt der Bot frontal in einen
    // herankommenden Bullen, weil beide im selben Tick ziehen.
    const gefahr = new Set();
    for (const g of state.gegner) {
      if (!g.lebt) continue;
      const dx = g.dir === 'rechts' ? 1 : -1;
      gefahr.add(`${g.x},${g.y}`);
      gefahr.add(`${g.x + dx},${g.y}`);
      gefahr.add(`${g.x - dx},${g.y}`);
    }

    const startIdx = idx(state.werner.x, state.werner.y);
    const zielIdx = inGrenzen(ziel.x, ziel.y) ? idx(ziel.x, ziel.y) : -1;
    const vormals = new Int32Array(breite * hoehe).fill(-2);
    vormals[startIdx] = -1;
    const queue = [startIdx];
    const richtung = [{ dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 }];
    let gefunden = -1;
    for (let qi = 0; qi < queue.length && gefunden < 0; qi++) {
      const i = queue[qi];
      const x = i % breite, y = Math.floor(i / breite);
      for (const r of richtung) {
        const nx = x + r.dx, ny = y + r.dy;
        if (!inGrenzen(nx, ny)) continue;
        const nidx = idx(nx, ny);
        if (vormals[nidx] !== -2) continue;
        const bulleDa = state.gegner.some(g => g.lebt && g.x === nx && g.y === ny);
        if ((bulleDa || gefahr.has(`${nx},${ny}`) || !passierbar(nx, ny)) && nidx !== zielIdx) continue;
        vormals[nidx] = i;
        if (nidx === zielIdx) { gefunden = nidx; break; }
        queue.push(nidx);
      }
    }
    if (gefunden >= 0) {
      let k = gefunden;
      while (vormals[k] !== startIdx && vormals[k] !== -1) k = vormals[k];
      const dx = k % breite - state.werner.x, dy = Math.floor(k / breite) - state.werner.y;
      if (dx === -1) return 'links';
      if (dx === 1) return 'rechts';
      if (dy === -1) return 'oben';
      if (dy === 1) return 'unten';
    }

    // Fallback: Richtung zum Ziel, dann die sicherste freie Seite
    const dxz = ziel.x - state.werner.x, dyz = ziel.y - state.werner.y;
    const kands = [
      { r: 'unten', d: [0, 1], s: dyz > 0 ? 2 : (dyz < 0 ? 0 : 1) },
      { r: 'oben', d: [0, -1], s: dyz < 0 ? 2 : (dyz > 0 ? 0 : 1) },
      { r: 'rechts', d: [1, 0], s: dxz > 0 ? 2 : (dxz < 0 ? 0 : 1) },
      { r: 'links', d: [-1, 0], s: dxz < 0 ? 2 : (dxz > 0 ? 0 : 1) },
    ].sort((a, b) => b.s - a.s);
    for (const k of kands) {
      const nx = state.werner.x + k.d[0], ny = state.werner.y + k.d[1];
      if (inGrenzen(nx, ny) && passierbar(nx, ny) && !gefahr.has(`${nx},${ny}`)) return k.r;
    }
    return null;
  }
  function demoErgebnisSchreiben(text) {
    let el = document.getElementById('demo-ergebnis');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-ergebnis';
      document.body.appendChild(el);
    }
    el.textContent = text;
  }

  // ---------- Startbildschirm ----------------------------------
  function startbildschirm() {
    modus = 'start';
    state = null;
    overlayZeigen(
      'BÖLKSTOFF-EXPRESS',
      'Werner braucht Bölkstoff. Tief unter dem Revier hocken die Deppenpolizisten ' +
      'Helmut und Bruno. Plappere alle Flaschen zusammen, bevor sie dir die Glatte ' +
      'volljagen — und raus durch die Tür!',
      'Enter oder Klick auf ein Level: los geht’s'
    );
    levelWahlAktualisieren();
  }

  // Die Startszene: Figuren am unteren Rand (unterhalb des Overlays sichtbar)
  function startszeneZeichnen() {
    const x0 = canvas.width / 2;
    const y0 = canvas.height - KACHEL - 6;
    ctx.drawImage(sprite('werner'), x0 - 3 * 32, y0);
    ctx.drawImage(sprite('helmut'), x0 - 32, y0);
    ctx.drawImage(sprite('bruno'), x0 + 32, y0);
    ctx.drawImage(sprite('flasche'), x0 + 3 * 32, y0);
  }

  // ---------- Ereignisse: Ton ----------------------------------
  const TONE = {
    'schritt': () => GERAUESCHE.schritt(),
    'graben': () => GERAUESCHE.graben(),
    'gegner-graben': () => GERAUESCHE.graben(),
    'stein-gebrochen': () => GERAUESCHE.stein(),
    'flasche': () => GERAUESCHE.plopp(),
    'tuer-offen': () => GERAUESCHE.tuer(),
    'level-schafft': () => GERAUESCHE.schafft(),
    'tod': () => GERAUESCHE.tod(),
    'gegner-gequetscht': () => GERAUESCHE.bulleTot(),
  };
  function ereignisseVerarbeiten(liste) {
    for (const e of liste) {
      const ton = TONE[e];
      if (ton) ton();
      if (e === 'tuer-offen') tuerGlueh = 1;
      if (e === 'tod') {
        todBlitz = 1;
        tode++;
        modus = 'tod';
        todTimer = 900;
        overlayZeigen(
          state.todUrsache === 'stein' ? 'PLATSCH!' : 'PLOPP!',
          state.todUrsache === 'stein' ? 'Ein Stein hat Werner die Krone gegeben.'
            : 'Ein Deppenpolizist hat Werner die Glatte vollgejagt.',
          ''
        );
      }
      if (e === 'level-schafft') {
        modus = 'fertig';
        if (demoLevel != null) {
          // Demo-Modus: Ergebnis für --dump-dom hinterlegen und stoppen
          demoErgebnisSchreiben(
            `DEMO OK: Level ${state.levelIndex + 1} „${state.name}" geschafft ` +
            `nach ${state.tick} Ticks und ${tode} Toden`);
          window.__demoFertig = true;
        }
        if (!stand.fertig.includes(state.levelIndex)) {
          stand.fertig.push(state.levelIndex);
          standSpeichern(stand);
        }
        const letztes = state.levelIndex === LEVELS.length - 1;
        overlayZeigen(
          letztes ? 'ALLE LEVEL GESCHAFFT!' : 'LEVEL GESCHAFFT!',
          letztes
            ? 'Das ganze Bölkstoff ist pladdert. Helmut und Bruno suchen weiter — Werner ist frei!'
            : `„${state.name}" ist erledigt. Werner trinkt den Schwitz.`,
          `Enter: ${letztes ? 'zurück zum Start' : 'nächstes Level'}`
        );
      }
    }
    hudAktualisieren();
    levelWahlAktualisieren();
  }

  // ---------- Zeichnen -----------------------------------------
  function zeichnen() {
    ctx.drawImage(hintergrund, 0, 0);
    if (modus === 'start') startszeneZeichnen();
    if (!state) return;

    const idx = (x, y) => y * state.breite + x;
    const wackeln = Math.floor(laufzeit / 300) % 2; // 1px Wackeln

    // Kacheln
    for (let y = 0; y < state.hoehe; y++) {
      for (let x = 0; x < state.breite; x++) {
        const k = state.gitter[idx(x, y)];
        if (k === LOGIK.WAND) ctx.drawImage(sprite('wand'), x * KACHEL, y * KACHEL);
        else if (k === LOGIK.ERDE) ctx.drawImage(sprite('erde'), x * KACHEL, y * KACHEL);
        else if (k === LOGIK.STEIN) ctx.drawImage(sprite('stein'), x * KACHEL, y * KACHEL);
      }
    }

    // Tür
    const tuerSprite = state.tuer.offen ? sprite('tuer_offen') : sprite('tuer_zu');
    ctx.drawImage(tuerSprite, state.tuer.x * KACHEL, state.tuer.y * KACHEL);
    if (state.tuer.offen && tuerGlueh > 0) {
      ctx.fillStyle = `rgba(232,181,58,${0.35 * tuerGlueh})`;
      ctx.fillRect(state.tuer.x * KACHEL - 4, state.tuer.y * KACHEL - 4, KACHEL + 8, KACHEL + 8);
    }

    // Flaschen (nur noch die ungesammelten)
    for (const f of state.flaschen) {
      if (!f.gesammelt) ctx.drawImage(sprite('flasche'), f.x * KACHEL, f.y * KACHEL);
    }

    // Bullen
    for (const g of state.gegner) {
      if (g.lebt) ctx.drawImage(sprite(g.typ), g.x * KACHEL, g.y * KACHEL - wackeln);
    }

    // Werner
    ctx.drawImage(sprite('werner'), state.werner.x * KACHEL, state.werner.y * KACHEL - wackeln);

    // Rot-Blitz nach dem Tod
    if (todBlitz > 0) {
      ctx.fillStyle = `rgba(201,75,75,${0.5 * todBlitz})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ---------- Eingabe ------------------------------------------
  const richtungsfuerTaste = {
    ArrowLeft: 'links', KeyA: 'links',
    ArrowRight: 'rechts', KeyD: 'rechts',
    ArrowUp: 'oben', KeyW: 'oben',
    ArrowDown: 'unten', KeyS: 'unten',
  };
  let eingabe = null; // aktuelle Haltungsrichtung

  window.addEventListener('keydown', (ev) => {
    GERAUESCHE.bereitmachen();
    const code = ev.code;
    if (richtungsfuerTaste[code]) {
      eingabe = richtungsfuerTaste[code];
      if (modus === 'pausiert') modus = 'spiel';
      ev.preventDefault();
      return;
    }
    if (code === 'Enter' || code === 'NumpadEnter') {
    ev.preventDefault();
    if (modus === 'start') {
      // Erstes noch offenes Level, sonst zurück zum Anfang
      let naechstes = 0;
      for (let i = 0; i < LEVELS.length; i++) {
        if (!stand.fertig.includes(i)) { naechstes = i; break; }
        naechstes = i; // alle fertig: letztes Level
      }
      levelStart(naechstes);
    } else if (modus === 'fertig') {
        const naechstes = state.levelIndex + 1;
        if (naechstes < LEVELS.length) levelStart(naechstes);
        else startbildschirm();
      } else if (modus === 'pausiert') {
        modus = 'spiel';
        overlayVerstecken();
      }
      return;
    }
    if (code === 'KeyM') {
      GERAUESCHE.stummen(!GERAUESCHE.istStumm());
      hudAktualisieren();
      return;
    }
    if (code === 'KeyR' && state) {
      LOGIK.erneut(state);
      tode++;
      todBlitz = 0;
      modus = 'spiel';
      overlayVerstecken();
      hudAktualisieren();
      return;
    }
    if (code === 'KeyP' && (modus === 'spiel' || modus === 'pausiert')) {
      if (modus === 'spiel') {
        modus = 'pausiert';
        overlayZeigen('PAUSE', 'Werner macht eine Verschnaufpause.', 'P oder Enter: weiterspielen');
      } else {
        modus = 'spiel';
        overlayVerstecken();
      }
    }
  });
  window.addEventListener('keyup', (ev) => {
    if (richtungsfuerTaste[ev.code] === eingabe) eingabe = null;
  });
  // Klick auf die Leinwand weckt den Ton
  canvas.addEventListener('mousedown', () => GERAUESCHE.bereitmachen());

  // ---------- Hauptschleife ------------------------------------
  // Logik und Rendering sind getrennt: die Logik tickt per setInterval
  // (fest 6,7 Ticks/Sekunde), das Zeichnen läuft per requestAnimationFrame.
  // So bleibt der Spieltakt auch dann stabil, wenn der Rechner mal
  // schlechter zeichnet (oder der Headless-Browser nur einen Rahmen malt).
  function tickSchritt() {
    if (modus === 'spiel') {
      // Im Demo-Modus spielt der Bot für uns
      const richtung = demoLevel != null ? demoRichtung(state) : eingabe;
      ereignisseVerarbeiten(LOGIK.tick(state, { richtung }));
    } else if (modus === 'tod') {
      todTimer -= TICK_MS;
      todBlitz = Math.max(0, todBlitz - 0.06);
      if (todTimer <= 0) {
        LOGIK.erneut(state);
        todBlitz = 0;
        modus = 'spiel';
        overlayVerstecken();
        hudAktualisieren();
      }
    }
    if (tuerGlueh > 0) tuerGlueh = Math.max(0, tuerGlueh - 0.02);
  }

  let laufzeit = 0;
  function schleife(ts) {
    laufzeit = ts;
    zeichnen();
    requestAnimationFrame(schleife);
  }
  setInterval(tickSchritt, TICK_MS);

  // ---------- Los geht's ---------------------------------------
  function start() {
    const level = LEVELS[0];
    // Leinwandgröße passend zum ersten Level (alle Levels haben gleiche Maße)
    const probe = LOGIK.vonMap(level.map);
    canvas.width = probe.breite * KACHEL;
    canvas.height = probe.hoehe * KACHEL;
    levelWahlAufbauen();
    if (demoLevel != null && demoLevel >= 0 && demoLevel < LEVELS.length) {
      levelStart(demoLevel); // Demo-Modus: direkt lospielen
    } else {
      startbildschirm();
    }
    requestAnimationFrame(schleife);
  }
  start();
})();
