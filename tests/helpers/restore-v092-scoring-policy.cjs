'use strict';
const assert=require('assert');

function replaceExact(source,after,before,label){
  const count=source.split(after).length-1;
  assert.equal(count,1,`unexpected v0.9.2 ${label} delta: ${count} matches`);
  return source.replace(after,before);
}

module.exports=function restoreV092(source,file){
  if(file==='src/exercises/major-scale/major-scale.domain.js'){
    source=replaceExact(source,
`  /* BN01 — Pitch name on the treble staff.
     Octave is intentionally NOT part of correctness: the learner may write
     the correct scale in any octave. Accidentals are scored separately by
     MS03, so this criterion checks only the diatonic pitch letter. */
  const bn01Flags=expected.map((x,i)=>{
    const n=actual[i];
    return !!n && n.letter===x.letter;
  });`,
`  /* BN01 — Treble staff position
     Accidental is intentionally excluded here.
     The staff position must match the correct letter + octave. */
  const bn01Flags=expected.map((x,i)=>{
    const n=actual[i];
    return !!n &&
      pitchToStep(n.letter,n.octave)===
      pitchToStep(x.letter,x.octave);
  });`,
      'pitch policy');

    source=replaceExact(source,
`  /* BN06 — Stem direction
     Two independent quarter-note units + four beamed-group units.
     Direction is judged from the positions actually written by the learner,
     so a pitch error is not automatically counted again as a stem error.
     A single stemmed note placed on the treble-staff middle line (B4) may
     point either up or down, following the accepted engraving convention. */
  const bn06Flags=[];

  [0,7].forEach(i=>{
    const n=actual[i];
    const onMiddleLine=!!n && pitchToStep(n.letter,n.octave)===4;
    bn06Flags.push(
      !n ? false :
      n.rhythm==="whole" ? false :
      onMiddleLine ? true :
      effectiveStem(n)===autoStem(n.letter,n.octave)
    );
  });`,
`  /* BN06 — Stem direction
     Two independent quarter-note units + four beamed-group units.
     Direction is judged from the positions actually written by the learner,
     so a pitch error is not automatically counted again as a stem error. */
  const bn06Flags=[];

  [0,7].forEach(i=>{
    const n=actual[i];
    bn06Flags.push(
      !n ? false :
      n.rhythm==="whole" ? false :
      effectiveStem(n)===autoStem(n.letter,n.octave)
    );
  });`,
      'stem policy');
  }

  if(file==='src/exercises/major-scale/major-scale.config.js'){
    source=replaceExact(source,
`  BN01_TREBLE_PITCH:{
    code:"BN01_TREBLE_PITCH",
    short:"Pitch Name",
    th:"ชื่อระดับเสียงบนกุญแจซอล (ไม่จำกัด Octave)"
  },`,
`  BN01_TREBLE_PITCH:{
    code:"BN01_TREBLE_PITCH",
    short:"Treble Pitch",
    th:"ตำแหน่งระดับเสียงบนกุญแจซอล"
  },`,
      'criterion label');
  }

  return source;
};
