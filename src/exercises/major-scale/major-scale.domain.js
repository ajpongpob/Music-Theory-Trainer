(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp || {};
const {KEYS,LEVEL_KEYS,LO_WEIGHTS}=app.majorScaleConfig;
const LETTERS=["C","D","E","F","G","A","B"], MAJOR_INTERVALS=[0,2,4,5,7,9,11,12];
const NATURAL_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};

function parseTonic(s){return{letter:s[0],accidental:s.slice(1)}}
function accidentalOffset(a){return app.notationCore.accidentalOffset(a);}
function notePc(l,a){return(NATURAL_PC[l]+accidentalOffset(a)+12)%12}
function buildMajorScale(key){
 const tonic=parseTonic(key.tonic), start=LETTERS.indexOf(tonic.letter), tonicPc=notePc(tonic.letter,tonic.accidental);
 return MAJOR_INTERVALS.map((semi,i)=>{
   const letter=LETTERS[(start+i)%7], target=(tonicPc+semi)%12, nat=NATURAL_PC[letter];
   const diff=(target-nat+12)%12;
   const spellings={0:"",1:"#",2:"##",10:"bb",11:"b"};
   if(!Object.prototype.hasOwnProperty.call(spellings,diff))throw new Error("คีย์นี้ต้องใช้เครื่องหมายเกิน Double Sharp/Flat");
   return{letter,accidental:spellings[diff]};
 });
}
function ascendingScaleWithOctaves(key){
 const s=buildMajorScale(key); let octave=4,prev=LETTERS.indexOf(s[0].letter);
 return s.map((n,i)=>{const idx=LETTERS.indexOf(n.letter);if(i>0&&idx<=prev)octave++;prev=idx;return{...n,octave}});
}
function percent(correct,total){
  return total ? Math.round((correct/total)*100) : null;
}

function weightedScore(evidence){
  let weightedTotal=0;
  let activeWeight=0;

  Object.entries(evidence).forEach(([id,item])=>{
    if(!item || !Number.isFinite(item.score)) return;
    const weight=LO_WEIGHTS[id] || 0;
    if(weight<=0) return;
    weightedTotal+=item.score*weight;
    activeWeight+=weight;
  });

  return activeWeight ? Math.round(weightedTotal/activeWeight) : null;
}

function makeEvidence(flags){
  // null means that this LO is not applicable for this response (for
  // example, a whole note has no stem). It must not become a second penalty.
  const applicable=flags.filter(flag=>flag!==null);
  const correct=applicable.filter(Boolean).length;
  const total=applicable.length;
  return{
    flags,
    correct,
    total,
    score:percent(correct,total)
  };
}

function shuffle(array,random=Math.random){
  const a=[...array];

  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }

  return a;
}

function createSessionBag(level,previousTonic,random=Math.random){
  const allowed=KEYS.filter(
    k=>LEVEL_KEYS[level].includes(k.tonic)
  );

  if(!allowed.length){
    return [];
  }

  const bag=shuffle(allowed,random);

  // At a cycle boundary, avoid immediately repeating the key
  // that was just completed when another key is available.
  if(
    previousTonic &&
    bag.length>1 &&
    bag[0].tonic===previousTonic
  ){
    const swapIndex=bag.findIndex(
      item=>item.tonic!==previousTonic
    );

    if(swapIndex>0){
      [bag[0],bag[swapIndex]]=
        [bag[swapIndex],bag[0]];
    }
  }

  return bag;
}

function takeNextQuestion({level,sessionBag,masteryPriorityItemCodes,previousTonic},random=Math.random){
  let bag=[...sessionBag];
  const allowedTonics=
    LEVEL_KEYS[level] || [];

  const priorityCode=
    (masteryPriorityItemCodes || [])
      .find(code=>allowedTonics.includes(code));

  if(priorityCode){
    if(!bag.length){
      bag=createSessionBag(level,previousTonic,random);
    }

    const bagIndex=
      bag.findIndex(
        item=>item.tonic===priorityCode
      );

    if(bagIndex>=0){
      const [priorityItem]=
        bag.splice(bagIndex,1);

      return {key:priorityItem,bag,priority:true};
    }

    const priorityItem=
      KEYS.find(
        item=>item.tonic===priorityCode
      );

    if(priorityItem){
      return {key:priorityItem,bag,priority:true};
    }
  }

  if(!bag.length){
    bag=createSessionBag(level,previousTonic,random);
  }

  return {key:bag.shift() || null,bag,priority:false};
}


// Existing notation rules are supplied by the legacy runtime, never reimplemented here.
function createRules({autoStem,beamStemDirectionFromNotes,pitchToStep,effectiveStem,beamGroupSignatures}){
function buildExpected(key){
 const asc=ascendingScaleWithOctaves(key); // degrees 1..8
 const m1=asc.slice(0,7).map((n,i)=>({...n,rhythm:i===0?"quarter":"eighth",measure:1}));
 const m2=[asc[7],...asc.slice(1,7).reverse()].map((n,i)=>({...n,rhythm:i===0?"quarter":"eighth",measure:2}));
 const low={...asc[0],rhythm:"whole",measure:3};
 let out=[...m1,...m2,low];
 // Beaming pattern requested:
 // beat 2 = one pair of eighth notes
 // beats 3–4 = four eighth notes under one beam
 // Same pattern in measures 1 and 2.
 const beamGroups=[[1,2],[3,4,5,6],[8,9],[10,11,12,13]];
 beamGroups.forEach((group,g)=>group.forEach(idx=>out[idx].beamGroup=g+1));

 out=out.map(n=>({...n,stem:n.rhythm==="whole"?null:autoStem(n.letter,n.octave)}));

 // A beamed group has one unified stem direction.
 beamGroups.forEach(group=>{
   const dir=beamStemDirectionFromNotes(group.map(idx=>out[idx]));
   group.forEach(idx=>{ out[idx].stem=dir; });
 });

 return out;
}

function evaluateAnswer(expected,actual){

  const scaleCheckIndices=Array.from({length:15},(_,i)=>i);
  const expectedBeamGroups=[
    [1,2],
    [3,4,5,6],
    [8,9],
    [10,11,12,13]
  ];

  /* BN01 — Treble staff position
     Accidental is intentionally excluded here.
     The staff position must match the correct letter + octave. */
  const bn01Flags=expected.map((x,i)=>{
    const n=actual[i];
    return !!n &&
      pitchToStep(n.letter,n.octave)===
      pitchToStep(x.letter,x.octave);
  });

  /* BN06 — Stem direction
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
  });

  expectedBeamGroups.forEach(indices=>{
    const notes=indices.map(i=>actual[i]);
    if(notes.some(n=>!n)){
      bn06Flags.push(false);
      return;
    }
    const direction=beamStemDirectionFromNotes(notes);
    const stemmed=notes.filter(n=>n.rhythm!=="whole");
    bn06Flags.push(
      stemmed.length===notes.length &&
      stemmed.every(n=>effectiveStem(n)===direction)
    );
  });

  /* RH01 — Duration value */
  const rh01Flags=expected.map((x,i)=>{
    const n=actual[i];
    return !!n && n.rhythm===x.rhythm;
  });

  /* GR02 — Primary beam
     Four expected group units + one "no unexpected group" unit.
     Internal beamGroup IDs are irrelevant; only exact membership matters. */
  const expectedSignatures=expectedBeamGroups
    .map(g=>g.join("-"))
    .sort();

  const actualSignatures=beamGroupSignatures(actual);

  const gr02Flags=expectedSignatures.map(
    sig=>actualSignatures.includes(sig)
  );

  gr02Flags.push(
    actualSignatures.every(sig=>expectedSignatures.includes(sig))
  );

  /* MS03 — Scale accidental
     Check the same scale positions, including the final tonic. */
  const ms03Flags=scaleCheckIndices.map(i=>{
    const n=actual[i];
    return !!n &&
      (n.accidental||"")===(expected[i].accidental||"");
  });

  const lo={
    BN01_TREBLE_PITCH:makeEvidence(bn01Flags),
    BN06_STEM_DIRECTION:makeEvidence(bn06Flags),
    RH01_DURATION_VALUE:makeEvidence(rh01Flags),
    GR02_PRIMARY_BEAM:makeEvidence(gr02Flags),
    MS03_SCALE_ACCIDENTAL:makeEvidence(ms03Flags)
  };

  const score=weightedScore(lo);

  return{
    score,
    lo,
    expected
  };
}


  return Object.freeze({buildExpected,evaluateAnswer});
}
app.majorScaleDomain=Object.freeze({buildMajorScale,ascendingScaleWithOctaves,createSessionBag,takeNextQuestion,createRules,percent,weightedScore});
})();
