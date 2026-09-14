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
const restoreRegisterAuthTheme=require('./helpers/restore-register-auth-theme.cjs');

function restoreApprovedDeltas(source,file){
  source=restoreRegisterAuthTheme(source,file);
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

// Protected infrastructure/UI/config files may change when a dedicated
// contract test explicitly covers that surface. Renderer, notation domain,
// interaction and Trainer orchestration boundaries remain frozen below.
const intentionalDataBoundaryChanges=new Set([
  'src/auth-dashboard.js',                 // Google OAuth UI; covered by google-auth-contract
  'src/data/auth.repository.js',           // Google OAuth repository adapter; covered by google-auth-contract
  'src/data/practice.repository.js',       // v0.9.3 trusted server scoring
  'src/data/supabase-client.js',           // v0.9.3 publishable client setup
  'src/data/dashboard.repository.js',      // Dashboard presentation/read-model add-ons
  'src/dashboard/teacher-dashboard.js',    // Teacher Dashboard V2 UI/data orchestration
  'src/exercises/major-scale/major-scale.config.js', // approved 30/40/10/10/10 scoring weights; covered by Major Scale domain/scoring regression
  'src/keyboard.js'                        // completion mastery presentation + additive UI loaders; keyboard/notation behavior has dedicated regression coverage
]);
for(const [file,hash] of Object.entries(boundary.protectedProduction)){
  if(intentionalDataBoundaryChanges.has(file)) continue;
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
console.log('PASS notation boundary: exact v0.8.0-c reconstruction, approved scoring/UI deltas with dedicated regression coverage, protected notation/interaction hashes and script order');
