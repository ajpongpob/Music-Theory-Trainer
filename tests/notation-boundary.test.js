'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const boundary=JSON.parse(read('tests/fixtures/notation-extraction-boundary.json'));
const restore=require('./helpers/restore-notation-baseline.cjs');
const restoreRenderer=require('./helpers/restore-renderer-foundation.cjs');
const restoreStatic=require('./helpers/restore-renderer-static-signatures.cjs');
const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');
const restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');
const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');
const restoreLayout=require('./helpers/restore-renderer-score-layout.cjs');
const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');
for(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreLayout(restoreInteraction(read(file),file),file),file),file),file),file),file),file);
for(const [file,hash] of Object.entries(boundary.protectedProduction)){
  const source=restoreFeedback(restoreNarrow(restoreLayout(restoreInteraction(read(file),file),file),file),file);
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),hash,'protected production changed: '+file);
}
const core=read('src/domain/notation/notation-core.js');
for(const original of boundary.coreExactCopies)assert(core.includes(original),'moved helper body must stay identical');
const html=read('index.html');
const scripts=[...html.matchAll(/<script\s+src="\.\/(src\/[^\"]+\.js)"/g)].map(m=>m[1]);
assert.equal(scripts.length,new Set(scripts).size,'no duplicate script initialization');
const at=rel=>{const i=scripts.indexOf(rel);assert(i>=0,rel);return i;};
assert(at('src/domain/notation/notation-core.js')<at('src/domain/notation/notation-renderer.js'));
assert(at('src/domain/notation/notation-renderer.js')<at('src/domain/notation/notation-interaction.js'));
assert(at('src/domain/notation/notation-interaction.js')<at('src/exercises/major-scale/major-scale.domain.js'));
assert(at('src/domain/notation/notation-interaction.js')<at('src/trainer.js'));
assert(at('src/trainer.js')<at('src/keyboard.js'));
console.log('PASS notation boundary: exact v0.8.0-c reconstruction, moved bodies, protected production hashes and script order');
