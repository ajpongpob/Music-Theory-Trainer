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
const restoreV090=require('./helpers/restore-v090-master-core.cjs');
const restoreV091=require('./helpers/restore-v091-path-stage.cjs');
const restoreV092=require('./helpers/restore-v092-scoring-policy.cjs');
const restoreBeaming=require('./helpers/restore-notation-beaming.cjs');
const restoreMobileSafariUi=require('./helpers/restore-mobile-safari-ui.cjs');

function restoreApprovedDeltas(source,file){
  source=restoreMobileSafariUi(source,file);
  source=restoreV092(source,file);
  source=restoreV091(source,file);
  source=restoreV090(source,file);
  source=restoreBeaming(source,file);
  source=restoreInteraction(source,file);
  source=restoreLayout(source,file);
  source=restoreNarrow(source,file);
  source=restoreFeedback(source,file);
  source=restoreNote(source,file);
  source=restoreStatic(source,file);
  source=restoreRenderer(source,file);
  return source;
}

for(const file of Object.keys(boundary.files)){
  restore(restoreApprovedDeltas(read(file),file),file);
}

// v0.9.3 intentionally changes only these protected data-infrastructure files
// to move scoring authority out of the browser. They are covered by dedicated
// repository/security contract tests instead of being falsely treated as a
// notation regression. Every renderer, interaction, exercise and keyboard
// protected hash remains frozen here.
const intentionalV093DataBoundaryChanges=new Set([
  'src/data/practice.repository.js',
  'src/data/supabase-client.js'
]);
for(const [file,hash] of Object.entries(boundary.protectedProduction)){
  if(intentionalV093DataBoundaryChanges.has(file)) continue;
  const source=restoreApprovedDeltas(read(file),file);
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
assert(at('src/domain/notation/notation-interaction.js')<at('src/domain/notation/notation-beaming.js'));
assert(at('src/domain/notation/notation-beaming.js')<at('src/exercises/major-scale/major-scale.domain.js'));
assert(at('src/domain/notation/notation-beaming.js')<at('src/trainer.js'));
assert(at('src/trainer.js')<at('src/keyboard.js'));
console.log('PASS notation boundary: exact v0.8.0-c reconstruction, approved v0.9.2 scoring delta, v0.9.3 data-layer exception, exact mobile Safari UI delta, protected notation/interaction hashes and script order');
