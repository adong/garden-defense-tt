#!/usr/bin/env node
/* TT Garden Defense: run the rules check in node.  node tools/check.js  [--fail]  [--quick]
   --fail breaks every rule on purpose: then every check must FAIL (and this exits 1), which proves the checks can fail. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
global.window = global;
for (const f of ['units', 'levels', 'sim', 'bot', 'check']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
}
const fail = process.argv.includes('--fail'), quick = process.argv.includes('--quick');
const t0 = Date.now();
const out = GD.check({ fail, quick });
for (const r of out.results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  for (const b of r.bad) console.log(`        ${b}`);
  if (r.more) console.log(`        ...and ${r.more} more`);
  if (process.argv.includes('-v')) for (const i of r.info) console.log(`      · ${i}`);
}
console.log(`${out.ok ? 'ALL PASS' : 'SOME FAIL'}${fail ? ' (sabotaged on purpose: every check should FAIL)' : ''} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (fail) {
  const caught = out.results.filter((r) => !r.ok).length;
  console.log(`${caught} of ${out.results.length} checks caught their sabotage${caught === out.results.length ? '' : '  <-- a check that cannot fail!'}`);
}
process.exit(out.ok ? 0 : 1);
