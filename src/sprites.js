/*
 * sprites.js — die selbst gezeichnete Pixel-Art von „Bölkstoff-Express".
 *
 * Jede Figur und jede Kachel ist eine 16x16 Pixel-Matrix, in der jedes
 * Zeichen einer Farbe der Palette entspricht. Punkt (.) ist transparent.
 * Die Matrizen werden zur Laufzeit in Offscreen-Canvas gerendert — es
 * braucht keine externen Grafikdateien.
 */
'use strict';

const SPRITES = (() => {

  // Gemeinsame Palette für alle Figuren
  const K = '#1b1b2f';   // dunkle Kontur
  const HAAR = '#f6c445';// blondes Haar
  const HAUT = '#f2c9a0';
  const NASE = '#e08a5f';// die berühmte Riesennase
  const AUGE = '#23233a';
  const SCHRITT_MU = '#6a4626';// Schnurrhaar
  const HEMD = '#c94b4b';      // rotes Hemd
  const LATZ = '#3f6fd1';      // blaue Latzhose
  const KNOPF = '#e8b53a';     // gelber Knopf

  const FIGUR_PALETTE = {
    '.': null, K, H: HAAR, S: HAUT, N: NASE, E: AUGE,
    M: SCHRITT_MU, R: HEMD, B: LATZ, Y: KNOPF,
  };

  // Werner: blond, Riesennase, Schnauzer, Latzhose.
  const WERNER = [
    '................',
    '.....KKKKKK.....',
    '....KHHHHHHK....',
    '...KHHHHHHHHK...',
    '...KHHHHHHHHK...',
    '...KSSSSSSSSK...',
    '...KSSESSESSK...',
    '...KSSNNNSSSK...',
    '...KSNNNNNNSK...',
    '...KSSNNNNNSK...',
    '...KMMMMMMMMK...',
    '...KKSSSSSSKK...',
    '...KRBRRRRBRK...',
    '...KBBYBBYBBK...',
    '....KBBBBBBK....',
    '....KBB..BBK....',
  ];

  // Helmut: Deppenpolizist in Grün, Mütze, Schnauzer.
  const HELMUT = [
    '................',
    '................',
    '................',
    '.....KKKKKK.....',
    '....KGGGGGGK....',
    '...KGGGGGGGGK...',
    '...KSSSSSSSSK...',
    '...KSSESSESSK...',
    '...KSSSSSSSSK...',
    '...KMMMMMMMMK...',
    '...KGGGGGGGGK...',
    '...KGGGGGGGGK...',
    '...KGGGGGGGGK...',
    '...KGGGGGGGGK...',
    '....KGGGGGGK....',
    '....KGG..GGK....',
  ];

  // Bruno: der zweite Deppenpolizist, dunkleres Grün, graue Mütze.
  const BRUNO = [
    '................',
    '................',
    '................',
    '.....KKKKKK.....',
    '....KZZZZZZK....',
    '...KZZZZZZZZK...',
    '...KSSSSSSSSK...',
    '...KSSESSESSK...',
    '...KSSSSSSSSK...',
    '...KMMMMMMMMK...',
    '...KGGGGGGGGK...',
    '...KGGGGGGGGK...',
    '...KGGGGGGGGK...',
    '...KGGGGGGGGK...',
    '....KGGGGGGK....',
    '....KGG..GGK....',
  ];

  // Bölkstoff-Flasche: grünes Glas, goldener Plopp-Bügelverschluss.
  const FLASCHE = [
    '................',
    '......KKKK......',
    '.....KYYYYK.....',
    '.....KYYYYKY....',
    '.....KYYYYK.....',
    '.....KGGGGK.....',
    '....KGGGGGGK....',
    '...KGGGGGGGGK...',
    '...KGWGGGGGGK...',
    '...KGWGGGGGGK...',
    '...KGWGGGGGGK...',
    '...KGWGGGGGGK...',
    '...KGGGGGGGGK...',
    '...KGGGGGGGGK...',
    '....KGGGGGGK....',
    '................',
  ];

  // Ausgangstür: zu (Holztür) und offen (dunkle Höhlengruft).
  const TUER_ZU = [
    'KKKKKKKKKKKKKKKK',
    'KWWWWWWWWWWWWWWK',
    'KWWWWWWWWWWWWWWK',
    'KWWDDWWWWWWDDWWK',
    'KWWWWWWWWWWWWWWK',
    'KWWWWWWWWWWWWWWK',
    'KWWWWWWYYWWWWWWK',
    'KWWWWWWWWWWWWWWK',
    'KWWDDWWWWWWDDWWK',
    'KWWWWWWWWWWWWWWK',
    'KWWWWWWWWWWWWWWK',
    'KWWWWWWYYWWWWWWK',
    'KWWWWWWWWWWWWWWK',
    'KWWDDWWWWWWDDWWK',
    'KWWWWWWWWWWWWWWK',
    'KKKKKKKKKKKKKKKK',
  ];
  const TUER_OFFEN = [
    'KKKKKKKKKKKKKKKK',
    'KWWWWWWWWWWWWWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWDDDDDDDDDDWWK',
    'KWWWWWWWWWWWWWWK',
    'KKKKKKKKKKKKKKKK',
  ];

  // Kacheln: Felswand, Erde, Stein.
  const WAND = [
    'KKKKKKKKKKKKKKKK',
    'KGGGGGKGGGGGGGGK',
    'KGDDDDKGGGGGGDGK',
    'KGGGGGKGGGDGGGGK',
    'KGGGKKGGGGGGGDGK',
    'KDDGGGKGGGGGGGGK',
    'KGGGGGKGGDDGGGGK',
    'KGGGGGGGGGGGDDGK',
    'KGGGDGGGGGGGGGGK',
    'KGGGGGKKGGGDGGGK',
    'KGGGGGGGGGGGGDGK',
    'KDDGGGGGDGGGGGGK',
    'KGGGGGGGGGGDDGGK',
    'KGGGDGGGGGGGGGGK',
    'KGGGGGGGGGGGGGGK',
    'KKKKKKKKKKKKKKKK',
  ];
  const ERDE = [
    'KKKKKKKKKKKKKKKK',
    'KBBBBDBBBBBBDBBK',
    'KBBDBBBBBDBBBBBK',
    'KBBBBBBBBBBBDBBK',
    'KDBBBBBBDBBBBBBK',
    'KBBBBDBBBBBBBBBK',
    'KBBBBBBDBBBBBDBK',
    'KBDBBBBBBBBBBBBK',
    'KBBBBBBBBDBBBBBK',
    'KBBBBDBBBBBBDBBK',
    'KDBBBBBBBBBBBBBK',
    'KBBBBBBDBBBBBDBK',
    'KBBBBBDBBBBBBBBK',
    'KDBBBBBBBBBDBBBK',
    'KBBBBBBBBBBBBBBK',
    'KKKKKKKKKKKKKKKK',
  ];
  const STEIN = [
    'KKKKKKKKKKKKKKKK',
    'KKSSSSSSSSSSSSKK',
    'KSSSSSSSSSSSSSSK',
    'KSSDDSSSSSSDDSSK',
    'KSSSSSSSDDSSSSSK',
    'KSSDDSSSSSSSSSSK',
    'KSSSSSSSSDDSSSSK',
    'KSSSSSDDSSSSSSSK',
    'KSSSSSSSSSSDDSSK',
    'KSSDDSSSSSSSSSSK',
    'KSSSSSSSSSDDSSSK',
    'KSSSSDDSSSSSSSSK',
    'KSSSSSSSSSSSSDDK',
    'KSSSSSSSSSSSSSSK',
    'KKSSSSSSSSSSSSKK',
    'KKKKKKKKKKKKKKKK',
  ];

  // Kachel-Paletten
  const GRAU = { K, G: '#6a7285', D: '#454c63' };
  const BRAUN = { K, B: '#8a5a3a', D: '#6a4228' };
  const LICHGRAU = { K, S: '#9aa3b8', D: '#6a7285' };
  const HOLZ = { K, W: '#9a6a42', D: '#5f3f26', Y: KNOPF };
  const GRUEN_GOLD = { K, Y: '#e8b53a', G: '#4fae5f', W: '#bfe8c5' };
  const POLIZIST_GRUEN = { K, G: '#4f9e4f', Z: '#4f9e4f', S: HAUT, E: AUGE, M: SCHRITT_MU };
  const POLIZIST_DUNKEL = { K, Z: '#8a8f9e', G: '#3f7e5a', S: HAUT, E: AUGE, M: SCHRITT_MU };
  const OFFEN_PALETTE = { K, W: '#9a6a42', D: '#12122a' };

  // Definition: Name -> { pixels, palette }
  const DEFINITION = {
    werner:  { pixels: WERNER,  palette: FIGUR_PALETTE },
    helmut:  { pixels: HELMUT,  palette: POLIZIST_GRUEN },
    bruno:   { pixels: BRUNO,   palette: POLIZIST_DUNKEL },
    flasche: { pixels: FLASCHE, palette: GRUEN_GOLD },
    tuer_zu:   { pixels: TUER_ZU,    palette: HOLZ },
    tuer_offen:{ pixels: TUER_OFFEN, palette: OFFEN_PALETTE },
    wand:    { pixels: WAND,    palette: GRAU },
    erde:    { pixels: ERDE,    palette: BRAUN },
    stein:   { pixels: STEIN,   palette: LICHGRAU },
  };

  // Prüft, dass alle Zeilen gleich lang sind (16x16) und gibt die
  // fehlerhaften Zeilen zurück — wird in den Tests genutzt.
  function fehler() {
    const ausgabe = [];
    for (const [name, def] of Object.entries(DEFINITION)) {
      const breite = def.pixels[0].length;
      def.pixels.forEach((zeile, i) => {
        if (zeile.length !== breite) {
          ausgabe.push(`${name} Zeile ${i}: ${zeile.length} statt ${breite} Zeichen`);
        }
      });
      if (breite !== 16) ausgabe.push(`${name}: ${breite} statt 16 Spalten`);
      if (def.pixels.length !== 16) ausgabe.push(`${name}: ${def.pixels.length} statt 16 Zeilen`);
    }
    return ausgabe;
  }

  // Rendert ein Sprite in ein Offscreen-Canvas (Skala = Vergrößerungsfaktor).
  function rendere(name, skala = 2) {
    const def = DEFINITION[name];
    if (!def) throw new Error(`Unbekanntes Sprite: ${name}`);
    const c = document.createElement('canvas');
    c.width = 16 * skala;
    c.height = 16 * skala;
    const g = c.getContext('2d');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const farbe = def.palette[def.pixels[y][x]];
        if (!farbe) continue;
        g.fillStyle = farbe;
        g.fillRect(x * skala, y * skala, skala, skala);
      }
    }
    return c;
  }

  return { DEFINITION, fehler, rendere };
})();

// Für Node (Tests) exportieren; im Browser liegt SPRITES im globalen Scope.
if (typeof globalThis !== 'undefined') globalThis.SPRITES = SPRITES;
if (typeof module !== 'undefined' && module.exports) module.exports = SPRITES;
