// A page of a chess book, as HTML, for the store screenshots and the press kit: the companion idea needs a
// book next to the phone. The diagram is the Italian Game position the phone analyses in those images.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6, White to play (the same position as ITALIAN in the scripts) */
const PLACEMENT = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R';

const TEXT = {
  en: {
    chapter: 'Chapter 3 · The Italian Game',
    before:
      'White has developed quickly and now prepares the advance d2–d4, to take the centre with tempo. Black has to react precisely, or the pressure on f7 becomes decisive.',
    caption: 'Diagram 21 — White to play',
    after:
      'What is the most accurate continuation? Before you read on, find a plan for White and compare it with the variations that follow.',
  },
  de: {
    chapter: 'Kapitel 3 · Italienische Partie',
    before:
      'Weiß hat sich schnell entwickelt und bereitet nun den Vorstoß d2–d4 vor, um mit Tempo das Zentrum zu besetzen. Schwarz muss genau reagieren, sonst wird der Druck auf f7 entscheidend.',
    caption: 'Diagramm 21 — Weiß am Zug',
    after:
      'Wie setzt Weiß am genauesten fort? Bevor du weiterliest, such einen Plan für Weiß und vergleiche ihn mit den folgenden Varianten.',
  },
  es: {
    chapter: 'Capítulo 3 · Apertura italiana',
    before:
      'Las blancas se han desarrollado rápido y ahora preparan el avance d2–d4 para ocupar el centro ganando tiempo. Las negras deben reaccionar con precisión o la presión sobre f7 será decisiva.',
    caption: 'Diagrama 21 — Juegan las blancas',
    after:
      '¿Cuál es la continuación más precisa? Antes de seguir leyendo, busca un plan para las blancas y compáralo con las variantes que siguen.',
  },
  fr: {
    chapter: 'Chapitre 3 · Partie italienne',
    before:
      'Les Blancs se sont développés rapidement et préparent la poussée d2–d4 pour occuper le centre avec gain de temps. Les Noirs doivent réagir avec précision, sinon la pression sur f7 deviendra décisive.',
    caption: 'Diagramme 21 — Les Blancs jouent',
    after:
      'Quelle est la suite la plus précise ? Avant de poursuivre, cherchez un plan pour les Blancs et comparez-le aux variantes qui suivent.',
  },
};

const piece = (p) => {
  const file = path.join(root, 'public', 'pieces', 'merida', `${p === p.toUpperCase() ? 'w' : 'b'}${p.toUpperCase()}.svg`);
  return 'data:image/svg+xml;base64,' + fs.readFileSync(file).toString('base64');
};

/** a printed diagram: hatched dark squares, a double frame, Merida pieces */
function diagram() {
  const rows = PLACEMENT.split('/').map((r) => r.replace(/\d/g, (d) => '.'.repeat(Number(d))));
  let squares = '';
  let pieces = '';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) squares += `<rect x="${c * 50}" y="${r * 50}" width="50" height="50" fill="url(#hatch)"/>`;
      const p = rows[r][c];
      if (p === '.') continue;
      if ((r + c) % 2 === 1) pieces += `<rect x="${c * 50 + 7}" y="${r * 50 + 5}" width="36" height="40" fill="#f7f2e6"/>`;
      pieces += `<image href="${piece(p)}" x="${c * 50 + 3}" y="${r * 50 + 3}" width="44" height="44"/>`;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-14 -14 428 428" style="width:100%;display:block">
    <defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="#f7f2e6"/><rect width="1.9" height="5" fill="#2a2622"/></pattern></defs>
    <rect x="-10" y="-10" width="420" height="420" fill="none" stroke="#1d1a17" stroke-width="5"/>
    <rect width="400" height="400" fill="#f7f2e6" stroke="#1d1a17" stroke-width="1.5"/>${squares}${pieces}</svg>`;
}

/**
 * The page, `width` px wide (everything scales with it), in a language of TEXT. `pageNumber` sits at the
 * bottom; the paper has a faint grain and a soft fold shadow on the left, like an open book.
 */
export function bookPage(lang = 'en', { width = 340, pageNumber = 87 } = {}) {
  const t = TEXT[lang] ?? TEXT.en;
  const u = width / 340; // 1 at the design width
  return `<div style="width:${width}px;box-sizing:border-box;padding:${26 * u}px ${24 * u}px ${18 * u}px ${28 * u}px;
      background:linear-gradient(90deg,rgba(80,60,30,.16),rgba(80,60,30,0) 9%),#f7f2e6;color:#26221d;
      font:${9.6 * u}px/1.5 Georgia,'Times New Roman',serif;text-align:justify;hyphens:auto;border-radius:${3 * u}px;
      box-shadow:0 ${18 * u}px ${44 * u}px rgba(15,23,42,.42),0 ${2 * u}px ${4 * u}px rgba(15,23,42,.2)" lang="${lang}">
    <div style="font-size:${8 * u}px;letter-spacing:${1.2 * u}px;text-transform:uppercase;color:#7a6d5c;text-align:center;
        margin-bottom:${10 * u}px">${t.chapter}</div>
    <p style="margin:0 0 ${10 * u}px">${t.before}</p>
    <div style="width:${210 * u}px;margin:0 auto">${diagram()}</div>
    <div style="font-style:italic;text-align:center;margin:${5 * u}px 0 ${10 * u}px">${t.caption}</div>
    <p style="margin:0">${t.after}</p>
    <div style="text-align:center;margin-top:${12 * u}px;font-size:${8.5 * u}px;color:#7a6d5c">${pageNumber}</div>
  </div>`;
}
