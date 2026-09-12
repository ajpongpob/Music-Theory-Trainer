'use strict';
const assert=require('assert');

function replaceExact(source,after,before,label){
  const i=source.indexOf(after);
  assert(i>=0,'missing v0.8.1-c1 edit: '+label);
  assert.equal(source.indexOf(after,i+1),-1,'duplicate v0.8.1-c1 edit: '+label);
  return source.slice(0,i)+before+source.slice(i+after.length);
}

const trainerPairs=[
  {
    label:'interaction module binding',
    before:'const notationRenderer=window.MajorScaleApp.notationRenderer;\nconst majorScaleModule=',
    after:'const notationRenderer=window.MajorScaleApp.notationRenderer;\nconst notationInteraction=window.MajorScaleApp.notationInteraction;\nconst majorScaleModule='
  },
  {
    label:'staff coordinate wrappers',
    before:'function stepToY(step){return staff.top+staff.spacing*4-step*(staff.spacing/2)}\nfunction yToStep(y){return Math.round((staff.top+staff.spacing*4-y)/(staff.spacing/2))}\n',
    after:'function stepToY(step){return notationInteraction.staffStepToY(step,staff);}\nfunction yToStep(y){return notationInteraction.staffYToStep(y,staff);}\n'
  },
  {
    label:'nearest slot helpers',
    before:`function nearestSlotIndexToX(x){
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
    after:`function nearestSlotIndexToX(x){
  return notationInteraction.nearestSlotIndexToX(x,noteXs);
}

function nearestOccupiedIndexToX(x){
  return notationInteraction.nearestOccupiedIndexToX(x,noteXs,state.notes);
}
`
  },
  {
    label:'event target and coordinate helpers',
    before:`function noteTargetFromEvent(ev){
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
    after:`function noteTargetFromEvent(ev){
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
`
  }
];

module.exports=function restoreNotationInteraction(source,file){
  if(file==='src/trainer.js'){
    for(const pair of trainerPairs) source=replaceExact(source,pair.after,pair.before,pair.label);
    return source;
  }
  if(file==='index.html'){
    return replaceExact(
      source,
      '<script src="./src/domain/notation/notation-renderer.js"></script>\n<script src="./src/domain/notation/notation-interaction.js"></script>\n',
      '<script src="./src/domain/notation/notation-renderer.js"></script>\n',
      'interaction script tag'
    );
  }
  return source;
};
