// Skript: prüft alle Level-Karten auf Formfehler.
'use strict';
const LEVELS = require('../src/levels.js');
const LOGIK = require('../src/logik.js');

let fehlerhaft = 0;
for (const [i, l] of LEVELS.entries()) {
  const f = LOGIK.levelPruefen(l.map);
  if (f.length) {
    fehlerhaft++;
    console.log(`Level ${i + 1} „${l.name}“:`);
    f.forEach(e => console.log('  - ' + e));
  } else {
    console.log(`Level ${i + 1} „${l.name}“: OK`);
  }
}
process.exit(fehlerhaft ? 1 : 0);
