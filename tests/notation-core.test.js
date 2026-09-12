'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const golden=JSON.parse(read('tests/fixtures/notation-v080c-golden.json'));
const trainer=read('src/trainer.js');
const span=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b));
const ctx={window:{}};vm.createContext(ctx);
let api;
if(process.env.NOTATION_BASELINE==='1'){
  // Characterization mode is used before extraction; normal runs require the real core.
  const domain=read('src/exercises/major-scale/major-scale.domain.js');
  const line=name=>trainer.split('\n').find(s=>s.startsWith('function '+name+'('));
  const rhythm=trainer.match(/const rhythm=(\{"1"[^\n]+);/)[1];
  const accidental=trainer.match(/const accidental=(\{"\."[^\n]+);/)[1];
  vm.runInContext('const LETTERS=["C","D","E","F","G","A","B"],MIN_STAFF_STEP=-14,MAX_STAFF_STEP=20;\n'+
    ['pitchToStep','stepToPitch','musicEm','sp'].map(line).join('\n')+'\n'+
    span(trainer,'function clampStaffStep(','function noteheadHalfWidthForRhythm(')+
    span(domain,'function accidentalOffset(','function notePc(')+
    `function rhythmFromShortcut(key){return ${rhythm};}\nfunction accidentalFromShortcut(key){return ${accidental};}`,ctx);
  api={...ctx};
}else{
  const source=read('src/domain/notation/notation-core.js');
  assert(!/\bdocument\b|\bsupabase\b|\bfetch\s*\(|XMLHttpRequest|WebSocket|\beval\s*\(|new Function|import\s*\(|MAJOR_SCALE_NOTATION|LEVEL_KEYS|STAGE_[1-4]/i.test(source));
  vm.runInContext(source,ctx,{filename:'notation-core.js'});
  api=ctx.window.MajorScaleApp.notationCore;
  assert(api && Object.isFrozen(api),'namespace API is immutable');
  assert.deepStrictEqual(Object.keys(ctx.window),['MajorScaleApp']);
  assert.deepStrictEqual(Object.keys(ctx.window.MajorScaleApp),['notationCore']);
  assert.equal(Reflect.set(api,'pitchToStep',()=>999),false);
}
const plain=value=>JSON.parse(JSON.stringify(value));
for(const [letter,octave,step] of [['C',4,-2],['D',4,-1],['B',4,4],['C',5,5],['E',2,-14],['D',7,20]]){
  assert.equal(api.pitchToStep(letter,octave),step);
  assert.deepStrictEqual(plain(api.stepToPitch(step)),{letter,octave});
}
for(const f of golden.pitch)assert.equal(api.pitchToStep(f.letter,f.octave),f.value);
for(const f of golden.step)assert.deepStrictEqual(plain(api.stepToPitch(f.step)),f.value);
for(const f of golden.clamp)assert.equal(api.clampStaffStep(f.step,-14,20),f.value);
for(const f of golden.accidentals){
  if(f.error){
    assert.throws(()=>api.accidentalOffset(f.symbol),e=>e.name===f.error.name && e.message===f.error.message);
  }else assert.equal(api.accidentalOffset(f.symbol),f.value);
}
for(const [fixtures,fn] of [[golden.rhythms,api.rhythmFromShortcut],[golden.shortcuts,api.accidentalFromShortcut]]){
  for(const f of fixtures)assert.strictEqual(fn(f.key),f.undefined?undefined:f.value);
}
for(const f of golden.units){
  const staff=Object.freeze({spacing:f.spacing});
  assert.equal(api.musicEm(staff),f.em);
  assert.equal(api.sp(staff,f.value),f.space);
  assert.equal(staff.spacing,f.spacing);
}
const returned=api.stepToPitch(0);returned.letter='X';
assert.deepStrictEqual(plain(api.stepToPitch(0)),{letter:'E',octave:4},'returns fresh pitch data');
// Execute the original, unchanged editing method using the shared pure functions.
ctx.pitchToStep=api.pitchToStep;ctx.stepToPitch=api.stepToPitch;
ctx.clampStaffStep=step=>api.clampStaffStep(step,-14,20);
vm.runInContext(span(trainer,'function moveSelectedPitch(','function moveSelection(')+'\nvar state;var renderCount=0;function render(){renderCount++;}',ctx);
for(const f of golden.movement){
  ctx.state={notes:[f.withNote?{...api.stepToPitch(f.step),accidental:'##',rhythm:'quarter'}:null],cursorIndex:0,cursorStaffStep:f.step,selectionIsExplicit:false};
  ctx.renderCount=0;ctx.moveSelectedPitch(f.delta);
  assert.deepStrictEqual(plain(ctx.state),f.value,'movement baseline equivalence');
  assert.equal(ctx.renderCount,f.renderCount);
}
console.log('PASS notation core: namespace, 63 pitches, 50 steps, 11 clamps, 12 accidental cases, 21 value/shortcut cases, 20 unit cases, 80 movement cases and side effects');
