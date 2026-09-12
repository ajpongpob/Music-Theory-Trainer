'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const source=read('src/domain/notation/notation-beaming.js');
assert(!/supabase|fetch\s*\(|XMLHttpRequest|WebSocket|MAJOR_SCALE_NOTATION|LEVEL_KEYS|STAGE_[1-4]/i.test(source),'beaming module must stay backend/exercise agnostic');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'notation-beaming.js'});
const api=ctx.window.MajorScaleApp.notationBeaming;
assert(api&&Object.isFrozen(api));

assert.equal(api.getBeamLevel({rhythm:'eighth'}),1);
assert.equal(api.getBeamLevel({rhythm:'sixteenth'}),2);
assert.equal(api.getBeamLevel({rhythm:'quarter'}),0);
assert.equal(api.getBeamDirection([{n:{stem:'auto'}},{n:{stem:'up'}}]),'up');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.beamGroupSignatures([{beamGroup:'a'},{beamGroup:'a'},null,{beamGroup:'b'}]))),['0-1','3']);

const notes=[
  {id:'a',rhythm:'eighth',beamGroup:'g'},
  {id:'b',rhythm:'eighth',beamGroup:'g'},
  {id:'c',rhythm:'quarter',beamGroup:'g'},
  {id:'d',rhythm:'sixteenth',beamGroup:'g'},
  {id:'e',rhythm:'sixteenth',beamGroup:'g'}
];
let serial=0;
api.normalizeBeamGroups(notes,{newGroupId:()=>`new-${++serial}`,measureOfIndex:i=>0});
assert.equal(notes[0].beamGroup,'g');
assert.equal(notes[1].beamGroup,'g');
assert.equal(notes[2].beamGroup,null);
assert.equal(notes[3].beamGroup,'new-1');
assert.equal(notes[4].beamGroup,'new-1');

assert.deepStrictEqual(JSON.parse(JSON.stringify(api.validateBeamSelection([0,1],[{rhythm:'eighth'},{rhythm:'sixteenth'}],i=>0))),{ok:true,reason:null});
assert.equal(api.validateBeamSelection([0],[{rhythm:'eighth'}],i=>0).reason,'minimum');
assert.equal(api.validateBeamSelection([0,2],[{rhythm:'eighth'},null,{rhythm:'eighth'}],i=>0).reason,'contiguous');
assert.equal(api.validateBeamSelection([0,1],[{rhythm:'eighth'},{rhythm:'quarter'}],i=>0).reason,'rhythm');
assert.equal(api.validateBeamSelection([0,1],[{rhythm:'eighth'},{rhythm:'eighth'}],i=>i).reason,'measure');

const appended=[];
const svg={appendChild:n=>appended.push(n)};
const createSvgElement=(tag,attrs)=>({tag,attrs});
const drawOptions={stepToY:s=>200-s*5,pitchToStep:(l,o)=>l==='C'?0:1,createSvgElement};
const up=[
  {id:'a',letter:'C',octave:4,rhythm:'eighth',stem:'up',beamGroup:'g'},
  {id:'b',letter:'D',octave:4,rhythm:'sixteenth',stem:'up',beamGroup:'g'}
];
api.drawBeams(svg,up,[100,160],drawOptions);
let polygons=appended.filter(n=>n.tag==='polygon');
assert.equal(polygons.length,2,'primary + terminal secondary hook');
let hookXs=polygons[1].attrs.points.split(' ').slice(0,2).map(p=>Number(p.split(',')[0]));
assert.deepStrictEqual(hookXs,[158,170],'terminal 16th hook points inward left toward previous note');

appended.length=0;
api.drawBeams(svg,up.map(n=>({...n,stem:'down'})),[100,160],drawOptions);
polygons=appended.filter(n=>n.tag==='polygon');
hookXs=polygons[1].attrs.points.split(' ').slice(0,2).map(p=>Number(p.split(',')[0]));
assert.deepStrictEqual(hookXs,[138,150],'terminal hook remains inward for down stems');

appended.length=0;
const initial=[
  {id:'a',letter:'C',octave:4,rhythm:'sixteenth',stem:'up',beamGroup:'g'},
  {id:'b',letter:'D',octave:4,rhythm:'eighth',stem:'up',beamGroup:'g'}
];
api.drawBeams(svg,initial,[100,160],drawOptions);
polygons=appended.filter(n=>n.tag==='polygon');
hookXs=polygons[1].attrs.points.split(' ').slice(0,2).map(p=>Number(p.split(',')[0]));
assert.deepStrictEqual(hookXs,[110,122],'initial 16th hook points inward right toward successor');

const mutable=[
  {id:'a',rhythm:'eighth',beamGroup:null,stem:'up'},
  {id:'b',rhythm:'sixteenth',beamGroup:null,stem:'up'},
  {id:'c',rhythm:'eighth',beamGroup:'old',stem:'down'}
];
api.applyBeamGroup(mutable,[0,1],'new','down');
assert.equal(mutable[0].beamGroup,'new');assert.equal(mutable[1].stem,'down');
api.clearSelectedBeamGroups(mutable,new Set(['a']));
assert.equal(mutable[0].beamGroup,null);assert.equal(mutable[1].beamGroup,null);assert.equal(mutable[2].beamGroup,'old');

const trainer=read('src/trainer.js');
for(const token of ['notationBeaming.drawBeams(','notationBeaming.normalizeBeamGroups(','notationBeaming.validateBeamSelection(','notationBeaming.beamGroupSignatures(']){
  assert(trainer.includes(token),'Trainer delegates '+token);
}
console.log('PASS notation beaming: levels, direction, normalization, validation, beam/unbeam actions, signatures and secondary-hook geometry');
