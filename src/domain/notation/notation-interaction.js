(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp || {};

function staffStepToY(step,staff){
  return staff.top+staff.spacing*4-step*(staff.spacing/2);
}

function staffYToStep(y,staff){
  return Math.round((staff.top+staff.spacing*4-y)/(staff.spacing/2));
}

function nearestSlotIndexToX(x,positions){
  let nearest=0;
  let best=Infinity;

  positions.forEach((slotX,i)=>{
    const distance=Math.abs(slotX-x);
    if(distance<best){
      best=distance;
      nearest=i;
    }
  });

  return nearest;
}

function nearestOccupiedIndexToX(x,positions,notes){
  let nearest=-1;
  let best=Infinity;

  notes.forEach((note,i)=>{
    if(!note) return;

    const distance=Math.abs(positions[i]-x);
    if(distance<best){
      best=distance;
      nearest=i;
    }
  });

  return nearest;
}

function noteTargetFromEvent(ev,notes){
  const target=ev.target && ev.target.closest
    ? ev.target.closest('[data-note-id]')
    : null;

  if(!target) return null;

  const id=target.getAttribute('data-note-id');
  const index=notes.findIndex(n=>n && n.id===id);

  return index>=0
    ? {element:target,id,index,note:notes[index]}
    : null;
}

function selectedNoteIdsInRange(notes,anchorIndex,currentIndex){
  if(anchorIndex<0 || currentIndex<0) return null;
  const start=Math.min(anchorIndex,currentIndex);
  const end=Math.max(anchorIndex,currentIndex);
  const ids=[];
  for(let i=start;i<=end;i++){
    const note=notes[i];
    if(note) ids.push(note.id);
  }
  return ids;
}

function eventPointInSvg(svg,ev){
  const ctm=svg.getScreenCTM();
  if(!ctm) return null;

  const pt=svg.createSVGPoint();
  pt.x=ev.clientX;
  pt.y=ev.clientY;
  return pt.matrixTransform(ctm.inverse());
}

function mapCompactScorePoint(point,options){
  if(!options.compact) return point;

  const rows=options.rows;
  let row;
  if(Number.isInteger(options.pinnedIndex) && options.pinnedIndex>=0){
    row=rows.findIndex(([first,last])=>options.pinnedIndex>=first && options.pinnedIndex<=last);
    if(row<0) row=0;
  }else{
    row=Math.max(0,Math.min(rows.length-1,Math.floor(point.y/options.rowHeight)));
  }

  const [first,last]=rows[row];
  return {
    x:Math.max(
      options.positions[first],
      Math.min(options.positions[last],point.x+options.rowOffsets[row])
    ),
    y:point.y-row*options.rowHeight+options.yAdjustment
  };
}

app.notationInteraction=Object.freeze({
  staffStepToY,
  staffYToStep,
  nearestSlotIndexToX,
  nearestOccupiedIndexToX,
  noteTargetFromEvent,
  selectedNoteIdsInRange,
  eventPointInSvg,
  mapCompactScorePoint
});
})();
