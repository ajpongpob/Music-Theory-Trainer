'use strict';
const fs=require('fs');
const assert=require('assert');
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function replaceExact(source,before,after,label){
  const i=source.indexOf(before);
  assert(i>=0,'missing block: '+label);
  assert.equal(source.indexOf(before,i+1),-1,'duplicate block: '+label);
  return source.slice(0,i)+after+source.slice(i+before.length);
}

const beaming=`(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp || {};

function getBeamDirection(items){
  const manual=items.find(({n})=>n.stem==='up' || n.stem==='down');
  if(manual) return manual.n.stem;
  const first=items[0].n;
  return first.stem || 'up';
}

function getBeamLevel(note){
  if(!note) return 0;
  if(note.rhythm==='sixteenth') return 2;
  if(note.rhythm==='eighth') return 1;
  return 0;
}

function buildBeamSegments(items){
  const segments=[];
  let current=[];
  items.forEach(item=>{
    if(getBeamLevel(item.n)>0){
      current.push(item);
    }else{
      if(current.length) segments.push(current);
      current=[];
    }
  });
  if(current.length) segments.push(current);
  return segments;
}

function beamGroupSignatures(notes){
  const groups=new Map();
  notes.forEach((n,i)=>{
    if(!n || !n.beamGroup) return;
    if(!groups.has(n.beamGroup)) groups.set(n.beamGroup,[]);
    groups.get(n.beamGroup).push(i);
  });
  return [...groups.values()]
    .map(indices=>indices.sort((a,b)=>a-b).join('-'))
    .sort();
}

function normalizeBeamGroups(notes,options){
  const groups=new Map();
  const measureOfIndex=options.measureOfIndex;
  notes.forEach((n,i)=>{
    if(n && n.beamGroup!=null){
      if(!groups.has(n.beamGroup)) groups.set(n.beamGroup,[]);
      groups.get(n.beamGroup).push(i);
    }
  });
  groups.forEach(indices=>{
    indices.sort((a,b)=>a-b);
    const runs=[];
    let run=[];
    const flush=()=>{ if(run.length) runs.push(run); run=[]; };
    indices.forEach(i=>{
      const n=notes[i];
      const beamable=!!n && ['eighth','sixteenth'].includes(n.rhythm);
      const sameMeasure=run.length===0 || measureOfIndex(i)===measureOfIndex(run[0]);
      const contiguous=run.length===0 || i===run[run.length-1]+1;
      if(!beamable){
        if(n) n.beamGroup=null;
        flush();
        return;
      }
      if(!sameMeasure || !contiguous) flush();
      run.push(i);
    });
    flush();
    runs.forEach((indicesInRun,runIndex)=>{
      if(indicesInRun.length<2){
        indicesInRun.forEach(i=>{ if(notes[i]) notes[i].beamGroup=null; });
        return;
      }
      const gid=runIndex===0 ? notes[indicesInRun[0]].beamGroup : options.newGroupId();
      indicesInRun.forEach(i=>{ notes[i].beamGroup=gid; });
    });
  });
}

function validateBeamSelection(indices,notes,measureOfIndex){
  if(indices.length<2) return {ok:false,reason:'minimum'};
  if(indices.some((v,i)=>i>0&&v!==indices[i-1]+1)) return {ok:false,reason:'contiguous'};
  if(indices.some(i=>!['eighth','sixteenth'].includes(notes[i].rhythm))) return {ok:false,reason:'rhythm'};
  if(indices.some(i=>measureOfIndex(i)!==measureOfIndex(indices[0]))) return {ok:false,reason:'measure'};
  return {ok:true,reason:null};
}

function applyBeamGroup(notes,indices,gid,direction){
  indices.forEach(i=>{notes[i].beamGroup=gid;notes[i].stem=direction;});
}

function clearSelectedBeamGroups(notes,selectedIds){
  const groups=new Set(notes.filter(n=>n && selectedIds.has(n.id) && n.beamGroup!=null).map(n=>n.beamGroup));
  notes.forEach(n=>{if(n && groups.has(n.beamGroup)) n.beamGroup=null;});
}

function drawBeams(svg,notesState,positions,options){
  const groups={};
  notesState.forEach((n,i)=>{
    if(n && n.beamGroup){
      (groups[n.beamGroup] ||= []).push({n,i});
    }
  });
  Object.values(groups).forEach(items=>{
    items.sort((a,b)=>a.i-b.i);
    items=items.filter(({n})=>['eighth','sixteenth'].includes(n.rhythm));
    if(items.length<2)return;
    const dir=getBeamDirection(items);
    const notes=items.map(({n,i})=>{
      const y=options.stepToY(options.pitchToStep(n.letter,n.octave));
      return {n,i,x:positions[i]+(dir==='up'?10:-10),y,level:getBeamLevel(n)};
    });
    const beamY=dir==='up'
      ? Math.min(...notes.map(p=>p.y-55))
      : Math.max(...notes.map(p=>p.y+55));
    notes.forEach(p=>{
      svg.appendChild(options.createSvgElement('line',{
        x1:p.x,y1:p.y,x2:p.x,y2:beamY,stroke:'#111','stroke-width':2.3
      }));
    });
    const first=notes[0],last=notes[notes.length-1];
    svg.appendChild(options.createSvgElement('polygon',{
      points:`${first.x},${beamY} ${last.x},${beamY} ${last.x},${beamY+(dir==='up'?8:-8)} ${first.x},${beamY+(dir==='up'?8:-8)}`,
      fill:'#111'
    }));
    const secondaryY=beamY+(dir==='up'?10:-10);
    const thickness=8;
    function drawSecondaryBeam(x1,x2){
      svg.appendChild(options.createSvgElement('polygon',{
        points:`${x1},${secondaryY} ${x2},${secondaryY} ${x2},${secondaryY+(dir==='up'?thickness:-thickness)} ${x1},${secondaryY+(dir==='up'?thickness:-thickness)}`,
        fill:'#111'
      }));
    }
    notes.forEach((p,index)=>{
      if(p.level!==2)return;
      const prev=notes[index-1];
      const next=notes[index+1];
      const prevSixteenth=prev && prev.level===2;
      const nextSixteenth=next && next.level===2;
      if(nextSixteenth){ drawSecondaryBeam(p.x,next.x); return; }
      if(prevSixteenth)return;
      if(prev && prev.level>=1){ drawSecondaryBeam(p.x-12,p.x); return; }
      if(next && next.level>=1){ drawSecondaryBeam(p.x,p.x+12); }
    });
  });
}

app.notationBeaming=Object.freeze({
  getBeamDirection,
  getBeamLevel,
  buildBeamSegments,
  beamGroupSignatures,
  normalizeBeamGroups,
  validateBeamSelection,
  applyBeamGroup,
  clearSelectedBeamGroups,
  drawBeams
});
})();
`;
write('src/domain/notation/notation-beaming.js',beaming);

let interaction=read('src/domain/notation/notation-interaction.js');
interaction=replaceExact(interaction,
`function eventPointInSvg(svg,ev){`,
`function dragDeltaSteps(startY,currentY,staffSpacing){
  return Math.round((startY-currentY)/(staffSpacing/2));
}

function rangeGestureCompletion(interaction,mobileRangeAnchorIndex){
  const completedByDrag=interaction.moved;
  const completedBySecondTap=mobileRangeAnchorIndex>=0 && interaction.rangeLastIndex!==mobileRangeAnchorIndex;
  return {completedByDrag,completedBySecondTap,complete:completedByDrag || completedBySecondTap};
}

function resetPointerInteraction(interaction){
  interaction.active=false;
  interaction.pointerId=null;
  interaction.noteId=null;
  interaction.noteIndex=-1;
  interaction.moved=false;
  interaction.dragSelectionPrepared=false;
  interaction.mode='note';
  interaction.rangeAnchorIndex=-1;
  interaction.rangeLastIndex=-1;
  return interaction;
}

function eventPointInSvg(svg,ev){`,
'interaction helpers');
interaction=replaceExact(interaction,
`  selectedNoteIdsInRange,
  eventPointInSvg,`,
`  selectedNoteIdsInRange,
  dragDeltaSteps,
  rangeGestureCompletion,
  resetPointerInteraction,
  eventPointInSvg,`,
'interaction exports');
write('src/domain/notation/notation-interaction.js',interaction);

let html=read('index.html');
html=replaceExact(html,
`<script src="./src/domain/notation/notation-interaction.js"></script>`,
`<script src="./src/domain/notation/notation-interaction.js"></script>
<script src="./src/domain/notation/notation-beaming.js"></script>`,
'beaming script');
write('index.html',html);

let trainer=read('src/trainer.js');
trainer=replaceExact(trainer,
`const notationInteraction=window.MajorScaleApp.notationInteraction;
const majorScaleModule=`,
`const notationInteraction=window.MajorScaleApp.notationInteraction;
const notationBeaming=window.MajorScaleApp.notationBeaming;
const majorScaleModule=`,
'beaming binding');
trainer=replaceExact(trainer,
`  const deltaSteps=Math.round(
    (noteInteraction.startY-local.y)/(staff.spacing/2)
  );`,
`  const deltaSteps=notationInteraction.dragDeltaSteps(
    noteInteraction.startY,
    local.y,
    staff.spacing
  );`,
'drag delta');
trainer=replaceExact(trainer,
`    const completedByDrag=noteInteraction.moved;
    const completedBySecondTap=
      state.mobileRangeAnchorIndex>=0 &&
      noteInteraction.rangeLastIndex!==state.mobileRangeAnchorIndex;`,
`    const {completedByDrag,completedBySecondTap}=notationInteraction.rangeGestureCompletion(
      noteInteraction,
      state.mobileRangeAnchorIndex
    );`,
'range completion');
const resetBlock=`    noteInteraction.active=false;
    noteInteraction.pointerId=null;
    noteInteraction.noteId=null;
    noteInteraction.noteIndex=-1;
    noteInteraction.moved=false;
    noteInteraction.dragSelectionPrepared=false;
    noteInteraction.mode="note";
    noteInteraction.rangeAnchorIndex=-1;
    noteInteraction.rangeLastIndex=-1;`;
trainer=replaceExact(trainer,resetBlock,`    notationInteraction.resetPointerInteraction(noteInteraction);`,'range reset');
const resetBlock2=`  noteInteraction.active=false;
  noteInteraction.pointerId=null;
  noteInteraction.noteId=null;
  noteInteraction.noteIndex=-1;
  noteInteraction.moved=false;
  noteInteraction.dragSelectionPrepared=false;
  noteInteraction.mode="note";
  noteInteraction.rangeAnchorIndex=-1;
  noteInteraction.rangeLastIndex=-1;`;
trainer=replaceExact(trainer,resetBlock2,`  notationInteraction.resetPointerInteraction(noteInteraction);`,'note reset');
trainer=replaceExact(trainer,resetBlock2,`  notationInteraction.resetPointerInteraction(noteInteraction);`,'cancel reset');

const beamStart=trainer.indexOf('function getBeamDirection(items){');
const beamEnd=trainer.indexOf('function staffStepToPitch(step){');
assert(beamStart>=0&&beamEnd>beamStart,'beam block');
const beamWrappers=`function getBeamDirection(items){
  return notationBeaming.getBeamDirection(items);
}

function getBeamLevel(note){
  return notationBeaming.getBeamLevel(note);
}

function buildBeamSegments(items){
  return notationBeaming.buildBeamSegments(items);
}

function drawBeams(){
  return notationBeaming.drawBeams(scoreSvg,state.notes,noteXs,{
    stepToY,
    pitchToStep,
    createSvgElement:el
  });
}

`;
trainer=trainer.slice(0,beamStart)+beamWrappers+trainer.slice(beamEnd);

const normalizeStart=trainer.indexOf('function normalizeBeamGroups(){');
const normalizeEnd=trainer.indexOf('function syncToolButtons(){');
assert(normalizeStart>=0&&normalizeEnd>normalizeStart,'normalize block');
trainer=trainer.slice(0,normalizeStart)+`function normalizeBeamGroups(){
  return notationBeaming.normalizeBeamGroups(state.notes,{
    newGroupId:newBeamGroupId,
    measureOfIndex:i=>Math.floor(i/7)
  });
}

`+trainer.slice(normalizeEnd);

trainer=replaceExact(trainer,
`document.getElementById("beamSelected").onclick=()=>{
 const idx=state.notes.map((n,i)=>n&&state.selectedIds.has(n.id)?i:null).filter(i=>i!==null).sort((a,b)=>a-b);
 if(idx.length<2)return alert("เลือกอย่างน้อย 2 โน้ต: คลิกตัวแรก แล้ว Shift+Click ตัวสุดท้าย หรือใช้ปุ่ม เลือกหลายโน้ต");
 if(idx.some((v,i)=>i>0&&v!==idx[i-1]+1))return alert("กรุณาเลือกโน้ตที่อยู่ติดกัน");
 if(idx.some(i=>!["eighth","sixteenth"].includes(state.notes[i].rhythm)))return alert("Beam ได้เฉพาะ eighth/sixteenth notes");
 if(idx.some(i=>Math.floor(i/7)!==Math.floor(idx[0]/7)))return alert("เลือกโน้ตในห้องเดียวกันเพื่อ Beam");
 const gid=newBeamGroupId();
 const groupDir=effectiveStem(state.notes[idx[0]]) || autoStem(state.notes[idx[0]].letter,state.notes[idx[0]].octave);
 idx.forEach(i=>{state.notes[i].beamGroup=gid;state.notes[i].stem=groupDir;});
 normalizeBeamGroups();render();
};
document.getElementById("unbeamSelected").onclick=()=>{
  const groups=new Set(state.notes.filter(n=>n && state.selectedIds.has(n.id) && n.beamGroup!=null).map(n=>n.beamGroup));
  state.notes.forEach(n=>{if(n && groups.has(n.beamGroup)) n.beamGroup=null;});
  normalizeBeamGroups();
  render();
};`,
`document.getElementById("beamSelected").onclick=()=>{
 const idx=state.notes.map((n,i)=>n&&state.selectedIds.has(n.id)?i:null).filter(i=>i!==null).sort((a,b)=>a-b);
 const validation=notationBeaming.validateBeamSelection(idx,state.notes,i=>Math.floor(i/7));
 if(!validation.ok){
   if(validation.reason==="minimum") return alert("เลือกอย่างน้อย 2 โน้ต: คลิกตัวแรก แล้ว Shift+Click ตัวสุดท้าย หรือใช้ปุ่ม เลือกหลายโน้ต");
   if(validation.reason==="contiguous") return alert("กรุณาเลือกโน้ตที่อยู่ติดกัน");
   if(validation.reason==="rhythm") return alert("Beam ได้เฉพาะ eighth/sixteenth notes");
   if(validation.reason==="measure") return alert("เลือกโน้ตในห้องเดียวกันเพื่อ Beam");
 }
 const gid=newBeamGroupId();
 const groupDir=effectiveStem(state.notes[idx[0]]) || autoStem(state.notes[idx[0]].letter,state.notes[idx[0]].octave);
 notationBeaming.applyBeamGroup(state.notes,idx,gid,groupDir);
 normalizeBeamGroups();render();
};
document.getElementById("unbeamSelected").onclick=()=>{
  notationBeaming.clearSelectedBeamGroups(state.notes,state.selectedIds);
  normalizeBeamGroups();
  render();
};`,
'beam buttons');

trainer=replaceExact(trainer,
`function beamGroupSignatures(notes){
  const groups=new Map();

  notes.forEach((n,i)=>{
    if(!n || !n.beamGroup) return;

    if(!groups.has(n.beamGroup)){
      groups.set(n.beamGroup,[]);
    }

    groups.get(n.beamGroup).push(i);
  });

  return [...groups.values()]
    .map(indices=>indices.sort((a,b)=>a-b).join("-"))
    .sort();
}`,
`function beamGroupSignatures(notes){
  return notationBeaming.beamGroupSignatures(notes);
}`,
'beam signatures');
write('src/trainer.js',trainer);

const restoreBeam=`'use strict';
const assert=require('assert');
function replaceExact(source,after,before,label){
  const i=source.indexOf(after);
  assert(i>=0,'missing v0.8.1-d edit: '+label);
  assert.equal(source.indexOf(after,i+1),-1,'duplicate v0.8.1-d edit: '+label);
  return source.slice(0,i)+before+source.slice(i+after.length);
}
module.exports=function restoreNotationBeaming(source,file){
  if(file==='index.html') return replaceExact(source,
    '<script src="./src/domain/notation/notation-interaction.js"></script>\\n<script src="./src/domain/notation/notation-beaming.js"></script>',
    '<script src="./src/domain/notation/notation-interaction.js"></script>',
    'beaming script');
  if(file!=='src/trainer.js') return source;
  source=replaceExact(source,
    'const notationInteraction=window.MajorScaleApp.notationInteraction;\\nconst notationBeaming=window.MajorScaleApp.notationBeaming;\\nconst majorScaleModule=',
    'const notationInteraction=window.MajorScaleApp.notationInteraction;\\nconst majorScaleModule=',
    'beaming binding');
  return source;
};
`;
write('tests/helpers/restore-notation-beaming.cjs',restoreBeam);

let domainTest=read('tests/major-scale-domain.test.js');
domainTest=replaceExact(domainTest,
`const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');`,
`const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');
const restoreBeaming=require('./helpers/restore-notation-beaming.cjs');`,
'domain beaming helper');
domainTest=replaceExact(domainTest,
`restoreInteraction(trainer,'src/trainer.js')`,
`restoreInteraction(restoreBeaming(trainer,'src/trainer.js'),'src/trainer.js')`,
'domain restoration');
write('tests/major-scale-domain.test.js',domainTest);

let boundaryTest=read('tests/notation-boundary.test.js');
boundaryTest=replaceExact(boundaryTest,
`const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');`,
`const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');
const restoreBeaming=require('./helpers/restore-notation-beaming.cjs');`,
'boundary beaming helper');
boundaryTest=replaceExact(boundaryTest,
`restoreInteraction(read(file),file)`,
`restoreInteraction(restoreBeaming(read(file),file),file)`,
'boundary files restoration');
boundaryTest=replaceExact(boundaryTest,
`restoreInteraction(read(file),file)`,
`restoreInteraction(restoreBeaming(read(file),file),file)`,
'protected restoration');
boundaryTest=replaceExact(boundaryTest,
`assert(at('src/domain/notation/notation-interaction.js')<at('src/exercises/major-scale/major-scale.domain.js'));
assert(at('src/domain/notation/notation-interaction.js')<at('src/trainer.js'));`,
`assert(at('src/domain/notation/notation-interaction.js')<at('src/domain/notation/notation-beaming.js'));
assert(at('src/domain/notation/notation-beaming.js')<at('src/exercises/major-scale/major-scale.domain.js'));
assert(at('src/domain/notation/notation-beaming.js')<at('src/trainer.js'));`,
'boundary script order');
write('tests/notation-boundary.test.js',boundaryTest);

const beamTest=`'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const source=read('src/domain/notation/notation-beaming.js');
assert(!/supabase|fetch\\s*\\(|XMLHttpRequest|WebSocket|MAJOR_SCALE_NOTATION|LEVEL_KEYS|STAGE_[1-4]/i.test(source),'beaming module must stay backend/exercise agnostic');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'notation-beaming.js'});
const api=ctx.window.MajorScaleApp.notationBeaming;assert(api&&Object.isFrozen(api));
assert.equal(api.getBeamLevel({rhythm:'eighth'}),1);assert.equal(api.getBeamLevel({rhythm:'sixteenth'}),2);assert.equal(api.getBeamLevel({rhythm:'quarter'}),0);
assert.equal(api.getBeamDirection([{n:{stem:'auto'}},{n:{stem:'up'}}]),'up');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.beamGroupSignatures([{beamGroup:'a'},{beamGroup:'a'},null,{beamGroup:'b'}]))),['0-1','3']);
const notes=[{id:'a',rhythm:'eighth',beamGroup:'g'},{id:'b',rhythm:'eighth',beamGroup:'g'},{id:'c',rhythm:'quarter',beamGroup:'g'},{id:'d',rhythm:'sixteenth',beamGroup:'g'},{id:'e',rhythm:'sixteenth',beamGroup:'g'}];
let serial=0;api.normalizeBeamGroups(notes,{newGroupId:()=>`new-${++serial}`,measureOfIndex:i=>0});
assert.equal(notes[0].beamGroup,'g');assert.equal(notes[1].beamGroup,'g');assert.equal(notes[2].beamGroup,null);assert.equal(notes[3].beamGroup,'new-1');assert.equal(notes[4].beamGroup,'new-1');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.validateBeamSelection([0,1],[{rhythm:'eighth'},{rhythm:'sixteenth'}],i=>0))),{ok:true,reason:null});
assert.equal(api.validateBeamSelection([0],[{rhythm:'eighth'}],i=>0).reason,'minimum');
assert.equal(api.validateBeamSelection([0,2],[{rhythm:'eighth'},null,{rhythm:'eighth'}],i=>0).reason,'contiguous');
const renderNotes=[{id:'a',letter:'C',octave:4,rhythm:'eighth',stem:'up',beamGroup:'g'},{id:'b',letter:'D',octave:4,rhythm:'sixteenth',stem:'up',beamGroup:'g'}];
const appended=[];const svg={appendChild:n=>appended.push(n)};const createSvgElement=(tag,attrs)=>({tag,attrs});
api.drawBeams(svg,renderNotes,[100,160],{stepToY:s=>200-s*5,pitchToStep:(l,o)=>l==='C'?0:1,createSvgElement});
const polygons=appended.filter(n=>n.tag==='polygon');assert.equal(polygons.length,2,'primary + terminal secondary hook');
const terminal=polygons[1].attrs.points.split(' ').slice(0,2).map(p=>Number(p.split(',')[0]));assert.deepStrictEqual(terminal,[158,170],'terminal 16th hook points inward left toward previous note');
appended.length=0;api.drawBeams(svg,renderNotes.map(n=>({...n,stem:'down'})),[100,160],{stepToY:s=>200-s*5,pitchToStep:(l,o)=>l==='C'?0:1,createSvgElement});
const downPolys=appended.filter(n=>n.tag==='polygon');const downHook=downPolys[1].attrs.points.split(' ').slice(0,2).map(p=>Number(p.split(',')[0]));assert.deepStrictEqual(downHook,[138,150],'terminal hook remains inward for down stems');
const trainer=read('src/trainer.js');for(const token of ['notationBeaming.drawBeams(','notationBeaming.normalizeBeamGroups(','notationBeaming.validateBeamSelection(','notationBeaming.beamGroupSignatures('])assert(trainer.includes(token),'Trainer delegates '+token);
console.log('PASS notation beaming: direction, levels, normalization, controls, signatures, and inward terminal hooks both stem directions');
`;
write('tests/notation-beaming.test.js',beamTest);

let interactionTest=read('tests/notation-interaction.test.js');
interactionTest=replaceExact(interactionTest,
`const svg={`,
`assert.equal(api.dragDeltaSteps(100,82,18),2);
const completion=api.rangeGestureCompletion({moved:false,rangeLastIndex:4},2);assert.equal(completion.completedBySecondTap,true);assert.equal(completion.complete,true);
const pointer={active:true,pointerId:7,noteId:'x',noteIndex:3,moved:true,dragSelectionPrepared:true,mode:'range',rangeAnchorIndex:1,rangeLastIndex:3};api.resetPointerInteraction(pointer);assert.deepStrictEqual(JSON.parse(JSON.stringify(pointer)),{active:false,pointerId:null,noteId:null,noteIndex:-1,moved:false,dragSelectionPrepared:false,mode:'note',rangeAnchorIndex:-1,rangeLastIndex:-1});

const svg={`,
'interaction helper tests');
write('tests/notation-interaction.test.js',interactionTest);

const freezeTest=`'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const notation=['src/domain/notation/notation-core.js','src/domain/notation/notation-renderer.js','src/domain/notation/notation-interaction.js','src/domain/notation/notation-beaming.js'];
for(const file of notation){
 const source=read(file);
 assert(!/supabase|auth\\.|repository|practiceSession|student_|teacher_|MAJOR_SCALE_NOTATION|STAGE_[1-4]/i.test(source),'notation layer must be platform/exercise agnostic: '+file);
}
const trainer=read('src/trainer.js');
assert(trainer.includes('scoreSvg.addEventListener("pointerdown"'),'Trainer remains UI/event orchestrator');
assert(!trainer.includes('const hookStart=p.x-12'),'secondary-beam algorithm must be outside Trainer');
console.log('PASS architecture freeze: notation core/renderer/interaction/beaming are backend/exercise agnostic; Trainer remains orchestration shell');
`;
write('tests/notation-architecture-freeze.test.js',freezeTest);
console.log('Applied v0.8.1-d architecture freeze patch');
