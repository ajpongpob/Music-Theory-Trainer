'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const read=p=>fs.readFileSync(p,'utf8');
const ctx={window:{},console};vm.createContext(ctx);
vm.runInContext(read('src/domain/notation/notation-core.js'),ctx,{filename:'notation-core.js'});
vm.runInContext(read('src/exercises/major-scale/major-scale.config.js'),ctx,{filename:'major-scale.config.js'});
vm.runInContext(read('src/exercises/major-scale/major-scale.domain.js'),ctx,{filename:'major-scale.domain.js'});

const LETTERS=['C','D','E','F','G','A','B'];
const pitchToStep=(letter,octave)=>octave*7+LETTERS.indexOf(letter)-(4*7+LETTERS.indexOf('E'));
const autoStem=(letter,octave)=>{
  const diatonic=octave*7+LETTERS.indexOf(letter),b4=4*7+LETTERS.indexOf('B');
  return diatonic>=b4?'down':'up';
};
const beamStemDirectionFromNotes=notes=>{
  const steps=notes.filter(Boolean).map(n=>pitchToStep(n.letter,n.octave));
  if(!steps.length)return 'down';
  const middle=4;
  if(steps.length===1)return steps[0]>=middle?'down':'up';
  const farthestDirection=()=>{
    const above=Math.max(0,...steps.map(s=>Math.max(0,s-middle)));
    const below=Math.max(0,...steps.map(s=>Math.max(0,middle-s)));
    if(above>below)return 'down';
    if(below>above)return 'up';
    return 'down';
  };
  if(steps.length===2)return farthestDirection();
  const onOrAbove=steps.filter(s=>s>=middle).length;
  const below=steps.filter(s=>s<middle).length;
  if(onOrAbove>below)return 'down';
  if(below>onOrAbove)return 'up';
  return farthestDirection();
};
const effectiveStem=n=>n?.stem || null;
const beamGroupSignatures=notes=>{
  const groups=new Map();
  notes.forEach((n,i)=>{if(n?.beamGroup!==null&&n?.beamGroup!==undefined){const k=String(n.beamGroup);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}});
  return [...groups.values()].map(indices=>indices.sort((a,b)=>a-b).join('-')).sort();
};

const app=ctx.window.MajorScaleApp;
const rules=app.majorScaleDomain.createRules({autoStem,beamStemDirectionFromNotes,pitchToStep,effectiveStem,beamGroupSignatures});
const clone=value=>JSON.parse(JSON.stringify(value));

// Every configured Major scale must keep full BN01 credit when moved to another octave.
for(const key of app.majorScaleConfig.KEYS){
  const expected=rules.buildExpected(key);
  for(const shift of [-2,-1,1,2]){
    const actual=clone(expected).map(n=>({...n,octave:n.octave+shift}));
    const result=rules.evaluateAnswer(expected,actual);
    assert.equal(result.lo.BN01_TREBLE_PITCH.score,100,`${key.tonic}: octave shift ${shift} must not reduce pitch-name score`);
    assert(result.lo.BN01_TREBLE_PITCH.flags.every(Boolean),`${key.tonic}: every pitch-name flag must ignore octave`);
  }
}

// A wrong letter must still be wrong even if octave is otherwise arbitrary.
{
  const key=app.majorScaleConfig.KEYS.find(k=>k.tonic==='C');
  const expected=rules.buildExpected(key);
  const actual=clone(expected);
  actual[3].letter='G';
  actual[3].octave+=2;
  const result=rules.evaluateAnswer(expected,actual);
  assert.equal(result.lo.BN01_TREBLE_PITCH.flags[3],false,'wrong pitch letter must still fail');
}

// Reproduce the reported B-major case: write the entire correct scale one octave lower.
// Stems are recalculated from the positions actually written by the learner.
{
  const key=app.majorScaleConfig.KEYS.find(k=>k.tonic==='B');
  const expected=rules.buildExpected(key);
  const actual=clone(expected).map(n=>({...n,octave:n.octave-1}));
  [0,7].forEach(i=>{actual[i].stem=autoStem(actual[i].letter,actual[i].octave);});
  [[1,2],[3,4,5,6],[8,9],[10,11,12,13]].forEach(group=>{
    const dir=beamStemDirectionFromNotes(group.map(i=>actual[i]));
    group.forEach(i=>{actual[i].stem=dir;});
  });
  const result=rules.evaluateAnswer(expected,actual);
  assert.equal(result.lo.BN01_TREBLE_PITCH.score,100,'B major in another octave must receive full pitch credit');
  assert.equal(result.lo.BN06_STEM_DIRECTION.score,100,'stems must be judged from the learner actual staff positions');
  assert.equal(result.lo.RH01_DURATION_VALUE.score,100);
  assert.equal(result.lo.GR02_PRIMARY_BEAM.score,100);
  assert.equal(result.lo.MS03_SCALE_ACCIDENTAL.score,100);
  assert.equal(result.score,100,'correct B major in another octave must receive 100%');
}

// B4 is the treble-staff middle line. For an independent stemmed note, both stem
// directions are valid. B major starts on B4 at note index 0.
{
  const key=app.majorScaleConfig.KEYS.find(k=>k.tonic==='B');
  const expected=rules.buildExpected(key);
  assert.equal(pitchToStep(expected[0].letter,expected[0].octave),4,'B-major first note must be B4 middle line');
  for(const stem of ['up','down']){
    const actual=clone(expected);
    actual[0].stem=stem;
    const result=rules.evaluateAnswer(expected,actual);
    assert.equal(result.lo.BN06_STEM_DIRECTION.flags[0],true,`B4 stem ${stem} must be accepted`);
    assert.equal(result.lo.BN06_STEM_DIRECTION.score,100,`B4 stem ${stem} must preserve full stem score`);
    assert.equal(result.score,100,`B4 stem ${stem} must preserve full answer score`);
  }
}

console.log('PASS pitch/stem rules: all 29 scales octave-independent; B-major octave shift = 100%; B4 stem up/down accepted');
