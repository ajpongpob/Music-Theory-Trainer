const LETTERS=['C','D','E','F','G','A','B'];
const MAJOR_INTERVALS=[0,2,4,5,7,9,11,12];
const NATURAL_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const ACCIDENTAL_OFFSETS={'':0,'#':1,b:-1,'##':2,bb:-2};

export const SUPPORTED_TONICS=Object.freeze([
  'C','G','D','A','E','B','F#','C#',
  'F','Bb','Eb','Ab','Db','Gb','Cb',
  'G#','D#','A#','E#','B#','F##','C##',
  'Fb','Bbb','Ebb','Abb','Dbb','Gbb','Cbb'
]);

export const LO_WEIGHTS=Object.freeze({
  BN01_TREBLE_PITCH:30,
  BN06_STEM_DIRECTION:10,
  RH01_DURATION_VALUE:15,
  GR02_PRIMARY_BEAM:15,
  MS03_SCALE_ACCIDENTAL:30
});

export class ScoringValidationError extends Error {
  constructor(message){
    super(message);
    this.name='ScoringValidationError';
  }
}

function accidentalOffset(value){
  if(!Object.prototype.hasOwnProperty.call(ACCIDENTAL_OFFSETS,value)){
    throw new ScoringValidationError('Unsupported accidental');
  }
  return ACCIDENTAL_OFFSETS[value];
}

function parseTonic(value){
  return {letter:value[0],accidental:value.slice(1)};
}

function notePc(letter,accidental){
  return (NATURAL_PC[letter]+accidentalOffset(accidental)+12)%12;
}

export function buildMajorScaleFromTonic(tonicValue){
  if(!SUPPORTED_TONICS.includes(tonicValue)){
    throw new ScoringValidationError('Unsupported Major key');
  }
  const tonic=parseTonic(tonicValue);
  const start=LETTERS.indexOf(tonic.letter);
  const tonicPc=notePc(tonic.letter,tonic.accidental);
  return MAJOR_INTERVALS.map((semi,index)=>{
    const letter=LETTERS[(start+index)%7];
    const target=(tonicPc+semi)%12;
    const natural=NATURAL_PC[letter];
    const diff=(target-natural+12)%12;
    const spellings={0:'',1:'#',2:'##',10:'bb',11:'b'};
    if(!Object.prototype.hasOwnProperty.call(spellings,diff)){
      throw new ScoringValidationError('Major key requires an accidental beyond double sharp/flat');
    }
    return {letter,accidental:spellings[diff]};
  });
}

function ascendingScaleWithOctaves(tonicValue){
  const scale=buildMajorScaleFromTonic(tonicValue);
  let octave=4;
  let previous=LETTERS.indexOf(scale[0].letter);
  return scale.map((note,index)=>{
    const current=LETTERS.indexOf(note.letter);
    if(index>0 && current<=previous) octave++;
    previous=current;
    return {...note,octave};
  });
}

export function pitchToStep(letter,octave){
  return octave*7+LETTERS.indexOf(letter)-(4*7+LETTERS.indexOf('E'));
}

export function autoStem(letter,octave){
  const diatonic=octave*7+LETTERS.indexOf(letter);
  const b4=4*7+LETTERS.indexOf('B');
  return diatonic>=b4?'down':'up';
}

export function beamStemDirectionFromNotes(notes){
  const steps=notes.filter(Boolean).map(note=>pitchToStep(note.letter,note.octave));
  if(!steps.length) return 'down';
  const middle=4;
  if(steps.length===1) return steps[0]>=middle?'down':'up';
  const farthestDirection=()=>{
    const above=Math.max(0,...steps.map(step=>Math.max(0,step-middle)));
    const below=Math.max(0,...steps.map(step=>Math.max(0,middle-step)));
    if(above>below) return 'down';
    if(below>above) return 'up';
    return 'down';
  };
  if(steps.length===2) return farthestDirection();
  const onOrAbove=steps.filter(step=>step>=middle).length;
  const below=steps.filter(step=>step<middle).length;
  if(onOrAbove>below) return 'down';
  if(below>onOrAbove) return 'up';
  return farthestDirection();
}

function effectiveStem(note){
  if(!note || note.rhythm==='whole') return null;
  return note.stem==='auto'?autoStem(note.letter,note.octave):note.stem;
}

export function buildExpected(tonicValue){
  const ascending=ascendingScaleWithOctaves(tonicValue);
  const measure1=ascending.slice(0,7).map((note,index)=>({...note,rhythm:index===0?'quarter':'eighth',measure:1}));
  const measure2=[ascending[7],...ascending.slice(1,7).reverse()].map((note,index)=>({...note,rhythm:index===0?'quarter':'eighth',measure:2}));
  const low={...ascending[0],rhythm:'whole',measure:3};
  const output=[...measure1,...measure2,low];
  const groups=[[1,2],[3,4,5,6],[8,9],[10,11,12,13]];
  groups.forEach((group,groupIndex)=>group.forEach(index=>{output[index].beamGroup=groupIndex+1;}));
  output.forEach(note=>{note.stem=note.rhythm==='whole'?null:autoStem(note.letter,note.octave);});
  groups.forEach(group=>{
    const direction=beamStemDirectionFromNotes(group.map(index=>output[index]));
    group.forEach(index=>{output[index].stem=direction;});
  });
  return output;
}

function percent(correct,total){
  return total?Math.round((correct/total)*100):null;
}

function makeEvidence(flags){
  const applicable=flags.filter(flag=>flag!==null);
  const correct=applicable.filter(Boolean).length;
  return {flags,correct,total:applicable.length,score:percent(correct,applicable.length)};
}

function beamGroupSignatures(notes){
  const groups=new Map();
  notes.forEach((note,index)=>{
    if(!note || !note.beamGroup) return;
    if(!groups.has(note.beamGroup)) groups.set(note.beamGroup,[]);
    groups.get(note.beamGroup).push(index);
  });
  return [...groups.values()].map(indices=>indices.sort((a,b)=>a-b).join('-')).sort();
}

function weightedScore(evidence){
  let weightedTotal=0;
  let activeWeight=0;
  Object.entries(evidence).forEach(([code,item])=>{
    if(!item || !Number.isFinite(item.score)) return;
    const weight=LO_WEIGHTS[code]||0;
    if(weight<=0) return;
    weightedTotal+=item.score*weight;
    activeWeight+=weight;
  });
  return activeWeight?Math.round(weightedTotal/activeWeight):null;
}

function normalizeNote(note,index){
  if(!note || typeof note!=='object' || Array.isArray(note)){
    throw new ScoringValidationError(`Invalid note at slot ${index+1}`);
  }
  const letter=String(note.letter||'');
  const octave=Number(note.octave);
  const accidental=note.accidental==null?'':String(note.accidental);
  const rhythm=String(note.rhythm||'');
  const stem=note.stem==null?null:String(note.stem);
  const beamGroup=note.beam_group??note.beamGroup??null;
  if(!LETTERS.includes(letter)) throw new ScoringValidationError(`Invalid pitch letter at slot ${index+1}`);
  if(!Number.isInteger(octave) || octave<0 || octave>9) throw new ScoringValidationError(`Invalid octave at slot ${index+1}`);
  accidentalOffset(accidental);
  if(!['whole','half','quarter','eighth','sixteenth'].includes(rhythm)) throw new ScoringValidationError(`Invalid rhythm at slot ${index+1}`);
  if(rhythm==='whole'){
    if(stem!==null && stem!=='auto') throw new ScoringValidationError(`Whole note cannot carry a scored stem at slot ${index+1}`);
  }else if(!['up','down','auto'].includes(stem)){
    throw new ScoringValidationError(`Invalid stem at slot ${index+1}`);
  }
  if(beamGroup!==null && !['string','number'].includes(typeof beamGroup)) throw new ScoringValidationError(`Invalid beam group at slot ${index+1}`);
  return {letter,octave,accidental,rhythm,stem,beamGroup};
}

export function normalizeResponse(responseJson){
  if(!responseJson || typeof responseJson!=='object' || Array.isArray(responseJson)){
    throw new ScoringValidationError('response_json must be an object');
  }
  if(!Array.isArray(responseJson.notes) || responseJson.notes.length!==15){
    throw new ScoringValidationError('Major Scale response must contain exactly 15 notes');
  }
  return responseJson.notes.map(normalizeNote);
}

export function evaluateMajorScaleResponse(tonicValue,responseJson){
  const expected=buildExpected(tonicValue);
  const actual=normalizeResponse(responseJson);
  const expectedBeamGroups=[[1,2],[3,4,5,6],[8,9],[10,11,12,13]];

  const bn01Flags=expected.map((expectedNote,index)=>actual[index].letter===expectedNote.letter);
  const bn06Flags=[];
  [0,7].forEach(index=>{
    const note=actual[index];
    const onMiddleLine=pitchToStep(note.letter,note.octave)===4;
    bn06Flags.push(
      note.rhythm==='whole'?false:
      onMiddleLine?true:
      effectiveStem(note)===autoStem(note.letter,note.octave)
    );
  });
  expectedBeamGroups.forEach(indices=>{
    const notes=indices.map(index=>actual[index]);
    const direction=beamStemDirectionFromNotes(notes);
    const stemmed=notes.filter(note=>note.rhythm!=='whole');
    bn06Flags.push(stemmed.length===notes.length && stemmed.every(note=>effectiveStem(note)===direction));
  });

  const rh01Flags=expected.map((expectedNote,index)=>actual[index].rhythm===expectedNote.rhythm);
  const expectedSignatures=expectedBeamGroups.map(group=>group.join('-')).sort();
  const actualSignatures=beamGroupSignatures(actual);
  const gr02Flags=expectedSignatures.map(signature=>actualSignatures.includes(signature));
  gr02Flags.push(actualSignatures.every(signature=>expectedSignatures.includes(signature)));
  const ms03Flags=expected.map((expectedNote,index)=>(actual[index].accidental||'')===(expectedNote.accidental||''));

  const lo={
    BN01_TREBLE_PITCH:makeEvidence(bn01Flags),
    BN06_STEM_DIRECTION:makeEvidence(bn06Flags),
    RH01_DURATION_VALUE:makeEvidence(rh01Flags),
    GR02_PRIMARY_BEAM:makeEvidence(gr02Flags),
    MS03_SCALE_ACCIDENTAL:makeEvidence(ms03Flags)
  };
  return {score:weightedScore(lo),lo,expected};
}

export function skillResultsForPersistence(lo){
  return Object.entries(lo).map(([skill_code,evidence])=>({
    skill_code,
    correct_count:evidence.correct,
    total_count:evidence.total,
    score:evidence.score,
    evidence_flags:evidence.flags
  }));
}

export function scoreMajorScaleAttempt(itemCode,responseJson){
  const result=evaluateMajorScaleResponse(String(itemCode||''),responseJson);
  return {
    score:result.score,
    skill_results:skillResultsForPersistence(result.lo)
  };
}
