'use strict';
const fs=require('fs'),assert=require('assert');
function r(s,b,a,l){const i=s.indexOf(b);assert(i>=0,'missing '+l);assert.equal(s.indexOf(b,i+1),-1,'duplicate '+l);return s.slice(0,i)+a+s.slice(i+b.length);}
let s=fs.readFileSync('src/trainer.js','utf8');
s=r(s,'const notationRenderer=window.MajorScaleApp.notationRenderer;\n','const notationRenderer=window.MajorScaleApp.notationRenderer;\nconst notationInteraction=window.MajorScaleApp.notationInteraction;\n','binding');
s=r(s,'function stepToY(step){return staff.top+staff.spacing*4-step*(staff.spacing/2)}\nfunction yToStep(y){return Math.round((staff.top+staff.spacing*4-y)/(staff.spacing/2))}\n','function stepToY(step){return notationInteraction.staffStepToY(step,staff);}\nfunction yToStep(y){return notationInteraction.staffYToStep(y,staff);}\n','staff coords');
s=r(s,`function nearestSlotIndexToX(x){
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
`,`function nearestSlotIndexToX(x){
  return notationInteraction.nearestSlotIndexToX(x,noteXs);
}

function nearestOccupiedIndexToX(x){
  return notationInteraction.nearestOccupiedIndexToX(x,noteXs,state.notes);
}
`,'nearest slots');
s=r(s,`function noteTargetFromEvent(ev){
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
`,`function noteTargetFromEvent(ev){
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
`,'event coords');
fs.writeFileSync('src/trainer.js',s);

s=fs.readFileSync('index.html','utf8');
s=r(s,'<script src="./src/domain/notation/notation-renderer.js"></script>\n','<script src="./src/domain/notation/notation-renderer.js"></script>\n<script src="./src/domain/notation/notation-interaction.js"></script>\n','script tag');
fs.writeFileSync('index.html',s);

s=fs.readFileSync('tests/major-scale-domain.test.js','utf8');
s=r(s,"const restoreLayout=require('./helpers/restore-renderer-score-layout.cjs');\n","const restoreLayout=require('./helpers/restore-renderer-score-layout.cjs');\nconst restoreInteraction=require('./helpers/restore-notation-interaction.cjs');\n",'major require');
s=r(s,"let restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreLayout(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');","let restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreLayout(restoreInteraction(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');",'major chain');
fs.writeFileSync('tests/major-scale-domain.test.js',s);

s=fs.readFileSync('tests/notation-boundary.test.js','utf8');
s=r(s,"const restoreLayout=require('./helpers/restore-renderer-score-layout.cjs');\n","const restoreLayout=require('./helpers/restore-renderer-score-layout.cjs');\nconst restoreInteraction=require('./helpers/restore-notation-interaction.cjs');\n",'boundary require');
s=r(s,"for(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreLayout(read(file),file),file),file),file),file),file),file);","for(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreLayout(restoreInteraction(read(file),file),file),file),file),file),file),file),file);",'boundary chain');
s=r(s,"  const source=restoreFeedback(restoreNarrow(restoreLayout(read(file),file),file),file);","  const source=restoreFeedback(restoreNarrow(restoreLayout(restoreInteraction(read(file),file),file),file),file);",'protected chain');
s=r(s,"assert(at('src/domain/notation/notation-renderer.js')<at('src/exercises/major-scale/major-scale.domain.js'));\nassert(at('src/domain/notation/notation-renderer.js')<at('src/trainer.js'));","assert(at('src/domain/notation/notation-renderer.js')<at('src/domain/notation/notation-interaction.js'));\nassert(at('src/domain/notation/notation-interaction.js')<at('src/exercises/major-scale/major-scale.domain.js'));\nassert(at('src/domain/notation/notation-interaction.js')<at('src/trainer.js'));",'script order');
fs.writeFileSync('tests/notation-boundary.test.js',s);
