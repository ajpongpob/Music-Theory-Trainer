'use strict';
const fs=require('fs'),assert=require('assert');
const read=p=>fs.readFileSync(p,'utf8'),write=(p,s)=>fs.writeFileSync(p,s);
function replaceOnce(source,before,after,label){const i=source.indexOf(before);assert(i>=0,'missing '+label);assert.equal(source.indexOf(before,i+1),-1,'duplicate '+label);return source.slice(0,i)+after+source.slice(i+before.length);}
function replaceFirst(source,before,after,label){const i=source.indexOf(before);assert(i>=0,'missing '+label);return source.slice(0,i)+after+source.slice(i+before.length);}
function replaceBetween(source,start,end,after,label){const a=source.indexOf(start),b=source.indexOf(end);assert(a>=0&&b>a,'missing '+label);return source.slice(0,a)+after+source.slice(b);}

let html=read('index.html');
html=replaceOnce(html,'<script src="./src/domain/notation/notation-interaction.js"></script>','<script src="./src/domain/notation/notation-interaction.js"></script>\n<script src="./src/domain/notation/notation-beaming.js"></script>','beaming script');
write('index.html',html);

let trainer=read('src/trainer.js');
trainer=replaceOnce(trainer,'const notationInteraction=window.MajorScaleApp.notationInteraction;\nconst majorScaleModule=','const notationInteraction=window.MajorScaleApp.notationInteraction;\nconst notationBeaming=window.MajorScaleApp.notationBeaming;\nconst majorScaleModule=','beaming binding');
trainer=replaceOnce(trainer,'  const deltaSteps=Math.round(\n    (noteInteraction.startY-local.y)/(staff.spacing/2)\n  );','  const deltaSteps=notationInteraction.dragDeltaSteps(\n    noteInteraction.startY,\n    local.y,\n    staff.spacing\n  );','drag delta');
trainer=replaceOnce(trainer,'    const completedByDrag=noteInteraction.moved;\n    const completedBySecondTap=\n      state.mobileRangeAnchorIndex>=0 &&\n      noteInteraction.rangeLastIndex!==state.mobileRangeAnchorIndex;','    const {completedByDrag,completedBySecondTap}=notationInteraction.rangeGestureCompletion(\n      noteInteraction,\n      state.mobileRangeAnchorIndex\n    );','range completion');
const resetRange='    noteInteraction.active=false;\n    noteInteraction.pointerId=null;\n    noteInteraction.noteId=null;\n    noteInteraction.noteIndex=-1;\n    noteInteraction.moved=false;\n    noteInteraction.dragSelectionPrepared=false;\n    noteInteraction.mode="note";\n    noteInteraction.rangeAnchorIndex=-1;\n    noteInteraction.rangeLastIndex=-1;';
trainer=replaceFirst(trainer,resetRange,'    notationInteraction.resetPointerInteraction(noteInteraction);','range reset');
const resetNormal='  noteInteraction.active=false;\n  noteInteraction.pointerId=null;\n  noteInteraction.noteId=null;\n  noteInteraction.noteIndex=-1;\n  noteInteraction.moved=false;\n  noteInteraction.dragSelectionPrepared=false;\n  noteInteraction.mode="note";\n  noteInteraction.rangeAnchorIndex=-1;\n  noteInteraction.rangeLastIndex=-1;';
trainer=replaceFirst(trainer,resetNormal,'  notationInteraction.resetPointerInteraction(noteInteraction);','note reset');
trainer=replaceFirst(trainer,resetNormal,'  notationInteraction.resetPointerInteraction(noteInteraction);','cancel reset');

const beamWrappers=[
'function getBeamDirection(items){','  return notationBeaming.getBeamDirection(items);','}','',
'function getBeamLevel(note){','  return notationBeaming.getBeamLevel(note);','}','',
'function buildBeamSegments(items){','  return notationBeaming.buildBeamSegments(items);','}','',
'function drawBeams(){','  return notationBeaming.drawBeams(scoreSvg,state.notes,noteXs,{','    stepToY,','    pitchToStep,','    createSvgElement:el','  });','}','',''
].join('\n');
trainer=replaceBetween(trainer,'function getBeamDirection(items){','function staffStepToPitch(step){',beamWrappers,'beaming block');
const normalize=['function normalizeBeamGroups(){','  return notationBeaming.normalizeBeamGroups(state.notes,{','    newGroupId:newBeamGroupId,','    measureOfIndex:i=>Math.floor(i/7)','  });','}','',''].join('\n');
trainer=replaceBetween(trainer,'function normalizeBeamGroups(){','function syncToolButtons(){',normalize,'normalize block');
const controls=[
'document.getElementById("beamSelected").onclick=()=>{',
' const idx=state.notes.map((n,i)=>n&&state.selectedIds.has(n.id)?i:null).filter(i=>i!==null).sort((a,b)=>a-b);',
' const validation=notationBeaming.validateBeamSelection(idx,state.notes,i=>Math.floor(i/7));',
' if(!validation.ok){',
'   if(validation.reason==="minimum") return alert("เลือกอย่างน้อย 2 โน้ต: คลิกตัวแรก แล้ว Shift+Click ตัวสุดท้าย หรือใช้ปุ่ม เลือกหลายโน้ต");',
'   if(validation.reason==="contiguous") return alert("กรุณาเลือกโน้ตที่อยู่ติดกัน");',
'   if(validation.reason==="rhythm") return alert("Beam ได้เฉพาะ eighth/sixteenth notes");',
'   if(validation.reason==="measure") return alert("เลือกโน้ตในห้องเดียวกันเพื่อ Beam");',
' }',
' const gid=newBeamGroupId();',
' const groupDir=effectiveStem(state.notes[idx[0]]) || autoStem(state.notes[idx[0]].letter,state.notes[idx[0]].octave);',
' notationBeaming.applyBeamGroup(state.notes,idx,gid,groupDir);',
' normalizeBeamGroups();render();',
'};',
'document.getElementById("unbeamSelected").onclick=()=>{',
'  notationBeaming.clearSelectedBeamGroups(state.notes,state.selectedIds);',
'  normalizeBeamGroups();',
'  render();',
'};','',''
].join('\n');
trainer=replaceBetween(trainer,'document.getElementById("beamSelected").onclick=()=>{','const percent=majorScaleModule.percent;',controls,'beam controls');
trainer=replaceBetween(trainer,'function beamGroupSignatures(notes){','function check(){','function beamGroupSignatures(notes){\n  return notationBeaming.beamGroupSignatures(notes);\n}\n\n','beam signatures');
write('src/trainer.js',trainer);

let domain=read('tests/major-scale-domain.test.js');
domain=replaceOnce(domain,"const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');","const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');\nconst restoreBeaming=require('./helpers/restore-notation-beaming.cjs');",'domain helper');
domain=replaceOnce(domain,"restoreInteraction(trainer,'src/trainer.js')","restoreInteraction(restoreBeaming(trainer,'src/trainer.js'),'src/trainer.js')",'domain restore chain');
write('tests/major-scale-domain.test.js',domain);

let boundary=read('tests/notation-boundary.test.js');
boundary=replaceOnce(boundary,"const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');","const restoreInteraction=require('./helpers/restore-notation-interaction.cjs');\nconst restoreBeaming=require('./helpers/restore-notation-beaming.cjs');",'boundary helper');
boundary=replaceFirst(boundary,'restoreInteraction(read(file),file)','restoreInteraction(restoreBeaming(read(file),file),file)','boundary file chain');
boundary=replaceFirst(boundary,'restoreInteraction(read(file),file)','restoreInteraction(restoreBeaming(read(file),file),file)','protected chain');
boundary=replaceOnce(boundary,"assert(at('src/domain/notation/notation-interaction.js')<at('src/exercises/major-scale/major-scale.domain.js'));\nassert(at('src/domain/notation/notation-interaction.js')<at('src/trainer.js'));","assert(at('src/domain/notation/notation-interaction.js')<at('src/domain/notation/notation-beaming.js'));\nassert(at('src/domain/notation/notation-beaming.js')<at('src/exercises/major-scale/major-scale.domain.js'));\nassert(at('src/domain/notation/notation-beaming.js')<at('src/trainer.js'));",'script order');
write('tests/notation-boundary.test.js',boundary);

let interactionTest=read('tests/notation-interaction.test.js');
interactionTest=replaceOnce(interactionTest,'const svg={',[
'assert.equal(api.dragDeltaSteps(100,82,18),2);',
"const completion=api.rangeGestureCompletion({moved:false,rangeLastIndex:4},2);assert.equal(completion.completedBySecondTap,true);assert.equal(completion.complete,true);",
"const pointer={active:true,pointerId:7,noteId:'x',noteIndex:3,moved:true,dragSelectionPrepared:true,mode:'range',rangeAnchorIndex:1,rangeLastIndex:3};api.resetPointerInteraction(pointer);assert.deepStrictEqual(JSON.parse(JSON.stringify(pointer)),{active:false,pointerId:null,noteId:null,noteIndex:-1,moved:false,dragSelectionPrepared:false,mode:'note',rangeAnchorIndex:-1,rangeLastIndex:-1});",
'',
'const svg={'
].join('\n'),'interaction tests');
write('tests/notation-interaction.test.js',interactionTest);
console.log('Applied streamlined v0.8.1-d trainer/test patch');
