'use strict';
const fs=require('fs');
const assert=require('assert');

function replaceExact(source,before,after,label){
  const i=source.indexOf(before);
  assert(i>=0,'missing source block: '+label);
  assert.equal(source.indexOf(before,i+1),-1,'duplicate source block: '+label);
  return source.slice(0,i)+after+source.slice(i+before.length);
}

const trainerPath='src/trainer.js';
let trainer=fs.readFileSync(trainerPath,'utf8');
trainer=replaceExact(
  trainer,
  'const notationRenderer=window.MajorScaleApp.notationRenderer;\n',
  'const notationRenderer=window.MajorScaleApp.notationRenderer;\nconst notationInteraction=window.MajorScaleApp.notationInteraction;\n',
  'interaction module binding'
);
trainer=replaceExact(
  trainer,
  'function stepToY(step){return staff.top+staff.spacing*4-step*(staff.spacing/2)}\nfunction yToStep(y){return Math.round((staff.top+staff.spacing*4-y)/(staff.spacing/2))}\n',
  'function stepToY(step){return notationInteraction.staffStepToY(step,staff);}\nfunction yToStep(y){return notationInteraction.staffYToStep(y,staff);}\n',
  'staff coordinate wrappers'
);
trainer=replaceExact(
  trainer,
`function nearestSlotIndexToX(x){
  let nearest=0;
  let best=Infinity;

  noteXs.forEach((slotX,i)=>{
    const distance=Math.abs(slotX-x);
    if(distance<best){
      best=distance;
      nearest=i;
    }
  });

  return nearest;
}

function nearestOccupiedIndexToX(x){
  let nearest=-1;
  let best=Infinity;

  state.notes.forEach((note,i)=>{
    if(!note) return;

    const distance=Math.abs(noteXs[i]-x);
    if(distance<best){
      best=distance;
      nearest=i;
    }
  });

  return nearest;
}
`,
`function nearestSlotIndexToX(x){
  return notationInteraction.nearestSlotIndexToX(x,noteXs);
}

function nearestOccupiedIndexToX(x){
  return notationInteraction.nearestOccupiedIndexToX(x,noteXs,state.notes);
}
`,
  'nearest slot helpers'
);
trainer=replaceExact(
  trainer,
`function noteTargetFromEvent(ev){
  const target=ev.target && ev.target.closest
    ? ev.target.closest("[data-note-id]")
    : null;

  if(!target) return null;

  const id=target.getAttribute("data-note-id");
  const index=state.notes.findIndex(n=>n && n.id===id);

  return index>=0
    ? {element:target,id,index,note:state.notes[index]}
    : null;
}

function eventPointInScore(ev){
  const ctm=scoreSvg.getScreenCTM();
  if(!ctm) return null;

  const pt=scoreSvg.createSVGPoint();
  pt.x=ev.clientX;
  pt.y=ev.clientY;
  const point=pt.matrixTransform(ctm.inverse());
  if(!compactScore)return point;
  const pinned=noteInteraction.active && noteInteraction.mode==="note" && noteInteraction.noteIndex>=0;
  const row=pinned
    ? (noteInteraction.noteIndex<7?0:noteInteraction.noteIndex<14?1:2)
    : Math.max(0,Math.min(2,Math.floor(point.y/COMPACT_ROW_HEIGHT)));
  const first=[0,7,14][row],last=[6,13,14][row];
  return {
    x:Math.max(noteXs[first],Math.min(noteXs[last],point.x+COMPACT_X_OFFSETS[row])),
    y:point.y-row*COMPACT_ROW_HEIGHT+40
  };
}
`,
`function noteTargetFromEvent(ev){
  return notationInteraction.noteTargetFromEvent(ev,state.notes);
}

function eventPointInScore(ev){
  const point=notationInteraction.eventPointInSvg(scoreSvg,ev);
  if(!point) return null;
  return notationInteraction.mapCompactScorePoint(point,{
    compact:compactScore,
    positions:noteXs,
    rowOffsets:COMPACT_X_OFFSETS,
    rowHeight:COMPACT_ROW_HEIGHT,
    rows:[[0,6],[7,13],[14,14]],
    yAdjustment:40,
    pinnedIndex:noteInteraction.active && noteInteraction.mode==="note" && noteInteraction.noteIndex>=0
      ? noteInteraction.noteIndex
      : null
  });
}
`,
  'event target and coordinate helpers'
);
fs.writeFileSync(trainerPath,trainer);

const htmlPath='index.html';
let html=fs.readFileSync(htmlPath,'utf8');
html=replaceExact(
  html,
  '<script src="./src/domain/notation/notation-renderer.js"></script>\n',
  '<script src="./src/domain/notation/notation-renderer.js"></script>\n<script src="./src/domain/notation/notation-interaction.js"></script>\n',
  'interaction script order'
);
fs.writeFileSync(htmlPath,html);

const majorPath='tests/major-scale-domain.test.js';
let major=fs.readFileSync(majorPath,'utf8');
major=replaceExact(
  major,
  "const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\n",
  "const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\nconst restoreInteraction=require('./helpers/restore-notation-interaction.cjs');\n",
  'major restore require'
);
major=replaceExact(
  major,
  "let restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');",
  "let restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreInteraction(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');",
  'major restoration chain'
);
fs.writeFileSync(majorPath,major);

const boundaryPath='tests/notation-boundary.test.js';
let boundary=fs.readFileSync(boundaryPath,'utf8');
boundary=replaceExact(
  boundary,
  "const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\n",
  "const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\nconst restoreInteraction=require('./helpers/restore-notation-interaction.cjs');\n",
  'boundary restore require'
);
boundary=replaceExact(
  boundary,
  "for(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(read(file),file),file),file),file),file),file);",
  "for(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreInteraction(read(file),file),file),file),file),file),file),file);",
  'boundary reconstruction chain'
);
boundary=replaceExact(
  boundary,
  "  const source=restoreFeedback(restoreNarrow(read(file),file),file);",
  "  const source=restoreFeedback(restoreNarrow(restoreInteraction(read(file),file),file),file);",
  'protected production restore chain'
);
boundary=replaceExact(
  boundary,
  "assert(at('src/domain/notation/notation-renderer.js')<at('src/exercises/major-scale/major-scale.domain.js'));\nassert(at('src/domain/notation/notation-renderer.js')<at('src/trainer.js'));",
  "assert(at('src/domain/notation/notation-renderer.js')<at('src/domain/notation/notation-interaction.js'));\nassert(at('src/domain/notation/notation-interaction.js')<at('src/exercises/major-scale/major-scale.domain.js'));\nassert(at('src/domain/notation/notation-interaction.js')<at('src/trainer.js'));",
  'script order assertions'
);
fs.writeFileSync(boundaryPath,boundary);
