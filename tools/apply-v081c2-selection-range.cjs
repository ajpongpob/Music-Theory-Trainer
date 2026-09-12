'use strict';
const fs=require('fs');
function replaceExact(path,before,after,label){
  let source=fs.readFileSync(path,'utf8');
  const i=source.indexOf(before);
  if(i<0) throw new Error('missing '+label+' in '+path);
  if(source.indexOf(before,i+1)>=0) throw new Error('duplicate '+label+' in '+path);
  source=source.slice(0,i)+after+source.slice(i+before.length);
  fs.writeFileSync(path,source);
}

const interactionPath='src/domain/notation/notation-interaction.js';
replaceExact(interactionPath,
`function eventPointInSvg(svg,ev){`,
`function selectedNoteIdsInRange(notes,anchorIndex,currentIndex){
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

function eventPointInSvg(svg,ev){`,
'selection helper insertion');
replaceExact(interactionPath,
`  noteTargetFromEvent,\n  eventPointInSvg,`,
`  noteTargetFromEvent,\n  selectedNoteIdsInRange,\n  eventPointInSvg,`,
'selection helper export');

const trainerPath='src/trainer.js';
const oldSelect=`function selectNoteRange(anchorIndex,currentIndex){
  if(anchorIndex<0 || currentIndex<0) return;
  state.selectionIsExplicit=true;

  const start=Math.min(anchorIndex,currentIndex);
  const end=Math.max(anchorIndex,currentIndex);

  state.selectedIds.clear();

  for(let i=start;i<=end;i++){
    const note=state.notes[i];
    if(note){
      state.selectedIds.add(note.id);
    }
  }

  state.cursorIndex=currentIndex;

  const current=state.notes[currentIndex];
  if(current){
    state.cursorStaffStep=pitchToStep(
      current.letter,
      current.octave
    );
  }
}
`;
const newSelect=`function selectNoteRange(anchorIndex,currentIndex){
  const selectedIds=notationInteraction.selectedNoteIdsInRange(
    state.notes,
    anchorIndex,
    currentIndex
  );
  if(!selectedIds) return;
  state.selectionIsExplicit=true;

  state.selectedIds.clear();
  selectedIds.forEach(id=>state.selectedIds.add(id));

  state.cursorIndex=currentIndex;

  const current=state.notes[currentIndex];
  if(current){
    state.cursorStaffStep=pitchToStep(
      current.letter,
      current.octave
    );
  }
}
`;
replaceExact(trainerPath,oldSelect,newSelect,'selectNoteRange');

const testPath='tests/notation-interaction.test.js';
replaceExact(testPath,
`assert.equal(api.noteTargetFromEvent({target:{}},notes),null);\n\nconst svg=`,
`assert.equal(api.noteTargetFromEvent({target:{}},notes),null);\n\nassert.equal(api.selectedNoteIdsInRange(notes,-1,2),null);\nassert.equal(api.selectedNoteIdsInRange(notes,1,-1),null);\nassert.deepStrictEqual(JSON.parse(JSON.stringify(api.selectedNoteIdsInRange(notes,1,3))),['b','d']);\nassert.deepStrictEqual(JSON.parse(JSON.stringify(api.selectedNoteIdsInRange(notes,3,1))),['b','d'],'reverse ranges preserve score order');\nassert.deepStrictEqual(JSON.parse(JSON.stringify(api.selectedNoteIdsInRange([null,null],0,1))),[],'empty range returns empty selection');\n\nconst svg=`,
'selection primitive tests');
replaceExact(testPath,
`  'notationInteraction.noteTargetFromEvent(ev,state.notes)',\n  'notationInteraction.eventPointInSvg(scoreSvg,ev)',`,
`  'notationInteraction.noteTargetFromEvent(ev,state.notes)',\n  'notationInteraction.selectedNoteIdsInRange(',\n  'notationInteraction.eventPointInSvg(scoreSvg,ev)',`,
'Trainer selection delegation assertion');
replaceExact(testPath,
`for(const legacyRuntime of ['scoreSvg.addEventListener("pointerdown"','scoreSvg.addEventListener("pointermove"','scoreSvg.addEventListener("pointerup"','function selectNoteRange(','function drawBeams(){'])assert(trainer.includes(legacyRuntime),'event/selection/beaming runtime must remain in Trainer: '+legacyRuntime);`,
`for(const legacyRuntime of ['scoreSvg.addEventListener("pointerdown"','scoreSvg.addEventListener("pointermove"','scoreSvg.addEventListener("pointerup"','function selectNoteRange(','function drawBeams(){'])assert(trainer.includes(legacyRuntime),'event/selection/beaming runtime must remain in Trainer: '+legacyRuntime);\nassert(!trainer.includes('const start=Math.min(anchorIndex,currentIndex);'),'range membership calculation must leave Trainer');`,
'legacy selection boundary assertion');
replaceExact(testPath,
`console.log('PASS notation interaction foundation: staff coordinates, nearest-slot hit testing, note targets, SVG mapping, compact-system mapping, and Trainer event boundaries');`,
`console.log('PASS notation interaction c2: coordinate primitives, pure selection-range membership, and Trainer event boundaries');`,
'test label');

const restorePath='tests/helpers/restore-notation-interaction.cjs';
replaceExact(restorePath,
`const trainerPairs=[\n`,
`const trainerPairs=[\n  {\n    label:'selection range helper',\n    before:${JSON.stringify(oldSelect)},\n    after:${JSON.stringify(newSelect)}\n  },\n`,
'restore selection pair');
console.log('Applied v0.8.1-c2 selection-range extraction');
