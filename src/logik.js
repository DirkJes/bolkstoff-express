/*
 * logik.js — die reine Spiellogik von „Bölkstoff-Express".
 *
 * Ein Boulder-Dash-Remake nach dem Public-Domain-Klassiker „Werner Flaschbier"
 * (1989/90, Level 4). Werner gräbt durchs Bölkstoff-Revier, plappert Flaschen
 * zusammen und weicht den Deppenpolizisten Helmut und Bruno aus.
 *
 * Diese Datei ist bewusst DOM-frei, damit sie unter Node für die Tests
 * (node --test) laufen kann. Alles, was Bildschirm, Tastatur oder Ton betrift,
 * lebt in haupt.js, sprites.js und geraeusche.js.
 *
 * Regeln (wie im Original, etwas entschärft):
 *  - Werner bewegt sich kachelweise (links/rechts/oben/unten).
 *  - Werner ist ein geschickter Kletterer: so lange er sich nach oben oder
 *    seitwärts bewegt, hält er die Position (Wandlauf). Steht er still oder
 *    läuft er nach unten, greift die Schwerkraft.
 *  - Erde wird durchgegraben, wenn Werner hineinläuft.
 *  - Stein bricht nur, wenn er unten aufliegt (unten nicht Luft).
 *  - Flaschen pladdern in den Magen (Sammelkisten = die Flaschen).
 *  - Alle Flaschen zusammen -> die Tür (E) öffnet sich.
 *  - Alle Kacheln außer Wand haben Schwerkraft (fallen nach unten).
 *  - Ein Stein, der Werner auf den Kopf fällt, ist's. Ein Stein auf einem
 *    Bullen: der Bulle ist's.
 *  - Bullen (Helmut/Bruno) laufen horizontal, graben Erde, drehen an Wänden
 *    und Steinen um, graben sich bei blockiertem Weg nach unten. Die Bullen
 *    sind ungeschickter als Werner: Sie fallen immer, wenn Luft darunter ist.
 *  - Bei Tod: Karte neu, gesammelte Flaschen bleiben, die Tür bleibt offen.
 */
'use strict';

const LOGIK = (() => {

  // Kachel-Konstanten
  const LUFT = 0, WAND = 1, ERDE = 2, STEIN = 3, FLASCHE = 4, TUER = 5;

  const R = {
    links:  { dx: -1, dy: 0 },
    rechts: { dx: 1,  dy: 0 },
    oben:   { dx: 0,  dy: -1 },
    unten:  { dx: 0,  dy: 1 },
  };

  // Zeichenlegende für die Level (Doku: DOKUMENTATION.md)
  const ZEICHEN = {
    '#': WAND,    // Felswand, unbeweglich
    '.': LUFT,    // Hohlraum
    ',': ERDE,    // Erde: brüchig, fällt, Werner gräbt hindurch
    '-': STEIN,   // Stein: fällt, bricht nur wenn er unten liegt
    'o': FLASCHE, // Bölkstoff-Flasche
    'E': TUER,    // Ausgang (Tür) — öffnet sich, wenn alles pladdert
  };

  const schluessel = (x, y) => x + ',' + y;

  /**
   * Prüft eine Level-Karte (Zeichen) auf Formfehler.
   * Gibt ein Array mit Fehlermeldungen zurück (leer = in Ordnung).
   * Regeln: gleiche Zeilenbreite, nur bekannte Zeichen, genau ein W,
   * genau ein E, mindestens eine Flasche, Rand vollständig mit Wand.
   */
  function levelPruefen(map) {
    const fehler = [];
    const zeilen = map.split('\n').filter(z => z.length > 0);
    const breite = zeilen.length ? zeilen[0].length : 0;
    let werner = 0, tuer = 0, flaschen = 0, bullen = 0;

    zeilen.forEach((zeile, y) => {
      if (zeile.length !== breite) {
        fehler.push(`Zeile ${y + 1}: Breite ${zeile.length}, erwartet ${breite}`);
      }
      for (let x = 0; x < zeile.length; x++) {
        const c = zeile[x];
        if (c === 'W') werner++;
        else if (c === 'E') tuer++;
        else if (c === 'o') flaschen++;
        else if (c === 'H' || c === 'B') bullen++;
        else if (!(c in ZEICHEN)) fehler.push(`Unbekanntes Zeichen ${JSON.stringify(c)} bei ${x},${y}`);
        const rand = y === 0 || y === zeilen.length - 1 || x === 0 || x === zeile.length - 1;
        if (rand && c !== '#' && c !== '-') fehler.push(`Rand bei ${x},${y}: ${JSON.stringify(c)} (muss # oder - sein)`);
      }
    });
    if (werner !== 1) fehler.push(`Werner: ${werner}x gefunden, erwartet 1`);
    if (tuer !== 1) fehler.push(`Tür: ${tuer}x gefunden, erwartet 1`);
    if (flaschen === 0) fehler.push('Keine Flaschen (o) auf der Karte');
    if (bullen > 4) fehler.push(`Zu viele Bullen (${bullen}), maximal 4`);
    if (zeilen.length < 10 || zeilen.length > 18) fehler.push(`Höhe ${zeilen.length} außerhalb 10..18`);
    if (breite < 16 || breite > 28) fehler.push(`Breite ${breite} außerhalb 16..28`);
    return fehler;
  }

  /**
   * Legt aus einer Karten-Zeichenkette einen frischen Spielzustand an.
   * opts.zufall: Zufallsgenerator (für deterministische Tests injizierbar).
   */
  function vonMap(map, opts = {}) {
    const fehler = levelPruefen(map);
    if (fehler.length) throw new Error('Ungültiges Level: ' + fehler.join('; '));

    const zeilen = map.split('\n').filter(z => z.length > 0);
    const hoehe = zeilen.length;
    const breite = zeilen[0].length;
    const gitter = new Uint8Array(breite * hoehe); // default LUFT
    let wernerStart = null, tuer = null;
    const gegner = [];

    zeilen.forEach((zeile, y) => {
      for (let x = 0; x < breite; x++) {
        const c = zeile[x];
        if (c === 'W') wernerStart = { x, y };
        else if (c === 'E') tuer = { x, y };
        else if (c === 'H' || c === 'B') {
          gegner.push({ x, y, typ: c === 'H' ? 'helmut' : 'bruno', dir: null, sx: x, sy: y, lebt: true });
        } else if (c in ZEICHEN) {
          gitter[y * breite + x] = ZEICHEN[c];
        }
      }
    });

    const zufall = opts.zufall || Math.random;
    for (const g of gegner) g.dir = zufall() < 0.5 ? 'links' : 'rechts';

    // Flaschen als Objekte führen: sie fallen umher, aber der Sammelstatus
    // gehört zur Flasche, nicht zur Zelle — sonst tauchen gesammelte
    // Flaschen nach einem Neustart in ihrer Startposition wieder auf.
    const flaschen = [];
    for (let y = 0; y < hoehe; y++) {
      for (let x = 0; x < breite; x++) {
        if (gitter[y * breite + x] === FLASCHE) {
          flaschen.push({ x, y, sx: x, sy: y, gesammelt: false });
        }
      }
    }

    return {
      levelIndex: opts.levelIndex != null ? opts.levelIndex : -1,
      name: opts.name || '',
      map, breite, hoehe, gitter,
      werner: { x: wernerStart.x, y: wernerStart.y },
      wernerStart,
      tuer: { x: tuer.x, y: tuer.y, offen: false },
      gegner,
      flaschen,
      flaschenTotal: flaschen.length,
      gesammelt: new Set(),
      leben: 3,
      zufall,
      tod: false, todUrsache: null,
      levelFertig: false,
      tick: 0,
    };
  }

  /** LEVELS auflösen: Browser (global) oder Node (Modul). */
  function levelle() {
    if (typeof globalThis !== 'undefined' && Array.isArray(globalThis.LEVELS)) return globalThis.LEVELS;
    if (typeof module !== 'undefined' && typeof require === 'function') return require('./levels.js');
    throw new Error('LEVELS nicht gefunden — levels.js bitte vor logik.js laden');
  }

  /** Frischer Zustand für Level-Index aus der LEVELS-Tabelle. */
  function neu(levelIndex, opts = {}) {
    const level = levelle()[levelIndex];
    if (!level) throw new Error(`Level ${levelIndex + 1} nicht gefunden`);
    return vonMap(level.map, { ...opts, levelIndex, name: level.name });
  }

  function sterben(state, ereignisse, ursache) {
    if (state.tod) return;
    state.tod = true;
    state.todUrsache = ursache;
    ereignisse.push('tod');
  }

  /**
   * Ein Spieltick. input.richtung: 'links'|'rechts'|'oben'|'unten'|null.
   * Gibt eine Liste von Ereignissen zurück (für Ton/Animation):
   * 'schritt','graben','stein-gebrochen','flasche','tuer-offen',
   * 'level-schafft','tod','gegner-graben','gegner-gequetscht'.
   */
  function tick(state, input = {}) {
    const ereignisse = [];
    if (state.tod || state.levelFertig) return ereignisse;
    state.tick++;

    const { breite, hoehe, gitter } = state;
    const werner = state.werner;
    const idx = (x, y) => y * breite + x;
    const inGrenzen = (x, y) => x >= 0 && y >= 0 && x < breite && y < hoehe;
    const kachel = (x, y) => inGrenzen(x, y) ? gitter[idx(x, y)] : WAND;

    // ---- 1) Werner bewegt sich -------------------------------
    // klettern: Werner ist ein geschickter Kletterer — so lange er sich
    // nach oben oder seitwärts bewegt, hält er die Position (Wandlauf).
    // Er fällt nur, wenn er stehengeblieben ist oder nach unten läuft.
    // Die Bullen sind ungeschickter und fallen immer, wenn Luft da ist.
    const dir = input.richtung && R[input.richtung];
    let klettern = false;
    if (dir) {
      const tx = werner.x + dir.dx, ty = werner.y + dir.dy;
      if (inGrenzen(tx, ty)) {
        const t = gitter[idx(tx, ty)];
        const bulleHier = state.gegner.some(g => g.lebt && g.x === tx && g.y === ty);
        if (bulleHier) { sterben(state, ereignisse, 'polizist'); return ereignisse; }
        const kletterBewegung = dir.dx !== 0 || dir.dy === -1;
        if (t === LUFT) {
          werner.x = tx; werner.y = ty;
          if (dir.dx !== 0) ereignisse.push('schritt');
          if (kletterBewegung) klettern = true;
        } else if (t === ERDE) {
          gitter[idx(tx, ty)] = LUFT;
          werner.x = tx; werner.y = ty;
          ereignisse.push('graben');
          if (kletterBewegung) klettern = true;
        } else if (t === FLASCHE) {
          const f = state.flaschen.find(fl => !fl.gesammelt && fl.x === tx && fl.y === ty);
          gitter[idx(tx, ty)] = LUFT;
          werner.x = tx; werner.y = ty;
          if (f) {
            f.gesammelt = true;
            state.gesammelt.add(f);
            ereignisse.push('flasche');
            if (state.gesammelt.size === state.flaschenTotal) {
              state.tuer.offen = true;
              ereignisse.push('tuer-offen');
            }
          }
          if (kletterBewegung) klettern = true;
        } else if (t === STEIN) {
          const steinUnten = kachel(tx, ty + 1);
          if (steinUnten !== LUFT) {
            gitter[idx(tx, ty)] = LUFT;
            werner.x = tx; werner.y = ty;
            ereignisse.push('stein-gebrochen');
            if (kletterBewegung) klettern = true;
          }
          // Schwebender Stein: Werner kann ihn nicht betreten,
          // der Stein fällt im Schwerkraft-Durchgang (evtl. auf Werner).
        } else if (t === TUER && state.tuer.offen) {
          state.levelFertig = true;
          ereignisse.push('level-schafft');
        }
      }
    }
    if (state.tod) return ereignisse;

    // ---- 2) Schwerkraft: Figuren fallen eine Kachel ------------
    // Werner fällt nur, wenn er gerade nicht klettert/läuft (siehe oben).
    const figFallen = e => {
      if (e.y + 1 < hoehe && kachel(e.x, e.y + 1) === LUFT
          && !state.gegner.some(g => g !== e && g.lebt && g.x === e.x && g.y === e.y + 1)) {
        e.y++;
      }
    };
    if (!klettern) figFallen(werner);
    for (const g of state.gegner) if (g.lebt) figFallen(g);

    // Kollision nach dem Fallen (Bulle fällt auf Werner bzw. umgekehrt)
    for (const g of state.gegner) {
      if (g.lebt && g.x === werner.x && g.y === werner.y) {
        sterben(state, ereignisse, 'polizist');
        break;
      }
    }
    if (state.tod) return ereignisse;

    // ---- 3) Schwerkraft: Kacheln fallen bis zum Ruhezustand ----
    // Kacheln dürfen Figuren nicht durchdringen: Ruhen sie auf einer
    // Figur (Zelle gleich), fallen sie nicht weiter.
    const figurenZellen = new Set(
      [schluessel(werner.x, werner.y),
       ...state.gegner.filter(g => g.lebt).map(g => schluessel(g.x, g.y))]
    );
    for (let runde = 0; runde < hoehe; runde++) {
      let geaendert = false;
      for (let y = hoehe - 2; y >= 0; y--) {
        for (let x = 0; x < breite; x++) {
          const k = gitter[idx(x, y)];
          if (k !== ERDE && k !== STEIN && k !== FLASCHE) continue;
          if (figurenZellen.has(schluessel(x, y))) continue; // ruht auf Figur
          if (gitter[idx(x, y + 1)] !== LUFT) continue;
          if (k === FLASCHE) {
            // Flaschen-Objekt mit der Kachel mitschieben
            const f = state.flaschen.find(fl => !fl.gesammelt && fl.x === x && fl.y === y);
            if (f) { f.x = x; f.y = y + 1; }
          }
          gitter[idx(x, y + 1)] = k;
          gitter[idx(x, y)] = LUFT;
          geaendert = true;
        }
      }
      if (!geaendert) break;
    }

    // ---- 4) Quetsch-Prüfung -----------------------------------
    if (gitter[idx(werner.x, werner.y)] === STEIN) sterben(state, ereignisse, 'stein');
    for (const g of state.gegner) {
      if (g.lebt && gitter[idx(g.x, g.y)] === STEIN) {
        g.lebt = false;
        ereignisse.push('gegner-gequetscht');
      }
    }
    if (state.tod) return ereignisse;

    // ---- 5) Bullen-KI ------------------------------------------
    for (const g of state.gegner) {
      if (!g.lebt) continue;
      // Die Bullen brauchen auch mal einen Kaffee: 15 % Pause.
      if (state.zufall() < 0.15) continue;

      // Fallen (wenn unten nichts ist)
      if (g.y + 1 < hoehe && kachel(g.x, g.y + 1) === LUFT
          && !state.gegner.some(o => o !== g && o.lebt && o.x === g.x && o.y === g.y + 1)) {
        g.y++;
        if (g.x === werner.x && g.y === werner.y) {
          sterben(state, ereignisse, 'polizist');
          break;
        }
        continue;
      }

      const d = R[g.dir];
      const tx = g.x + d.dx, ty = g.y + d.dy;
      const ziel = kachel(tx, ty);
      const wernerDa = werner.x === tx && werner.y === ty;
      const kollegeDa = state.gegner.some(o => o !== g && o.lebt && o.x === tx && o.y === ty);

      if (wernerDa) {
        g.x = tx; g.y = ty; // auf Werner gerannt: Plopp!
        sterben(state, ereignisse, 'polizist');
        break;
      } else if (kollegeDa || ziel === WAND || ziel === TUER) {
        g.dir = d.dx === 1 ? 'links' : 'rechts';
        // Bei blockiertem Weg graben die Bullen sich nach unten.
        if (kachel(g.x, g.y + 1) === ERDE) {
          gitter[idx(g.x, g.y + 1)] = LUFT;
          g.y++;
          ereignisse.push('gegner-graben');
        }
      } else if (ziel === ERDE) {
        gitter[idx(tx, ty)] = LUFT;
        g.x = tx; g.y = ty;
        ereignisse.push('gegner-graben');
      } else if (ziel === LUFT) {
        g.x = tx; g.y = ty;
      } else {
        // Stein oder Flasche: Umdrehen.
        g.dir = d.dx === 1 ? 'links' : 'rechts';
      }
    }

    return ereignisse;
  }

  /**
   * Neustart nach Tod: Karte wird neu aufgebaut, gesammelte Flaschen
   * bleiben gesammelt, Bullen kehren an ihre Startposition zurück.
   */
  function erneut(state) {
    const zeilen = state.map.split('\n').filter(z => z.length > 0);
    for (let y = 0; y < state.hoehe; y++) {
      for (let x = 0; x < state.breite; x++) {
        const c = zeilen[y][x];
        let k;
        if (c === '#') k = WAND;
        else if (c === '-') k = STEIN;
        else if (c === ',') k = ERDE;
        else if (c === 'E') k = TUER;
        else k = LUFT;
        state.gitter[y * state.breite + x] = k;
      }
    }
    // Flaschen: gesammelte bleiben weg, die anderen kehren nach Start zurück.
    for (const f of state.flaschen) {
      if (f.gesammelt) continue;
      f.x = f.sx; f.y = f.sy;
      state.gitter[f.y * state.breite + f.x] = FLASCHE;
    }
    state.werner.x = state.wernerStart.x;
    state.werner.y = state.wernerStart.y;
    for (const g of state.gegner) {
      g.x = g.sx; g.y = g.sy;
      g.lebt = true;
      g.dir = state.zufall() < 0.5 ? 'links' : 'rechts';
    }
    state.tod = false;
    state.todUrsache = null;
    state.tuer.offen = state.gesammelt.size === state.flaschenTotal;
  }

  return { LUFT, WAND, ERDE, STEIN, FLASCHE, TUER, R, ZEICHEN, levelPruefen, vonMap, neu, tick, erneut };
})();

// Für Node (Tests) exportieren; im Browser liegt LOGIK im globalen Scope.
if (typeof module !== 'undefined' && module.exports) module.exports = LOGIK;
