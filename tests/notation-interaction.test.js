'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const source=read('src/domain/notation/notation-interaction.js');
assert(!/supabase|fetch\s*\(|XMLHttpRequest|WebSocket|\beval\s*\(|new Function|import\s*\(|MAJOR_SCALE_NOTATION|LEVEL_KEYS|STAGE_[1-4]/i.test(source),'interaction foundation must stay backend/exercise agnostic');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'notation-interaction.js'});
const api=ctx.window.MajorScaleApp.notationInteraction;
assert(api&&Object.isFrozen(api));

const staff={top:110,spacing:18};
assert.equal(api.staffStepToY(0,staff),182);
assert.equal(api.staffStepToY(4,staff),146);
assert.equal(api.staffYToStep(146,staff),4);
assert.equal(api.staffYToStep(150,staff),4);

const positions=[100,200,300,400];
assert.equal(api.nearestSlotIndexToX(240,positions),1);
assert.equal(api.nearestSlotIndexToX(250,positions),1,'ties preserve the earlier slot');
const notes=[null,{id:'b'},null,{id:'d'}];
assert.equal(api.nearestOccupiedIndexToX(260,positions,notes),1);
assert.equal(api.nearestOccupiedIndexToX(390,positions,notes),3);
assert.equal(api.nearestOccupiedIndexToX(200,positions,[null,null,null,null]),-1);

const noteNode={getAttribute(name){assert.equal(name,'data-note-id');return'b';}};
const hit=api.noteTargetFromEvent({target:{closest(selector){assert.equal(selector,'[data-note-id]');return noteNode;}}},notes);
assert.equal(hit.element,noteNode);assert.equal(hit.id,'b');assert.equal(hit.index,1);assert.strictEqual(hit.note,notes[1]);
assert.equal(api.noteTargetFromEvent({target:{closest(){return null;}}},notes),null);
assert.equal(api.noteTargetFromEvent({target:{}},notes),null);

const svg={
  getScreenCTM(){return{inverse(){return{kind:'inverse'};}};},
  createSVGPoint(){return{x:0,y:0,matrixTransform(matrix){assert.equal(matrix.kind,'inverse');return{x:this.x-10,y:this.y-20};}};}
};
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.eventPointInSvg(svg,{clientX:40,clientY:70}))),{x:30,y:50});
assert.equal(api.eventPointInSvg({getScreenCTM(){return null;}},{clientX:1,clientY:2}),null);

const scorePositions=[210,265,320,375,430,485,540,640,695,750,805,860,915,970,1080];
const compactOptions={compact:true,positions:scorePositions,rowOffsets:[75,550,1085],rowHeight:220,rows:[[0,6],[7,13],[14,14]],yAdjustment:40,pinnedIndex:null};
const rawPoint={x:100,y:250};
assert.strictEqual(api.mapCompactScorePoint(rawPoint,{...compactOptions,compact:false}),rawPoint,'non-compact mapping is identity');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.mapCompactScorePoint(rawPoint,compactOptions))),{x:650,y:70});
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.mapCompactScorePoint({x:-500,y:10},compactOptions))),{x:210,y:50},'row x clamps to its first slot');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.mapCompactScorePoint({x:0,y:500},{...compactOptions,pinnedIndex:14}))),{x:1080,y:100},'active note drag stays pinned to its score system');

const trainer=read('src/trainer.js');
for(const wrapper of [
  'notationInteraction.staffStepToY(step,staff)',
  'notationInteraction.staffYToStep(y,staff)',
  'notationInteraction.nearestSlotIndexToX(x,noteXs)',
  'notationInteraction.nearestOccupiedIndexToX(x,noteXs,state.notes)',
  'notationInteraction.noteTargetFromEvent(ev,state.notes)',
  'notationInteraction.eventPointInSvg(scoreSvg,ev)',
  'notationInteraction.mapCompactScorePoint(point'
]) assert(trainer.includes(wrapper),'Trainer must delegate coordinate primitive: '+wrapper);
for(const legacyRuntime of ['scoreSvg.addEventListener("pointerdown"','scoreSvg.addEventListener("pointermove"','scoreSvg.addEventListener("pointerup"','function selectNoteRange(','function drawBeams(){'])assert(trainer.includes(legacyRuntime),'event/selection/beaming runtime must remain in Trainer: '+legacyRuntime);
console.log('PASS notation interaction foundation: staff coordinates, nearest-slot hit testing, note targets, SVG mapping, compact-system mapping, and Trainer event boundaries');
