(() => {
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
    const flush=()=>{
      if(run.length) runs.push(run);
      run=[];
    };

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
  indices.forEach(i=>{
    notes[i].beamGroup=gid;
    notes[i].stem=direction;
  });
}

function clearSelectedBeamGroups(notes,selectedIds){
  const groups=new Set(
    notes
      .filter(n=>n && selectedIds.has(n.id) && n.beamGroup!=null)
      .map(n=>n.beamGroup)
  );
  notes.forEach(n=>{
    if(n && groups.has(n.beamGroup)) n.beamGroup=null;
  });
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
    if(items.length<2) return;

    const dir=getBeamDirection(items);
    const notes=items.map(({n,i})=>{
      const y=options.stepToY(options.pitchToStep(n.letter,n.octave));
      return {
        n,
        i,
        x:positions[i]+(dir==='up'?10:-10),
        y,
        level:getBeamLevel(n)
      };
    });

    const beamY=dir==='up'
      ? Math.min(...notes.map(p=>p.y-55))
      : Math.max(...notes.map(p=>p.y+55));

    notes.forEach(p=>{
      svg.appendChild(options.createSvgElement('line',{
        x1:p.x,y1:p.y,x2:p.x,y2:beamY,
        stroke:'#111','stroke-width':2.3
      }));
    });

    const first=notes[0],last=notes[notes.length-1];
    svg.appendChild(options.createSvgElement('polygon',{
      points:`${first.x},${beamY} ${last.x},${beamY} ${last.x},${beamY+(dir==='up'?8:-8)} ${first.x},${beamY+(dir==='up'?8:-8)}`,
      fill:'#111'
    }));

    const secondaryY=beamY+(dir==='up'?10:-10);
    const thickness=8;
    const drawSecondaryBeam=(x1,x2)=>{
      svg.appendChild(options.createSvgElement('polygon',{
        points:`${x1},${secondaryY} ${x2},${secondaryY} ${x2},${secondaryY+(dir==='up'?thickness:-thickness)} ${x1},${secondaryY+(dir==='up'?thickness:-thickness)}`,
        fill:'#111'
      }));
    };

    notes.forEach((p,index)=>{
      if(p.level!==2) return;

      const prev=notes[index-1];
      const next=notes[index+1];
      const prevSixteenth=prev && prev.level===2;
      const nextSixteenth=next && next.level===2;

      if(nextSixteenth){
        drawSecondaryBeam(p.x,next.x);
        return;
      }
      if(prevSixteenth) return;

      if(prev && prev.level>=1){
        drawSecondaryBeam(p.x-12,p.x);
        return;
      }

      if(next && next.level>=1){
        drawSecondaryBeam(p.x,p.x+12);
      }
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
