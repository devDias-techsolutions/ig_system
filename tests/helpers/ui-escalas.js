'use strict';
// Auditoria das escalas de UI (docs/UI-GUIDELINES.md).
// Conta valores LITERAIS fora da escala em cada tela. O limite por arquivo fica em tests/ui-baseline.json
// e só pode DIMINUIR: valor novo fora da escala quebra a suíte; ao corrigir, rode `npm run ui:baseline`.
//   node tests/helpers/ui-escalas.js            → mostra a situação atual
//   node tests/helpers/ui-escalas.js --gravar   → grava o novo limite (só depois de corrigir valores)

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE = path.join(__dirname, '..', 'ui-baseline.json');

const ESCALAS = {
  fonte: [12, 14, 16, 20, 28, 32],   // px
  raio: [0, 8, 12, 16, 24],          // px (≥ 99px conta como "pílula")
  duracao: [150, 200, 250]           // ms
};

function numeros(valor, re) {
  const out = [];
  let m;
  while ((m = re.exec(valor))) out.push(parseFloat(m[1]));
  return out;
}

function auditar(src) {
  const r = { fonte: [], raio: [], duracao: [], infinitas: 0 };
  let m;
  const reFonte = /font-size\s*:\s*([^;}"'`]+)/g;
  while ((m = reFonte.exec(src))) {
    const px = /^\s*(\d*\.?\d+)px\b/.exec(m[1]);   // var(), rem, em, clamp() não entram
    if (px && !ESCALAS.fonte.includes(parseFloat(px[1]))) r.fonte.push(parseFloat(px[1]));
  }
  const reRaio = /border-radius\s*:\s*([^;}"'`]+)/g;
  while ((m = reRaio.exec(src))) {
    numeros(m[1], /(\d*\.?\d+)px\b/g).forEach((v) => {
      if (v < 99 && !ESCALAS.raio.includes(v)) r.raio.push(v);
    });
  }
  const reTrans = /(?:^|[\s;{"'])transition\s*:\s*([^;}"'`]+)/g;
  while ((m = reTrans.exec(src))) {
    m[1].split(/,(?![^()]*\))/).forEach((seg) => {
      const t = /(\d*\.?\d+)(ms|s)\b/.exec(seg);
      if (!t) return;
      const ms = Math.round(parseFloat(t[1]) * (t[2] === 's' ? 1000 : 1));
      if (ms > 0 && !ESCALAS.duracao.includes(ms)) r.duracao.push(ms);
    });
  }
  r.infinitas = (src.match(/animation[^;}"'`]*\binfinite\b/g) || []).length;
  return r;
}

function telas() {
  return fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort();
}

function situacao() {
  const out = {};
  telas().forEach((f) => {
    const a = auditar(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    out[f] = { fonte: a.fonte.length, raio: a.raio.length, duracao: a.duracao.length, infinitas: a.infinitas };
  });
  return out;
}

function lerBaseline() {
  try { return JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch (e) { return {}; }
}

module.exports = { ESCALAS, auditar, telas, situacao, lerBaseline, BASELINE, ROOT };

if (require.main === module) {
  const atual = situacao();
  if (process.argv.includes('--gravar')) {
    fs.writeFileSync(BASELINE, JSON.stringify(atual, null, 2) + '\n');
    console.log('Limite gravado em tests/ui-baseline.json');
  }
  console.table(atual);
}
