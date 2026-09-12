'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html');

assert(html.includes('Major Scale Notation Trainer — v0.8.0-a'), 'document title version must be v0.8.0-a');
assert(html.includes('<span class="pill">v0.8.0-a</span>'), 'visible version pill must be v0.8.0-a');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
assert.deepStrictEqual([...new Set(duplicateIds)], [], `duplicate DOM ids: ${[...new Set(duplicateIds)].join(', ')}`);

const localAssets = [];
for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
  if (m[1].startsWith('./')) localAssets.push(m[1]);
}
for (const m of html.matchAll(/<link[^>]+href="([^"]+)"/g)) {
  if (m[1].startsWith('./')) localAssets.push(m[1]);
}
assert(localAssets.length > 0, 'local assets should be discovered');
for (const asset of localAssets) {
  const target = path.join(ROOT, asset.replace(/^\.\//, ''));
  assert(fs.existsSync(target), `missing local asset: ${asset}`);
}

const sourceFiles = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile() && ent.name.endsWith('.js')) sourceFiles.push(full);
  }
}
walk(path.join(ROOT, 'src'));

const idSet = new Set(ids);
const missingRefs = new Set();
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const re of [
    /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\$\(\s*['"]([^'"]+)['"]\s*\)/g
  ]) {
    for (const m of source.matchAll(re)) {
      if (!idSet.has(m[1])) missingRefs.add(m[1]);
    }
  }
}
assert.deepStrictEqual([...missingRefs], [], `literal DOM references missing from HTML: ${[...missingRefs].join(', ')}`);

const runtimeText = [html, read('styles/app.css'), ...sourceFiles.map(f => fs.readFileSync(f,'utf8'))].join('\n');
assert(!/service_role/i.test(runtimeText), 'frontend runtime must not contain service_role');

console.log(`PASS package static integrity (${ids.length} DOM ids, ${localAssets.length} local assets)`);
