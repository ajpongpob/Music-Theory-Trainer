'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const golden=JSON.parse(read('tests/fixtures/major-scale-v080b-golden.json'));
const trainer=read('src/trainer.js');
const ctx={window:{}};vm.createContext(ctx);
vm.runInContext(read('src/domain/notation/notation-core.js'),ctx);
for(const file of ['major-scale.config.js','major-scale.domain.js']){
  const source=read('src/exercises/major-scale/'+file);
  assert(!/\bdocument\b|\bsupabase\b|\bfetch\s*\(|\beval\s*\(|new Function|import\s*\(/i.test(source),'pure module must not access UI/backend or dynamic code');
  vm.runInContext(source,ctx,{filename:file});
}
const moduleApi=ctx.window.MajorScaleApp.majorScaleDomain;
assert(moduleApi && Object.isFrozen(moduleApi));
assert.deepStrictEqual(Object.keys(ctx.window),['MajorScaleApp'],'reuse the existing namespace');
const config=ctx.window.MajorScaleApp.majorScaleConfig;
assert.equal(config.exerciseCode,'MAJOR_SCALE_NOTATION');
assert.deepStrictEqual(plain(config.LEVEL_KEYS),{
  1:['C','F','Bb','G','D'],2:['A','E','B','Eb','Ab','Db'],
  3:['Gb','Cb','F#','C#','G#','Fb','D#','Bbb'],
  4:['A#','Ebb','E#','Abb','B#','Dbb','F##','Gbb','C##','Cbb']
});
// Use precisely the unchanged legacy notation helper bodies, not alternate musical rules.
const slice=(a,b)=>trainer.slice(trainer.indexOf(a),trainer.indexOf(b));
const helpers=slice('function autoStem(','/* Fixed 3-measure pattern:')+
  slice('function pitchToStep(','function stepToPitch(')+
  slice('function effectiveStem(','function check(){');
vm.runInContext('const notationCore=window.MajorScaleApp.notationCore;\nconst LETTERS=["C","D","E","F","G","A","B"];\n'+helpers+
  '\nwindow.rules=window.MajorScaleApp.majorScaleDomain.createRules({autoStem,beamStemDirectionFromNotes,pitchToStep,effectiveStem,beamGroupSignatures});',ctx);
const rules=ctx.window.rules;
for(const fixture of golden.scales){
  assert.deepStrictEqual(plain(moduleApi.buildMajorScale(fixture.key)),fixture.scale,'spelling: '+fixture.key.tonic);
  assert.deepStrictEqual(plain(rules.buildExpected(fixture.key)),fixture.expected,'expected answer: '+fixture.key.tonic);
}
for(const fixture of golden.evaluations){
  const key=golden.scales.find(item=>item.key.tonic===fixture.tonic).key;
  const before=JSON.stringify(fixture.notes),expected=rules.buildExpected(key);
  assert.deepStrictEqual(plain(rules.evaluateAnswer(expected,fixture.notes)),fixture.result,fixture.tonic+' '+fixture.variant);
  assert.equal(JSON.stringify(fixture.notes),before,'evaluation must not mutate response');
}
for(const sequence of golden.generations){
  let bag=[],previousTonic=sequence.previousTonic;
  for(const expected of sequence.outputs){
    const before=JSON.stringify(bag);
    const actual=moduleApi.takeNextQuestion({level:sequence.level,sessionBag:bag,masteryPriorityItemCodes:sequence.priority,previousTonic},()=>sequence.random);
    assert.equal(JSON.stringify(bag),before,'generator must not mutate caller bag');
    assert.deepStrictEqual(plain({key:actual.key,bag:actual.bag}),expected,'baseline question sequence');
    assert.equal(actual.priority,sequence.priority.length>0);
    bag=actual.bag;previousTonic=actual.key.tonic;
  }
}
// Invert only the explicitly recorded extraction edits; every other byte must equal b.
const boundary=JSON.parse(read('tests/fixtures/trainer-extraction-boundary.json'));
const restoreRenderer=require('./helpers/restore-renderer-foundation.cjs');
const restoreStatic=require('./helpers/restore-renderer-static-signatures.cjs');
const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');
const restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');
const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');
const restoreLayout=require('./helpers/restore-renderer-score-layout.cjs');
let restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreLayout(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');
for(const {before,after,offset} of [...boundary.substitutions].reverse()){
  assert.equal(restored.slice(offset,offset+after.length),after,'extraction wrapper changed unexpectedly');
  restored=restored.slice(0,offset)+before+restored.slice(offset+after.length);
}
assert.equal(crypto.createHash('sha256').update(restored).digest('hex'),boundary.baselineSha256,'notation/controller outside extraction must be byte-identical to corrected b');
console.log(`PASS Major Scale domain: ${golden.scales.length} spellings/expected answers, ${golden.evaluations.length} golden evaluations, ${golden.generations.length} deterministic sequences; stage config and exact legacy boundary`);
