
(() => {
"use strict";

const KEYS=[
{name:"C major",tonic:"C",acc:0,type:"natural"},
{name:"G major",tonic:"G",acc:1,type:"sharp"},{name:"D major",tonic:"D",acc:2,type:"sharp"},
{name:"A major",tonic:"A",acc:3,type:"sharp"},{name:"E major",tonic:"E",acc:4,type:"sharp"},
{name:"B major",tonic:"B",acc:5,type:"sharp"},{name:"F# major",tonic:"F#",acc:6,type:"sharp"},
{name:"C# major",tonic:"C#",acc:7,type:"sharp"},
{name:"F major",tonic:"F",acc:1,type:"flat"},{name:"Bb major",tonic:"Bb",acc:2,type:"flat"},
{name:"Eb major",tonic:"Eb",acc:3,type:"flat"},{name:"Ab major",tonic:"Ab",acc:4,type:"flat"},
{name:"Db major",tonic:"Db",acc:5,type:"flat"},{name:"Gb major",tonic:"Gb",acc:6,type:"flat"},
{name:"Cb major",tonic:"Cb",acc:7,type:"flat"},
...["G#","D#","A#","E#","B#","F##","C##"].map((tonic,i)=>({name:tonic.replace('##','𝄪')+' major',tonic,acc:8+i,type:"sharp"})),
...["Fb","Bbb","Ebb","Abb","Dbb","Gbb","Cbb"].map((tonic,i)=>({name:tonic.replace('bb','𝄫')+' major',tonic,acc:8+i,type:"flat"}))];
const SHARP_ORDER=["F","C","G","D","A","E","B"], FLAT_ORDER=["B","E","A","D","G","C","F"];
const LETTERS=["C","D","E","F","G","A","B"], MAJOR_INTERVALS=[0,2,4,5,7,9,11,12];
const NATURAL_PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};

const LEVEL_KEYS={
  1:["C","F","Bb","G","D"],
  2:["A","E","B","Eb","Ab","Db"],
  3:["Gb","Cb","F#","C#","G#","Fb","D#","Bbb"],
  4:["A#","Ebb","E#","Abb","B#","Dbb","F##","Gbb","C##","Cbb"]
};

const LO_META={
  BN01_TREBLE_PITCH:{
    code:"BN01_TREBLE_PITCH",
    short:"Treble Pitch",
    th:"ตำแหน่งระดับเสียงบนกุญแจซอล"
  },
  BN06_STEM_DIRECTION:{
    code:"BN06_STEM_DIRECTION",
    short:"Stem Direction",
    th:"ทิศทางก้านโน้ต"
  },
  RH01_DURATION_VALUE:{
    code:"RH01_DURATION_VALUE",
    short:"Duration Value",
    th:"ค่าความยาวตัวโน้ต"
  },
  GR02_PRIMARY_BEAM:{
    code:"GR02_PRIMARY_BEAM",
    short:"Primary Beam",
    th:"การเชื่อม Primary Beam"
  },
  MS03_SCALE_ACCIDENTAL:{
    code:"MS03_SCALE_ACCIDENTAL",
    short:"Scale Accidental",
    th:"Accidental ของ Scale Degree"
  }
};

/* Scoring policy: preserve LO codes/JSON keys; only the computed score uses
   these weights. Mastery is decided at the 5-question session level. */
const LO_WEIGHTS={
  BN01_TREBLE_PITCH:30,
  BN06_STEM_DIRECTION:10,
  RH01_DURATION_VALUE:15,
  GR02_PRIMARY_BEAM:15,
  MS03_SCALE_ACCIDENTAL:30
};

const MASTERY_CRITERIA={
  overall:90,
  perLO:{
    BN01_TREBLE_PITCH:90,
    BN06_STEM_DIRECTION:85,
    RH01_DURATION_VALUE:85,
    GR02_PRIMARY_BEAM:85,
    MS03_SCALE_ACCIDENTAL:90
  }
};

const state={
 key:KEYS[0],
 signatureMode:"hidden",
 notes:Array(15).fill(null),
 selectedIds:new Set(),
 tool:{rhythm:"quarter",accidental:"",stem:"up"},
 cursorIndex:0,
 cursorStaffStep:0,
 lastScore:null,
 sessionQueue:[],
 sessionBag:[],
 sessionLength:null,
 level:1,
 questionIndex:0,
 sessionResults:[],
 sessionComplete:false,
 isTransitioning:false,
 smuflFontReady:null,
 mobileRangeSelectMode:false,
 selectionAnchorIndex:-1,
 mobileRangeAnchorIndex:-1,
 selectionIsExplicit:false,
 practiceSessionId:null,
 practiceSessionGeneration:0,
 practiceSessionPromise:null,
 attemptSaveChain:Promise.resolve(),
 masteryPriorityItemCodes:[]
};

function parseTonic(s){return{letter:s[0],accidental:s.slice(1)}}
function accidentalOffset(a){
 const offsets={"":0,"#":1,"b":-1,"##":2,"bb":-2};
 if(!Object.prototype.hasOwnProperty.call(offsets,a))throw new Error("รองรับเครื่องหมายถึง Double Sharp/Flat เท่านั้น");
 return offsets[a];
}
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
function autoStem(letter,octave){
 const diatonic=octave*7+LETTERS.indexOf(letter),b4=4*7+LETTERS.indexOf("B");
 return diatonic>=b4?"down":"up";
}

function beamStemDirectionFromNotes(notes){
  // Treble-staff middle line is B4 => staff step 4.
  // Two-note groups: the note farther from the middle line determines
  // the direction; an equal balance defaults down for instrumental notation.
  // Three or more: majority on/above middle line => down,
  // majority below => up; a tie falls back to the farthest note,
  // then to the instrumental default (down).
  const steps=notes.filter(Boolean).map(n=>pitchToStep(n.letter,n.octave));
  if(!steps.length) return "down";

  const middle=4;

  if(steps.length===1){
    return steps[0]>=middle ? "down" : "up";
  }

  const farthestDirection=()=>{
    const above=Math.max(0,...steps.map(s=>Math.max(0,s-middle)));
    const below=Math.max(0,...steps.map(s=>Math.max(0,middle-s)));
    if(above>below) return "down";
    if(below>above) return "up";
    return "down";
  };

  if(steps.length===2) return farthestDirection();

  const onOrAbove=steps.filter(s=>s>=middle).length;
  const below=steps.filter(s=>s<middle).length;

  if(onOrAbove>below) return "down";
  if(below>onOrAbove) return "up";
  return farthestDirection();
}

/* Fixed 3-measure pattern:
   M1: scale degrees 1-7 = quarter + six eighths
   M2: degrees 8-2 descending = quarter + six eighths
   M3: low tonic = whole
*/
function buildExpected(key=state.key){
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

const NS="http://www.w3.org/2000/svg";

/* v0.5.0 — SMuFL engraving core
   Bravura is the scoring font. Geometry is derived from staff-space units.
   SMuFL convention: 1 staff space = 0.25 em, therefore music em = 4sp. */
const SMUFL_FONT="TrainerBravura";
const SMUFL={
  gClef:"\uE050",
  timeSig4:"\uE084",
  noteheadWhole:"\uE0A2",
  noteheadHalf:"\uE0A3",
  noteheadBlack:"\uE0A4",
  note8thUp:"\uE1D7",
  note8thDown:"\uE1D8",
  metNote8thUp:"\uECA7",
  metNote8thDown:"\uECA8",
  flag8thUp:"\uE240",
  flag8thDown:"\uE241",
  flag16thUp:"\uE242",
  flag16thDown:"\uE243",
  accidentalFlat:"\uE260",
  accidentalNatural:"\uE261",
  accidentalSharp:"\uE262",
  accidentalDoubleSharp:"\uE263",
  accidentalDoubleFlat:"\uE264"
};

function musicEm(staffObj){ return staffObj.spacing*4; }
function sp(staffObj,value=1){ return staffObj.spacing*value; }

function accidentalSmuflGlyph(value){
  return {
    "b":SMUFL.accidentalFlat,
    "":SMUFL.accidentalNatural,
    "#":SMUFL.accidentalSharp,
    "##":SMUFL.accidentalDoubleSharp,
    "bb":SMUFL.accidentalDoubleFlat
  }[value] ?? "";
}
function el(name,attrs={},text=""){const n=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n}
function pitchToStep(letter,octave){return octave*7+LETTERS.indexOf(letter)-(4*7+LETTERS.indexOf("E"))}
function stepToPitch(step){const idx=4*7+LETTERS.indexOf("E")+step;return{letter:LETTERS[(idx%7+7)%7],octave:Math.floor(idx/7)}}

function drawSignature(svg,key,signatureMode,staff){
 if(signatureMode!=="shown"||key.acc===0)return;

 const symbols=key.type==="sharp"?SHARP_ORDER.slice(0,key.acc):FLAT_ORDER.slice(0,key.acc);
 const sharpSteps={F:8,C:5,G:9,D:6,A:3,E:7,B:4};
 const flatSteps={B:4,E:7,A:3,D:6,G:2,C:5,F:1};
 const glyph=key.type==="sharp"?SMUFL.accidentalSharp:SMUFL.accidentalFlat;
 const fontSize=musicEm(staff);
 const advance=sp(staff,1.05);

 symbols.forEach((letter,i)=>{
   const step=key.type==="sharp"?sharpSteps[letter]:flatSteps[letter];
   const y=staff.top+staff.spacing*4-step*(staff.spacing/2);

   svg.appendChild(el("text",{
     x:staff.sigX+i*advance,
     y,
     "font-size":fontSize,
     "font-family":SMUFL_FONT,
     fill:"#111",
     class:"key-signature-glyph",
     "pointer-events":"none"
   },glyph));
 });
}

function rightEdgeOfSvgClass(svg,className){
 let right=-Infinity;
 svg.querySelectorAll("."+className).forEach(node=>{
   try{
     const box=node.getBBox();
     right=Math.max(right,box.x+box.width);
   }catch(err){}
 });
 return Number.isFinite(right)?right:null;
}

function drawTimeSignature(svg,staff,x){
 const glyph=SMUFL.timeSig4;
 const fontSize=musicEm(staff);
 const box=measureSvgTextGlyph(svg,glyph,fontSize,SMUFL_FONT);

 // Visible left edge starts exactly at x.
 const textX=x-box.x;
 const centers=[
   staff.top+staff.spacing,
   staff.top+staff.spacing*3
 ];

 centers.forEach(centerY=>{
   const textY=centerY-(box.y+box.height/2);
   svg.appendChild(el("text",{
     x:textX,
     y:textY,
     "font-size":fontSize,
     "font-family":SMUFL_FONT,
     fill:"#111",
     class:"time-signature-glyph",
     "pointer-events":"none"
   },glyph));
 });
}
function drawLedger(svg,x,step,stepToY){
 const ys=[];if(step<0){for(let s=-2;s>=step;s-=2)ys.push(stepToY(s))}
 else if(step>8){for(let s=10;s<=step;s+=2)ys.push(stepToY(s))}
 ys.forEach(y=>svg.appendChild(el("line",{x1:x-18,y1:y,x2:x+18,y2:y,stroke:"#111","stroke-width":1.4})));
}

/* Example */
const exampleSvg=document.getElementById("exampleSvg");
function drawExample(){
 const svg=exampleSvg, staff={x1:88,x2:1065,top:68,spacing:17,sigX:120};
 const stepToY=s=>staff.top+staff.spacing*4-s*(staff.spacing/2);
 svg.innerHTML="";svg.appendChild(el("rect",{x:0,y:0,width:1100,height:205,fill:"#fff"}));
 for(let i=0;i<5;i++){const y=staff.top+i*staff.spacing;svg.appendChild(el("line",{x1:staff.x1,y1:y,x2:staff.x2,y2:y,stroke:"#1d2939","stroke-width":1.55}))}
 svg.appendChild(el("text",{
   x:staff.x1,
   y:staff.top + staff.spacing*3,
   "font-size":musicEm(staff),
   "font-family":SMUFL_FONT,
   fill:"#111",
   "pointer-events":"none"
 },SMUFL.gClef));
 drawTimeSignature(svg,staff,142);
 const exp=buildExpected(KEYS[0]);
 const xs=[185,250,305,360,415,470,525, 620,685,740,795,850,905,960, 1020];
 const barXs=[570,990,1058];
 exp.forEach((n,i)=>{
   const x=xs[i],step=pitchToStep(n.letter,n.octave),y=stepToY(step);drawLedger(svg,x,step,stepToY);
   const open=n.rhythm==="whole";
   const useSmuflHead=n.rhythm==="whole" || n.rhythm==="eighth";

   if(useSmuflHead){
     const fontSize=musicEm(staff);
     const glyph=n.rhythm==="whole" ? SMUFL.noteheadWhole : SMUFL.noteheadBlack;
     const box=measureSvgTextGlyph(svg,glyph,fontSize,SMUFL_FONT);
     const textX=x-(box.x+box.width/2);
     svg.appendChild(el("text",{
       x:textX,
       y,
       "font-size":fontSize,
       "font-family":SMUFL_FONT,
       fill:"#111",
       class:`smufl-notehead smufl-notehead-${n.rhythm}`,
       "pointer-events":"none"
     },glyph));
   }else{
     svg.appendChild(el("ellipse",{
       cx:x,cy:y,rx:10.5,ry:7.2,
       fill:"#111",stroke:"#111","stroke-width":2,
       transform:`rotate(-18 ${x} ${y})`
     }));
   }
   if(!open && !n.beamGroup){
     const dir=n.stem,xsStem=dir==="up"?x+9:x-9,endY=dir==="up"?y-48:y+48;
     svg.appendChild(el("line",{x1:xsStem,y1:y,x2:xsStem,y2:endY,stroke:"#111","stroke-width":2}));
   }
 });
 // beams based on expected groups
 const groups={};exp.forEach((n,i)=>{if(n.beamGroup)(groups[n.beamGroup]||=[]).push(i)});
 Object.values(groups).forEach(ids=>{
   const first=ids[0],last=ids[ids.length-1],dir=exp[first].stem;
   const ends=ids.map(i=>{const y=stepToY(pitchToStep(exp[i].letter,exp[i].octave));return y+(dir==="up"?-48:48)});
   const beamY=dir==="up"?Math.min(...ends):Math.max(...ends);
   const x1=xs[first]+(dir==="up"?9:-9),x2=xs[last]+(dir==="up"?9:-9),t=7;
   ids.forEach(i=>{const y=stepToY(pitchToStep(exp[i].letter,exp[i].octave)),sx=xs[i]+(dir==="up"?9:-9);svg.appendChild(el("line",{x1:sx,y1:y,x2:sx,y2:beamY,stroke:"#111","stroke-width":2}))});
   svg.appendChild(el("polygon",{points:`${x1},${beamY} ${x2},${beamY} ${x2},${beamY+(dir==="up"?t:-t)} ${x1},${beamY+(dir==="up"?t:-t)}`,fill:"#111"}));
 });
 // Measure barlines + final double barline
 [570,990].forEach(x=>svg.appendChild(el("line",{x1:x,y1:staff.top,x2:x,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":1.7})));
 svg.appendChild(el("line",{x1:1050,y1:staff.top,x2:1050,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":1.4}));
 svg.appendChild(el("line",{x1:1058,y1:staff.top,x2:1058,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":3.2}));

}

// Auth Gate may initialize this SVG while its parent is display:none. In that
// state browsers report zero glyph bounds, which shifts noteheads and the 4/4
// time signature. Re-engrave once the authenticated trainer becomes visible.
window.addEventListener("major-scale-trainer-visible",drawExample);

/* Main score */
const scoreSvg=document.getElementById("scoreSvg");
const staff={x1:95,x2:1360,top:110,spacing:18,sigX:125};
const baseNoteXs=[210,265,320,375,430,485,540, 640,695,750,805,860,915,970, 1080];
const noteXs=[...baseNoteXs];
const MIN_STAFF_STEP=-14;
const MAX_STAFF_STEP=20;
let beamGroupSerial=0;
function newBeamGroupId(){
  beamGroupSerial+=1;
  return `beam-${Date.now()}-${beamGroupSerial}`;
}
function clampStaffStep(step){
  return Math.max(MIN_STAFF_STEP,Math.min(MAX_STAFF_STEP,step));
}


function noteheadHalfWidthForRhythm(svg,rhythm,staffObj=staff){
  const glyph=
    rhythm==="whole" ? SMUFL.noteheadWhole :
    rhythm==="half" ? SMUFL.noteheadHalf :
    rhythm==="eighth" ? SMUFL.noteheadBlack :
    null;

  if(glyph){
    const box=measureSvgTextGlyph(svg,glyph,musicEm(staffObj),SMUFL_FONT);
    if(box && box.width>0) return box.width/2;
  }

  // Existing custom ellipse noteheads (quarter/sixteenth).
  return 10.8;
}



function visibleAccidentalForNote(note){
  if(!note) return "";
  if(state.signatureMode==="shown") return "";
  return note.accidental || "";
}

function noteVisualHalfWidth(svg,note,staffObj=staff){
  return noteheadHalfWidthForRhythm(
    svg,
    note ? note.rhythm : "quarter",
    staffObj
  );
}

function accidentalVisualWidth(svg,accidental,staffObj=staff){
  const glyph=accidentalSmuflGlyph(accidental);
  if(!glyph) return 0;

  const box=measureSvgTextGlyph(
    svg,
    glyph,
    musicEm(staffObj),
    SMUFL_FONT
  );

  return box && box.width>0 ? box.width : 0;
}

function slotLeftExtent(svg,index,staffObj=staff){
  const note=state.notes[index];
  const headHalf=noteVisualHalfWidth(svg,note,staffObj);
  const accidental=visibleAccidentalForNote(note);

  if(!accidental){
    return headHalf;
  }

  const accWidth=accidentalVisualWidth(svg,accidental,staffObj);
  const accidentalToNoteGap=sp(staffObj,0.30);

  return headHalf+accidentalToNoteGap+accWidth;
}

function slotRightExtent(svg,index,staffObj=staff){
  return noteVisualHalfWidth(svg,state.notes[index],staffObj);
}

/* v0.5.7
   Solve the complete measure horizontally inside fixed boundaries.

   Unlike the previous cumulative-push resolver, this function knows the
   left and right boundary BEFORE positioning notes. Therefore no note can
   be pushed across the following barline.

   Each slot reserves:
     [accidental if visible] + accidental gap + notehead
   and every adjacent pair receives an engraving gap.
*/
function layoutMeasureWithinBounds(
  svg,
  indices,
  leftBoundary,
  rightBoundary,
  options={}
){
  if(!indices.length) return;

  const leadingPad=options.leadingPad ?? sp(staff,0.35);
  const trailingPad=options.trailingPad ?? sp(staff,0.55);
  const preferredGap=options.preferredGap ?? sp(staff,0.40);
  const minimumGap=options.minimumGap ?? sp(staff,0.12);

  const innerLeft=leftBoundary+leadingPad;
  const innerRight=rightBoundary-trailingPad;
  const available=Math.max(0,innerRight-innerLeft);

  const leftExtents=indices.map(i=>slotLeftExtent(svg,i,staff));
  const rightExtents=indices.map(i=>slotRightExtent(svg,i,staff));

  if(indices.length===1){
    const i=indices[0];
    const minX=innerLeft+leftExtents[0];
    const maxX=innerRight-rightExtents[0];

    noteXs[i]=Math.max(
      minX,
      Math.min(baseNoteXs[i],maxX)
    );
    return;
  }

  // Horizontal width occupied by glyphs alone, excluding gaps.
  let glyphWidth=leftExtents[0]+rightExtents[rightExtents.length-1];

  for(let p=1;p<indices.length;p++){
    glyphWidth+=rightExtents[p-1]+leftExtents[p];
  }

  const gapCount=indices.length-1;

  // Prefer conventional spacing, but shrink gaps gracefully if the measure
  // contains wide accidentals. Never allow the layout to exceed the barline.
  let gap=(available-glyphWidth)/gapCount;

  if(Number.isFinite(gap)){
    gap=Math.min(preferredGap,Math.max(minimumGap,gap));
  }else{
    gap=preferredGap;
  }

  let required=glyphWidth+gap*gapCount;

  // Normally all current scale-writing combinations fit comfortably.
  // If an extreme future glyph set does not, reduce the gap to the exact
  // available value rather than allowing any note to cross a barline.
  if(required>available){
    gap=Math.max(
      0,
      (available-glyphWidth)/gapCount
    );
    required=glyphWidth+gap*gapCount;
  }

  // Remaining horizontal room is distributed according to the original
  // slot-spacing proportions, retaining the established rhythmic layout.
  const extra=Math.max(0,available-required);

  const baseDistances=[];
  let baseDistanceTotal=0;

  for(let p=1;p<indices.length;p++){
    const d=Math.max(
      1,
      baseNoteXs[indices[p]]-baseNoteXs[indices[p-1]]
    );
    baseDistances.push(d);
    baseDistanceTotal+=d;
  }

  // Put a modest amount of surplus at both measure edges and distribute
  // the rest through the note intervals.
  const edgeShare=Math.min(
    extra*0.18,
    sp(staff,0.55)
  );

  const intervalExtra=Math.max(
    0,
    extra-edgeShare*2
  );

  let x=innerLeft+edgeShare+leftExtents[0];
  noteXs[indices[0]]=x;

  for(let p=1;p<indices.length;p++){
    const proportionalExtra=
      baseDistanceTotal>0
        ? intervalExtra*(baseDistances[p-1]/baseDistanceTotal)
        : intervalExtra/gapCount;

    x+=
      rightExtents[p-1]+
      gap+
      leftExtents[p]+
      proportionalExtra;

    noteXs[indices[p]]=x;
  }

  // Hard final clamp: the final rendered notehead can never pass the
  // right boundary. Normally this correction is zero.
  const lastIndex=indices[indices.length-1];
  const renderedRight=
    noteXs[lastIndex]+rightExtents[rightExtents.length-1];

  const maxRight=rightBoundary-trailingPad;

  if(renderedRight>maxRight){
    const correction=renderedRight-maxRight;
    indices.forEach(i=>{
      noteXs[i]-=correction;
    });
  }

  // Hard left-boundary clamp after any final correction.
  const firstIndex=indices[0];
  const renderedLeft=
    noteXs[firstIndex]-leftExtents[0];

  const minLeft=leftBoundary+leadingPad;

  if(renderedLeft<minLeft){
    const correction=minLeft-renderedLeft;
    indices.forEach(i=>{
      noteXs[i]+=correction;
    });
  }
}

function layoutAllMeasuresWithinBounds(svg){
  const tsRight=rightEdgeOfSvgClass(svg,"time-signature-glyph");

  // Measure 1 begins after the rendered time signature.
  // If measurement ever fails, use the historical score position safely.
  const measure1Left=
    tsRight!==null
      ? tsRight
      : 175;

  layoutMeasureWithinBounds(
    svg,
    [0,1,2,3,4,5,6],
    measure1Left,
    690,
    {
      leadingPad:sp(staff,0.45),
      trailingPad:sp(staff,0.65),
      preferredGap:sp(staff,0.42)
    }
  );

  layoutMeasureWithinBounds(
    svg,
    [7,8,9,10,11,12,13],
    690,
    1225,
    {
      leadingPad:sp(staff,0.65),
      trailingPad:sp(staff,0.65),
      preferredGap:sp(staff,0.42)
    }
  );

  // Final whole-note measure.
  layoutMeasureWithinBounds(
    svg,
    [14],
    1225,
    staff.x2,
    {
      leadingPad:sp(staff,0.70),
      trailingPad:sp(staff,0.70)
    }
  );
}

function resetNoteLayout(){
  baseNoteXs.forEach((x,i)=>{noteXs[i]=x;});
}


function stepToY(step){return staff.top+staff.spacing*4-step*(staff.spacing/2)}
function yToStep(y){return Math.round((staff.top+staff.spacing*4-y)/(staff.spacing/2))}
let compactScore=false;
const COMPACT_X_OFFSETS=[75,550,1085];
const COMPACT_ROW_HEIGHT=220;
function arrangeCompactScore(){
 compactScore=scoreSvg.parentElement.clientWidth<800;
 scoreSvg.setAttribute("viewBox",compactScore?"0 0 700 660":"0 0 1400 350");
 if(!compactScore)return;
 // Reflow existing engraving into one measure per system, retaining the
 // actual note elements and their hit targets (no duplicated note state).
 const nodes=Array.from(scoreSvg.children);
 const headers=[];
 const buckets=[[],[],[]];
 for(const node of nodes){
   if(node.tagName==="rect" && node.getAttribute("width")==="1400")continue;
   if(node.tagName==="line" && node.getAttribute("x1")==="95" && node.getAttribute("x2")==="1360")continue;
   const box=node.getBBox();
   const x=box.x+box.width/2;
   if(node.tagName==="text" && x<200){headers.push(node);continue;}
   buckets[x<=690?0:x<=1225?1:2].push(node);
 }
 scoreSvg.replaceChildren();
 buckets.forEach((nodes,row)=>{
   const dy=row*COMPACT_ROW_HEIGHT-40;
   const system=el("g",{"data-system":row});
   for(let i=0;i<5;i++){
     const y=staff.top+i*staff.spacing+dy;
     system.appendChild(el("line",{x1:20,y1:y,x2:row===0?615:row===1?675:273,y2:y,stroke:"#1d2939","stroke-width":1.7}));
   }
   const header=el("g",{transform:`translate(-75 ${dy})`,"pointer-events":"none"});
   headers.forEach(n=>header.appendChild(n.cloneNode(true)));
   system.appendChild(header);
   const body=el("g",{transform:`translate(${-COMPACT_X_OFFSETS[row]} ${dy})`});
   nodes.forEach(n=>body.appendChild(n));
   system.appendChild(body);
   scoreSvg.appendChild(system);
 });
}

function drawScore(){
 const svg=scoreSvg;
 resetNoteLayout();
 svg.innerHTML="";
 svg.appendChild(el("rect",{x:0,y:0,width:1400,height:350,fill:"#fff"}));
 for(let i=0;i<5;i++){const y=staff.top+i*staff.spacing;svg.appendChild(el("line",{x1:staff.x1,y1:y,x2:staff.x2,y2:y,stroke:"#1d2939","stroke-width":1.7}))}
 svg.appendChild(el("text",{
   x:staff.x1,
   y:staff.top + staff.spacing*3,
   "font-size":musicEm(staff),
   "font-family":SMUFL_FONT,
   fill:"#111",
   "pointer-events":"none"
 },SMUFL.gClef));
 drawSignature(svg,state.key,state.signatureMode,staff);

 const keySigRight=rightEdgeOfSvgClass(svg,"key-signature-glyph");
 const tsX=state.signatureMode==="shown" && keySigRight!==null
   ? keySigRight+sp(staff,0.65)
   : 165;

 drawTimeSignature(svg,staff,tsX);

 // Compute the entire horizontal engraving layout before drawing notes.
 // All note centers are guaranteed to remain inside their own measure.
 layoutAllMeasuresWithinBounds(svg);

 [690,1225].forEach(x=>svg.appendChild(el("line",{x1:x,y1:staff.top,x2:x,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":1.8})));
 svg.appendChild(el("line",{x1:1350,y1:staff.top,x2:1350,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":1.4}));
 svg.appendChild(el("line",{x1:1358,y1:staff.top,x2:1358,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":3.2}));

 // Entry cursor: shows the current slot where a new note will be entered.
 if(state.cursorIndex>=0 && state.cursorIndex<15){
   const cx=noteXs[state.cursorIndex];
   svg.appendChild(el("line",{
     x1:cx,y1:staff.top-28,x2:cx,y2:staff.top+staff.spacing*4+28,
     class:"entry-cursor"
   }));
   if(!state.notes[state.cursorIndex]){
     const cy=stepToY(state.cursorStaffStep);
     drawLedger(svg,cx,state.cursorStaffStep,stepToY);
     svg.appendChild(el("ellipse",{
       cx,cy,rx:10.8,ry:7.2,
       fill:"none",stroke:"#9b6400","stroke-width":1.8,
       "stroke-dasharray":"3 2",
       opacity:.65,
       transform:`rotate(-18 ${cx} ${cy})`,
       "pointer-events":"none"
     }));
   }
 }

 state.notes.forEach((n,i)=>{if(n)drawNote(n,i)});
 drawBeams();
 arrangeCompactScore();
}

function measureSvgTextGlyph(svg,glyph,fontSize,fontFamily){
  // Measure the exact glyph geometry from the same SVG/font used for rendering.
  // A temporary invisible probe avoids relying on font baseline assumptions.
  const probe=el("text",{
    x:0,y:0,
    "font-size":fontSize,
    "font-family":fontFamily,
    visibility:"hidden",
    "pointer-events":"none"
  },glyph);

  svg.appendChild(probe);

  let box={x:0,y:-fontSize*.75,width:fontSize*.55,height:fontSize};
  try{
    const measured=probe.getBBox();
    if(measured && measured.width>0 && measured.height>0){
      box={
        x:measured.x,
        y:measured.y,
        width:measured.width,
        height:measured.height
      };
    }
  }catch(err){
    console.warn("SVG glyph measurement fallback:",err);
  }

  probe.remove();
  return box;
}

function rightEdgeOfTimeSignature(svg){
  let right=-Infinity;

  svg.querySelectorAll(".time-signature-glyph").forEach(node=>{
    try{
      const box=node.getBBox();
      right=Math.max(right,box.x+box.width);
    }catch(err){}
  });

  return Number.isFinite(right) ? right : null;
}

function drawAccidentalForNote(group,accToShow,noteX,noteY,fill,noteIndex){
  const glyph=accidentalSmuflGlyph(accToShow);
  if(!glyph) return;

  const fontSize=musicEm(staff);
  const box=measureSvgTextGlyph(scoreSvg,glyph,fontSize,SMUFL_FONT);

  // SMuFL scoring-font registration places the accidental baseline directly
  // on the staff position of the note. Only horizontal spacing is calculated.
  const note=state.notes[noteIndex];
  const noteHalfWidth=noteheadHalfWidthForRhythm(
    scoreSvg,
    note ? note.rhythm : "quarter",
    staff
  );
  const noteHeadLeft=noteX-noteHalfWidth;
  const accidentalToNoteGap=sp(staff,0.30);
  const targetRight=noteHeadLeft-accidentalToNoteGap;
  const textX=targetRight-(box.x+box.width);

  group.appendChild(el("text",{
    x:textX,
    y:noteY,
    "font-size":fontSize,
    "font-family":SMUFL_FONT,
    fill,
    class:"score-accidental",
    "pointer-events":"none"
  },glyph));
}

function drawNote(n,i){
 const svg=scoreSvg,x=noteXs[i],step=pitchToStep(n.letter,n.octave),y=stepToY(step);drawLedger(svg,x,step,stepToY);
 const selected=state.selectedIds.has(n.id),fill=selected?"#9b6400":"#111",g=el("g",{"data-note-id":n.id,style:"cursor:pointer"});

 // Stable interaction geometry: every note has its own transparent hit area.
 // This is independent from Bravura/SMuFL text glyph pointer behavior.
 // Width stays below inter-note spacing, while vertical coverage includes
 // notehead, stem and flag for both stem directions.
 g.appendChild(el("rect",{
   x:x-21,
   y:y-72,
   width:42,
   height:144,
   fill:"transparent",
   stroke:"none",
   class:"note-hit-target",
   "pointer-events":"all",
   "data-note-id":n.id
 }));

 const open=["whole","half"].includes(n.rhythm);
 const isWhole=n.rhythm==="whole";
 const useSmuflHead=["whole","half","eighth"].includes(n.rhythm);

 if(useSmuflHead){
   const fontSize=musicEm(staff);
   const glyph=
     n.rhythm==="whole" ? SMUFL.noteheadWhole :
     n.rhythm==="half" ? SMUFL.noteheadHalf :
     SMUFL.noteheadBlack;

   const box=measureSvgTextGlyph(svg,glyph,fontSize,SMUFL_FONT);
   const textX=x-(box.x+box.width/2);

   g.appendChild(el("text",{
     x:textX,
     y,
     "font-size":fontSize,
     "font-family":SMUFL_FONT,
     fill,
     class:`smufl-notehead smufl-notehead-${n.rhythm}`,
     "pointer-events":"none"
   },glyph));
 }else{
   g.appendChild(el("ellipse",{
     cx:x,cy:y,rx:10.8,ry:7.2,
     fill:open?"none":fill,
     stroke:fill,
     "stroke-width":2,
     transform:`rotate(-18 ${x} ${y})`
   }));
 }
 const accToShow=state.signatureMode==="shown"?"":n.accidental;
 if(accToShow){
   drawAccidentalForNote(g,accToShow,x,y,fill,i);
 }
 if(n.rhythm!=="whole"){
   const groupItems=n.beamGroup ? state.notes.map((note,idx)=>note&&note.beamGroup===n.beamGroup?{n:note,i:idx}:null).filter(Boolean) : [];
   const dir=groupItems.length>1 ? getBeamDirection(groupItems) : (n.stem==="auto"?autoStem(n.letter,n.octave):n.stem),
   sx=dir==="up"?x+10:x-10,endY=dir==="up"?y-55:y+55;
   if(!n.beamGroup || !["eighth","sixteenth"].includes(n.rhythm)){
     g.appendChild(el("line",{x1:sx,y1:y,x2:sx,y2:endY,stroke:fill,"stroke-width":2.3}));
   }
   if(["eighth","sixteenth"].includes(n.rhythm)&&!n.beamGroup){
     {
       // SMuFL provides separate combining flags for up/down stems.
       // Using the dedicated down glyph prevents the flag from being mirrored.
       const flagGlyph=n.rhythm==="sixteenth"
         ? (dir==="up" ? SMUFL.flag16thUp : SMUFL.flag16thDown)
         : (dir==="up" ? SMUFL.flag8thUp : SMUFL.flag8thDown);

       g.appendChild(el("text",{
         x:sx,
         y:endY,
         "font-size":musicEm(staff),
         "font-family":SMUFL_FONT,
         fill,
         class:`smufl-flag smufl-flag-${n.rhythm}-${dir}`,
         "pointer-events":"none"
       },flagGlyph));
     }
   }
 }
 svg.appendChild(g);
}


/* v0.5.4 — Persistent pointer/selection engine
   All note interaction is delegated to scoreSvg so redraws do not destroy
   active pointer handlers. This also makes Shift+Click reliable. */
const modifierState={
  shift:false
};

window.addEventListener("keydown",ev=>{
  if(ev.key==="Shift") modifierState.shift=true;
},true);

window.addEventListener("keyup",ev=>{
  if(ev.key==="Shift") modifierState.shift=false;
},true);

window.addEventListener("blur",()=>{
  modifierState.shift=false;
});

const noteInteraction={
  active:false,
  pointerId:null,
  noteId:null,
  noteIndex:-1,
  startY:0,
  lastStep:0,
  moved:false,
  additive:false,
  dragSelectionPrepared:false,
  mode:"note",
  rangeAnchorIndex:-1,
  rangeLastIndex:-1
};

function updateRangeSelectButton(){
  const button=document.getElementById("rangeSelectToggle");
  if(!button) return;

  button.classList.toggle("active",state.mobileRangeSelectMode);
  button.setAttribute(
    "aria-pressed",
    state.mobileRangeSelectMode ? "true" : "false"
  );

  if(!state.mobileRangeSelectMode){
    button.textContent="เลือกหลายโน้ต";
    button.title="เลือกหลายโน้ต • M • Desktop: คลิกตัวแรกแล้ว Shift+คลิกตัวสุดท้าย";
  }else if(state.mobileRangeAnchorIndex<0){
    button.textContent="เลือกหลายโน้ต: ตัวแรก";
    button.title="เลือกหลายโน้ต: แตะโน้ตตัวแรก แล้วแตะตัวสุดท้าย หรือแตะค้างแล้วลาก";
  }else{
    button.textContent="เลือกหลายโน้ต: ตัวสุดท้าย";
    button.title="เลือกหลายโน้ต: แตะโน้ตตัวสุดท้ายเพื่อเลือกทั้งช่วง";
  }
}

function setMobileRangeSelectMode(enabled){
  state.mobileRangeSelectMode=!!enabled;
  state.mobileRangeAnchorIndex=-1;
  updateRangeSelectButton();
}

function nearestSlotIndexToX(x){
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

function selectNoteRange(anchorIndex,currentIndex){
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

function noteTargetFromEvent(ev){
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

scoreSvg.addEventListener("pointerdown",ev=>{
  if(state.sessionComplete || state.isTransitioning)return;
  if(ev.pointerType==="mouse" && ev.button!==0) return;

  const local=eventPointInScore(ev);
  if(!local) return;

  // ----------------------------------------------------------
  // Multi-note range selection (touch + mouse button mode)
  // First tap/click defines the anchor. Second tap/click defines the end.
  // Dragging from the first note to the last is also supported.
  // ----------------------------------------------------------
  if(state.mobileRangeSelectMode){
    if(local.y<45 || local.y>275) return;

    const currentIndex=nearestOccupiedIndexToX(local.x);
    if(currentIndex<0) return;

    const anchor=state.mobileRangeAnchorIndex>=0
      ? state.mobileRangeAnchorIndex
      : currentIndex;

    if(state.mobileRangeAnchorIndex<0){
      state.mobileRangeAnchorIndex=currentIndex;
    }

    ev.preventDefault();

    noteInteraction.active=true;
    noteInteraction.pointerId=ev.pointerId;
    noteInteraction.noteId=null;
    noteInteraction.noteIndex=currentIndex;
    noteInteraction.startY=local.y;
    noteInteraction.lastStep=0;
    noteInteraction.moved=false;
    noteInteraction.additive=true;
    noteInteraction.dragSelectionPrepared=false;
    noteInteraction.mode="range";
    noteInteraction.rangeAnchorIndex=anchor;
    noteInteraction.rangeLastIndex=currentIndex;

    scoreSvg.setPointerCapture?.(ev.pointerId);

    selectNoteRange(anchor,currentIndex);
    updateRangeSelectButton();
    render();
    return;
  }

  // ----------------------------------------------------------
  // Normal click / vertical note-drag gesture
  // ----------------------------------------------------------
  const hit=noteTargetFromEvent(ev);
  if(!hit) return;

  ev.preventDefault();

  noteInteraction.active=true;
  noteInteraction.pointerId=ev.pointerId;
  noteInteraction.noteId=hit.id;
  noteInteraction.noteIndex=hit.index;
  noteInteraction.startY=local.y;
  noteInteraction.lastStep=pitchToStep(
    hit.note.letter,
    hit.note.octave
  );
  noteInteraction.moved=false;
  noteInteraction.dragSelectionPrepared=false;
  noteInteraction.mode="note";
  noteInteraction.rangeAnchorIndex=-1;
  noteInteraction.rangeLastIndex=-1;

  // Desktop multi-select remains available with Shift+Click.
  noteInteraction.additive=!!(
    ev.shiftKey ||
    modifierState.shift
  );

  scoreSvg.setPointerCapture?.(ev.pointerId);
});

scoreSvg.addEventListener("pointermove",ev=>{
  if(
    !noteInteraction.active ||
    ev.pointerId!==noteInteraction.pointerId
  ) return;

  const local=eventPointInScore(ev);
  if(!local) return;

  // Horizontal drag selects every existing note between
  // the start slot and current slot.
  if(noteInteraction.mode==="range"){
    const currentIndex=nearestSlotIndexToX(local.x);

    if(currentIndex!==noteInteraction.rangeLastIndex){
      noteInteraction.moved=true;
      noteInteraction.rangeLastIndex=currentIndex;

      selectNoteRange(
        noteInteraction.rangeAnchorIndex,
        currentIndex
      );

      render();
    }
    return;
  }

  const deltaSteps=Math.round(
    (noteInteraction.startY-local.y)/(staff.spacing/2)
  );

  if(deltaSteps===0 && !noteInteraction.moved) return;

  noteInteraction.moved=true;

  const index=state.notes.findIndex(
    n=>n && n.id===noteInteraction.noteId
  );
  if(index<0) return;

  if(
    !noteInteraction.additive &&
    !noteInteraction.dragSelectionPrepared
  ){
    state.selectedIds.clear();
    state.selectedIds.add(noteInteraction.noteId);
    noteInteraction.dragSelectionPrepared=true;
  }

  const note=state.notes[index];
  const targetStep=clampStaffStep(noteInteraction.lastStep+deltaSteps);
  const pitch=stepToPitch(targetStep);
  state.selectionIsExplicit=true;

  note.letter=pitch.letter;
  note.octave=pitch.octave;

  state.cursorIndex=index;
  state.cursorStaffStep=targetStep;

  // Quantize once against pointerdown. Rounding each small pointermove
  // separately accumulates extra semitone/diatonic steps on a scaled staff.

  render();
});

scoreSvg.addEventListener("pointerup",ev=>{
  if(
    !noteInteraction.active ||
    ev.pointerId!==noteInteraction.pointerId
  ) return;

  ev.preventDefault();

  if(noteInteraction.mode==="range"){
    const completedByDrag=noteInteraction.moved;
    const completedBySecondTap=
      state.mobileRangeAnchorIndex>=0 &&
      noteInteraction.rangeLastIndex!==state.mobileRangeAnchorIndex;

    // First tap leaves the mode armed for the final note. A drag or a
    // second tap completes the contiguous range and exits range mode.
    if(completedByDrag || completedBySecondTap){
      setMobileRangeSelectMode(false);
    }else{
      updateRangeSelectButton();
    }

    try{
      scoreSvg.releasePointerCapture?.(ev.pointerId);
    }catch(err){}

    noteInteraction.active=false;
    noteInteraction.pointerId=null;
    noteInteraction.noteId=null;
    noteInteraction.noteIndex=-1;
    noteInteraction.moved=false;
    noteInteraction.dragSelectionPrepared=false;
    noteInteraction.mode="note";
    noteInteraction.rangeAnchorIndex=-1;
    noteInteraction.rangeLastIndex=-1;

    if(!state.sessionComplete) scoreSvg.focus({preventScroll:true});
    return;
  }

  if(!noteInteraction.moved){
    const id=noteInteraction.noteId;

    if(noteInteraction.additive){
      // Desktop range contract: click the first note, then Shift+Click
      // the final note. Every occupied slot between them is selected.
      const anchor=state.selectionAnchorIndex>=0
        ? state.selectionAnchorIndex
        : noteInteraction.noteIndex;
      selectNoteRange(anchor,noteInteraction.noteIndex);
    }else{
      state.selectedIds.clear();
      state.selectedIds.add(id);
      state.selectionIsExplicit=true;
      state.selectionAnchorIndex=noteInteraction.noteIndex;
    }

    state.cursorIndex=noteInteraction.noteIndex;

    const note=state.notes[noteInteraction.noteIndex];
    if(note){
      state.cursorStaffStep=pitchToStep(
        note.letter,
        note.octave
      );
    }

    render();
  }

  try{
    scoreSvg.releasePointerCapture?.(ev.pointerId);
  }catch(err){}

  noteInteraction.active=false;
  noteInteraction.pointerId=null;
  noteInteraction.noteId=null;
  noteInteraction.noteIndex=-1;
  noteInteraction.moved=false;
  noteInteraction.dragSelectionPrepared=false;
  noteInteraction.mode="note";
  noteInteraction.rangeAnchorIndex=-1;
  noteInteraction.rangeLastIndex=-1;

  scoreSvg.focus({preventScroll:true});
});

scoreSvg.addEventListener("pointercancel",ev=>{
  if(
    !noteInteraction.active ||
    ev.pointerId!==noteInteraction.pointerId
  ) return;

  if(noteInteraction.mode==="range"){
    setMobileRangeSelectMode(false);
  }

  noteInteraction.active=false;
  noteInteraction.pointerId=null;
  noteInteraction.noteId=null;
  noteInteraction.noteIndex=-1;
  noteInteraction.moved=false;
  noteInteraction.dragSelectionPrepared=false;
  noteInteraction.mode="note";
  noteInteraction.rangeAnchorIndex=-1;
  noteInteraction.rangeLastIndex=-1;
});


function getBeamDirection(items){
  // In a beamed group, the beam direction belongs to the whole group.
  // If any note in the group has a manually selected direction,
  // use that direction for the complete group.
  // Otherwise calculate from the first note.
  const manual=items.find(({n})=>n.stem==="up" || n.stem==="down");
  if(manual) return manual.n.stem;
  const first=items[0].n;
  return first.stem || "up";
}


// Engraving model:
// Rhythm belongs to each note. Beam only connects notes.
// Beam level 1 = eighth/sixteenth primary beam.
// Beam level 2 = sixteenth secondary beam.
function getBeamLevel(note){
  if(!note) return 0;
  if(note.rhythm==="sixteenth") return 2;
  if(note.rhythm==="eighth") return 1;
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

function drawBeams(){
 // Engraving model:
 // Rhythm belongs to each note.
 // Beam is only a visual connection between notes.
 //
 // Level 1 = primary beam (eighth connection)
 // Level 2 = secondary beam (sixteenth connection)
 //
 // Secondary beam logic:
 // A sixteenth note does not decide hook direction by itself.
 // It depends on neighbouring beamable notes.
 // This prevents the terminal 16th after an 8th group from
 // producing an outward hook.

 const groups={};
 state.notes.forEach((n,i)=>{
   if(n && n.beamGroup){
     (groups[n.beamGroup] ||= []).push({n,i});
   }
 });

 Object.values(groups).forEach(items=>{
   items.sort((a,b)=>a.i-b.i);
   items=items.filter(({n})=>["eighth","sixteenth"].includes(n.rhythm));
   if(items.length<2)return;

   const dir=getBeamDirection(items);

   const notes=items.map(({n,i})=>{
     const y=stepToY(pitchToStep(n.letter,n.octave));
     return {
       n,
       i,
       x:noteXs[i]+(dir==="up"?10:-10),
       y,
       level:getBeamLevel(n)
     };
   });

   const beamY=dir==="up"
     ? Math.min(...notes.map(p=>p.y-55))
     : Math.max(...notes.map(p=>p.y+55));

   // stems to primary beam
   notes.forEach(p=>{
     scoreSvg.appendChild(el("line",{
       x1:p.x,y1:p.y,x2:p.x,y2:beamY,
       stroke:"#111","stroke-width":2.3
     }));
   });

   // Primary beam
   const first=notes[0], last=notes[notes.length-1];
   scoreSvg.appendChild(el("polygon",{
     points:`${first.x},${beamY} ${last.x},${beamY} ${last.x},${beamY+(dir==="up"?8:-8)} ${first.x},${beamY+(dir==="up"?8:-8)}`,
     fill:"#111"
   }));

   const secondaryY=beamY+(dir==="up"?10:-10);
   const thickness=8;

   function drawSecondaryBeam(x1,x2){
     scoreSvg.appendChild(el("polygon",{
       points:`${x1},${secondaryY} ${x2},${secondaryY} ${x2},${secondaryY+(dir==="up"?thickness:-thickness)} ${x1},${secondaryY+(dir==="up"?thickness:-thickness)}`,
       fill:"#111"
     }));
   }

   // Secondary beam rendering
   notes.forEach((p,index)=>{
     if(p.level!==2)return;

     const prev=notes[index-1];
     const next=notes[index+1];

     const prevSixteenth=prev && prev.level===2;
     const nextSixteenth=next && next.level===2;

     // Full secondary beam between consecutive sixteenth notes
     if(nextSixteenth){
       drawSecondaryBeam(p.x,next.x);
       return;
     }

     // Do not draw again if previous sixteenth already connected us
     if(prevSixteenth)return;

     // Sixteenth after an eighth:
     // create inward hook toward the previous note.
     if(prev && prev.level>=1){
       // Hook direction follows the neighbouring note, not the stem.
       // A terminal sixteenth always points inward to its predecessor.
       const hookStart=p.x-12;
       drawSecondaryBeam(hookStart,p.x);
       return;
     }

     // Sixteenth before an eighth:
     // create outward-starting hook toward the following note.
     if(next && next.level>=1){
       // An initial isolated sixteenth points inward to its successor.
       const hookEnd=p.x+12;
       drawSecondaryBeam(p.x,hookEnd);
     }
   });
 });
}

function staffStepToPitch(step){
  // Staff positions: 0 = bottom line E4, increasing upward diatonically.
  // Convert staff position to letter/octave first.
  const letters=["E","F","G","A","B","C","D"];
  const index=((step%7)+7)%7;
  const octaveShift=Math.floor((step+2)/7);
  const letter=letters[index];
  let octave=4+octaveShift;

  // Apply key signature automatically.
  const keyAcc={
    "C Major":{},
    "G Major":{"F":"#"},
    "D Major":{"F":"#","C":"#"},
    "A Major":{"F":"#","C":"#","G":"#"},
    "E Major":{"F":"#","C":"#","G":"#","D":"#"},
    "B Major":{"F":"#","C":"#","G":"#","D":"#","A":"#"},
    "F# Major":{"F":"#","C":"#","G":"#","D":"#","A":"#","E":"#"},
    "C# Major":{"F":"#","C":"#","G":"#","D":"#","A":"#","E":"#","B":"#"},
    "F Major":{"B":"b"},
    "Bb Major":{"B":"b","E":"b"},
    "Eb Major":{"B":"b","E":"b","A":"b"},
    "Ab Major":{"B":"b","E":"b","A":"b","D":"b"},
    "Db Major":{"B":"b","E":"b","A":"b","D":"b","G":"b"},
    "Gb Major":{"B":"b","E":"b","A":"b","D":"b","G":"b","C":"b"},
    "Cb Major":{"B":"b","E":"b","A":"b","D":"b","G":"b","C":"b","F":"b"}
  };

  return {
    letter,
    octave,
    accidental:(keyAcc[state.key.name]||{})[letter] || ""
  };
}

function noteCount(){
  return state.notes.filter(Boolean).length;
}
function syncSelectionToCursor(){
  state.selectedIds.clear();
  state.selectionIsExplicit=true;
  const n=state.notes[state.cursorIndex];
  if(n){
    state.selectedIds.add(n.id);
    state.cursorStaffStep=pitchToStep(n.letter,n.octave);
  }
}
function setCursorIndex(index){
  state.cursorIndex=Math.max(0,Math.min(14,index));
  syncSelectionToCursor();
  state.selectionAnchorIndex=state.cursorIndex;
  render();
}

function extendSelectionTo(index){
  const target=Math.max(0,Math.min(14,index));
  const anchor=state.selectionAnchorIndex>=0
    ? state.selectionAnchorIndex
    : state.cursorIndex;
  state.selectionAnchorIndex=anchor;
  selectNoteRange(anchor,target);
  render();
}
function moveCursor(delta){
  setCursorIndex(state.cursorIndex+delta);
}
function nextEmptyIndex(from=state.cursorIndex){
  for(let offset=1;offset<=15;offset++){
    const i=(from+offset)%15;
    if(!state.notes[i])return i;
  }
  return from;
}
function goToNextEmpty(){
  setCursorIndex(nextEmptyIndex());
  requestAnimationFrame(()=>scoreSvg.focus({preventScroll:true}));
}
function selectedNoteIndex(){
  const n=state.notes[state.cursorIndex];
  return n ? state.cursorIndex : -1;
}
function selectNoteByIndex(index){
  setCursorIndex(index);
}
function moveSelectedPitch(delta){
  const n=state.notes[state.cursorIndex];
  if(n){
    const current=pitchToStep(n.letter,n.octave);
    const next=stepToPitch(clampStaffStep(current+delta));
    state.selectionIsExplicit=true;
    n.letter=next.letter;
    n.octave=next.octave;
    state.cursorStaffStep=pitchToStep(n.letter,n.octave);
  }else{
    state.cursorStaffStep=clampStaffStep(state.cursorStaffStep+delta);
  }
  render();
}
function moveSelection(delta){
  moveCursor(delta);
}
function isInteractiveInput(target){
  return target && ["INPUT","SELECT","TEXTAREA"].includes(target.tagName);
}
function inheritedStemForSlot(slotIndex){
  for(let i=slotIndex-1;i>=0;i--){
    const prev=state.notes[i];
    if(prev && ["up","down","auto"].includes(prev.stem)){
      return prev.stem==="auto" ? autoStem(prev.letter,prev.octave) : prev.stem;
    }
  }
  return state.tool.stem==="auto" ? "up" : state.tool.stem;
}
function insertNoteAtCursor(){
  if(state.sessionComplete || state.isTransitioning)return;
  const slot=state.cursorIndex;
  const insertStep=state.cursorStaffStep;
  const pitch=staffStepToPitch(insertStep);
  const existing=state.notes[slot];
  if(existing){
    // If occupied, keep the existing note selected rather than overwriting accidentally.
    syncSelectionToCursor();
    render();
    return;
  }
  const id=crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());
  state.notes[slot]={
    id,...pitch,
    accidental:state.tool.accidental,
    rhythm:state.tool.rhythm,
    stem:state.tool.rhythm==="whole" ? null : inheritedStemForSlot(slot),
    beamGroup:null
  };
  state.selectedIds.clear();
  state.selectedIds.add(id);
  // A newly entered note is highlighted for orientation, but toolbar/keyboard
  // choices now configure the NEXT entry. Editing an existing note requires
  // an explicit click, range selection, or cursor navigation.
  state.selectionIsExplicit=false;

  // Keep cursor on the inserted note. User can move manually.
  state.cursorIndex=slot;
  state.cursorStaffStep=insertStep;
  render();
  requestAnimationFrame(()=>scoreSvg.focus({preventScroll:true}));
}

let pointerDown={
  x:0,
  y:0,
  moved:false,
  onNote:false,
  pointerId:null,
  rangeSelect:false
};
scoreSvg.addEventListener("pointerdown",ev=>{
 if(state.sessionComplete || state.isTransitioning || (ev.pointerType==="mouse" && ev.button!==0))return;
 const onNote=!!(
   ev.target &&
   ev.target.closest &&
   ev.target.closest("[data-note-id]")
 );

 pointerDown={
   x:ev.clientX,
   y:ev.clientY,
   moved:false,
   onNote,
   pointerId:ev.pointerId,
   rangeSelect:state.mobileRangeSelectMode
 };
});
scoreSvg.addEventListener("pointermove",ev=>{
 if(pointerDown.pointerId!==null && ev.pointerId!==pointerDown.pointerId) return;

 if(Math.hypot(
   ev.clientX-pointerDown.x,
   ev.clientY-pointerDown.y
 )>8){
   pointerDown.moved=true;
 }
});
scoreSvg.addEventListener("pointerup",ev=>{
 if(state.sessionComplete || state.isTransitioning || (ev.pointerType==="mouse" && ev.button!==0))return;
 if(
   pointerDown.pointerId!==null &&
   ev.pointerId!==pointerDown.pointerId
 ) return;
 if(
   pointerDown.moved ||
   pointerDown.onNote ||
   pointerDown.rangeSelect
 ) return;

 const p=eventPointInScore(ev); if(!p)return;
 if(p.y<50||p.y>260)return;

 let nearest=0,best=Infinity;
 noteXs.forEach((x,i)=>{
   const d=Math.abs(p.x-x);
   if(d<best){best=d;nearest=i}
 });
 state.cursorIndex=nearest;
 state.cursorStaffStep=clampStaffStep(yToStep(p.y));
 // The visible hint promises direct click/tap entry.  Notes themselves
 // still use the separate selection/drag interaction above.
 insertNoteAtCursor();
});

document.addEventListener("keydown",ev=>{
  if(isInteractiveInput(ev.target)) return;
  if(state.sessionComplete || state.isTransitioning || ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing)return;
  if((ev.key==="Enter" || ev.key===" ") && ev.target.closest?.("button"))return;
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(ev.key)) ev.preventDefault();
  if(ev.shiftKey && ev.key==="ArrowLeft") extendSelectionTo(state.cursorIndex-1);
  else if(ev.shiftKey && ev.key==="ArrowRight") extendSelectionTo(state.cursorIndex+1);
  else if(ev.key==="ArrowUp") moveSelectedPitch(1);
  else if(ev.key==="ArrowDown") moveSelectedPitch(-1);
  else if(ev.key==="ArrowLeft") moveCursor(-1);
  else if(ev.key==="ArrowRight") moveCursor(1);
  else if(ev.key==="Enter" || ev.key===" "){
    ev.preventDefault();
    insertNoteAtCursor();
  }
  else if(ev.key==="Delete" || ev.key==="Backspace"){
    ev.preventDefault();
    document.getElementById("deleteNote").click();
  }
});

document.getElementById("pitchUp").addEventListener("click",()=>{
  setMobileRangeSelectMode(false);
  moveSelectedPitch(1);
  scoreSvg.focus({preventScroll:true});
});
document.getElementById("pitchDown").addEventListener("click",()=>{
  setMobileRangeSelectMode(false);
  moveSelectedPitch(-1);
  scoreSvg.focus({preventScroll:true});
});
document.getElementById("navPrev").addEventListener("click",()=>{
  setMobileRangeSelectMode(false);
  moveCursor(-1);
  scoreSvg.focus({preventScroll:true});
});
document.getElementById("navNext").addEventListener("click",()=>{
  setMobileRangeSelectMode(false);
  moveCursor(1);
  scoreSvg.focus({preventScroll:true});
});
document.getElementById("insertNote").addEventListener("click",()=>{
  setMobileRangeSelectMode(false);
  insertNoteAtCursor();
});
document.getElementById("rangeSelectToggle").addEventListener("click",()=>{
  setMobileRangeSelectMode(!state.mobileRangeSelectMode);
});

function normalizeBeamGroups(){
  const groups=new Map();
  state.notes.forEach((n,i)=>{
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
      const n=state.notes[i];
      const beamable=!!n && ["eighth","sixteenth"].includes(n.rhythm);
      const sameMeasure=run.length===0 || Math.floor(i/7)===Math.floor(run[0]/7);
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
        indicesInRun.forEach(i=>{ if(state.notes[i]) state.notes[i].beamGroup=null; });
        return;
      }
      const gid=runIndex===0 ? state.notes[indicesInRun[0]].beamGroup : newBeamGroupId();
      indicesInRun.forEach(i=>{ state.notes[i].beamGroup=gid; });
    });
  });
}

function syncToolButtons(){
  document.querySelectorAll('.rhythm').forEach(b=>{
    const active=b.dataset.rhythm===state.tool.rhythm;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',active?'true':'false');
  });
  document.querySelectorAll('.accidental').forEach(b=>{
    const active=b.dataset.acc===state.tool.accidental;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',active?'true':'false');
  });
}

function resetEntryTool(){
  state.tool={rhythm:'quarter',accidental:'',stem:'up'};
  syncToolButtons();
}

function setTool(type,value){
 if(state.sessionComplete || state.isTransitioning)return;
 state.tool[type]=value;
 const dataKey = type==="accidental" ? "acc" : type;
 document.querySelectorAll(`.${type}`).forEach(b=>{
   b.classList.toggle("active", b.dataset[dataKey]===value);
   b.setAttribute("aria-pressed", b.dataset[dataKey]===value ? "true" : "false");
 });
 if(state.selectionIsExplicit){
 state.notes.forEach(n=>{
   if(n && state.selectedIds.has(n.id)){
     if(type==="accidental") n.accidental=value;
     if(type==="rhythm"){
       n.rhythm=value;
       if(value==="whole"){
         n.stem=null;
       }else if(!["up","down","auto"].includes(n.stem)){
         n.stem=autoStem(n.letter,n.octave);
       }
     }
     if(type==="stem"){
       n.stem=value;
       if(n.beamGroup){
         state.notes.forEach(m=>{
           if(m && m.beamGroup===n.beamGroup) m.stem=value;
         });
       }
     }
   }
 });
 }
 normalizeBeamGroups();
 render();
 requestAnimationFrame(()=>scoreSvg.focus({preventScroll:true}));
}
document.querySelectorAll(".rhythm").forEach(b=>b.onclick=()=>setTool("rhythm",b.dataset.rhythm));
document.querySelectorAll(".accidental").forEach(b=>b.onclick=()=>setTool("accidental",b.dataset.acc));
document.getElementById("toggleStem").onclick=()=>{
 if(state.sessionComplete || state.isTransitioning)return;
 const selected=state.notes.filter(n=>n && state.selectedIds.has(n.id));
 const changes=new Map();
 selected.forEach(n=>{
   if(n.rhythm==="whole")return;
   const group=n.beamGroup!=null ? state.notes.map((n,i)=>({n,i})).filter(item=>item.n && item.n.beamGroup===n.beamGroup) : [];
   const direction=group.length>1 ? getBeamDirection(group) : (n.stem==="auto" || !n.stem ? autoStem(n.letter,n.octave) : n.stem);
   const next=direction==="up"?"down":"up";
   if(group.length>1)group.forEach(item=>changes.set(item.n,next));
   else changes.set(n,next);
 });
 changes.forEach((direction,n)=>{n.stem=direction;});
 state.tool.stem=changes.size ? changes.values().next().value : state.tool.stem==="down"?"up":"down";
 render();
};
document.getElementById("deleteNote").onclick=()=>{
 if(state.sessionComplete || state.isTransitioning)return;
 state.notes.forEach((n,i)=>{if(n && state.selectedIds.has(n.id))state.notes[i]=null;});
 state.selectedIds.clear();
 state.selectionIsExplicit=false;
 normalizeBeamGroups();
 render();
};
document.getElementById("resetScore").onclick=()=>{
 if(state.sessionComplete || state.isTransitioning)return;
 state.notes=Array(15).fill(null);state.selectedIds.clear();state.selectionIsExplicit=false;state.cursorIndex=0;state.cursorStaffStep=0;resetEntryTool();hideFeedback();render()
};
document.getElementById("beamSelected").onclick=()=>{
 const idx=state.notes.map((n,i)=>n&&state.selectedIds.has(n.id)?i:null).filter(i=>i!==null).sort((a,b)=>a-b);
 if(idx.length<2)return alert("เลือกอย่างน้อย 2 โน้ต: คลิกตัวแรก แล้ว Shift+Click ตัวสุดท้าย หรือใช้ปุ่ม เลือกหลายโน้ต");
 if(idx.some((v,i)=>i>0&&v!==idx[i-1]+1))return alert("กรุณาเลือกโน้ตที่อยู่ติดกัน");
 if(idx.some(i=>!["eighth","sixteenth"].includes(state.notes[i].rhythm)))return alert("Beam ได้เฉพาะ eighth/sixteenth notes");
 if(idx.some(i=>Math.floor(i/7)!==Math.floor(idx[0]/7)))return alert("เลือกโน้ตในห้องเดียวกันเพื่อ Beam");
 const gid=newBeamGroupId();
 const groupDir=effectiveStem(state.notes[idx[0]]) || autoStem(state.notes[idx[0]].letter,state.notes[idx[0]].octave);
 idx.forEach(i=>{state.notes[i].beamGroup=gid;state.notes[i].stem=groupDir;});
 normalizeBeamGroups();render();
};
document.getElementById("unbeamSelected").onclick=()=>{
  const groups=new Set(state.notes.filter(n=>n && state.selectedIds.has(n.id) && n.beamGroup!=null).map(n=>n.beamGroup));
  state.notes.forEach(n=>{if(n && groups.has(n.beamGroup)) n.beamGroup=null;});
  normalizeBeamGroups();
  render();
};

function percent(correct,total){
  return total ? Math.round((correct/total)*100) : null;
}

function meanScore(evidence){
  const scores=Object.values(evidence).map(item=>item.score).filter(Number.isFinite);
  return scores.length ? Math.round(scores.reduce((sum,n)=>sum+n,0)/scores.length) : null;
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

function evaluateMastery(overall,aggregate){
  const failedLOs=Object.entries(MASTERY_CRITERIA.perLO)
    .filter(([id,minimum])=>{
      const score=aggregate?.[id]?.score;
      return !Number.isFinite(score) || score<minimum;
    })
    .map(([id])=>id);

  return{
    passed:Number.isFinite(overall) && overall>=MASTERY_CRITERIA.overall && failedLOs.length===0,
    failedLOs
  };
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

function effectiveStem(note){
  if(!note || note.rhythm==="whole") return null;
  return note.stem==="auto"
    ? autoStem(note.letter,note.octave)
    : note.stem;
}

function beamGroupSignatures(notes){
  const groups=new Map();

  notes.forEach((n,i)=>{
    if(!n || !n.beamGroup) return;

    if(!groups.has(n.beamGroup)){
      groups.set(n.beamGroup,[]);
    }

    groups.get(n.beamGroup).push(i);
  });

  return [...groups.values()]
    .map(indices=>indices.sort((a,b)=>a-b).join("-"))
    .sort();
}

function check(){
  const expected=buildExpected();
  const actual=state.notes;

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

function feedbackUnitLabels(){
  return {
    BN01_TREBLE_PITCH:Array.from({length:15},(_,i)=>`โน้ตตำแหน่ง ${i+1}`),
    BN06_STEM_DIRECTION:[
      "โน้ตตำแหน่ง 1",
      "โน้ตตำแหน่ง 8",
      "Beam โน้ต 2–3",
      "Beam โน้ต 4–7",
      "Beam โน้ต 9–10",
      "Beam โน้ต 11–14"
    ],
    RH01_DURATION_VALUE:Array.from({length:15},(_,i)=>`โน้ตตำแหน่ง ${i+1}`),
    GR02_PRIMARY_BEAM:[
      "Beam โน้ต 2–3",
      "Beam โน้ต 4–7",
      "Beam โน้ต 9–10",
      "Beam โน้ต 11–14",
      "มี Beam เกินหรือจัดกลุ่มผิด"
    ],
    MS03_SCALE_ACCIDENTAL:Array.from({length:15},(_,i)=>`โน้ตตำแหน่ง ${i+1}`)
  };
}

function questionFeedback(result){
  const labels=feedbackUnitLabels();
  const feedbackScoreLabels={
    BN01_TREBLE_PITCH:"ตำแหน่งระดับเสียงบนกุญแจซอล (Treble Pitch)",
    BN06_STEM_DIRECTION:"ทิศทางก้านโน้ต (Stem Direction)",
    RH01_DURATION_VALUE:"ค่าความยาวของตัวโน้ต (Duration Value)",
    GR02_PRIMARY_BEAM:"การรวบเขบ็ต (Primary Beam)",
    MS03_SCALE_ACCIDENTAL:"เครื่องหมายแปลงเสียงในบันไดเสียง (Scale Accidental)"
  };
  const issues=[];

  Object.entries(result.lo).forEach(([id,evidence])=>{
    const wrong=evidence.flags
      .map((flag,i)=>flag===false ? (labels[id]?.[i] || `หน่วย ${i+1}`) : null)
      .filter(Boolean);

    if(wrong.length){
      issues.push(
        `<li><b>${LO_META[id].th}</b>: ${wrong.join(", ")}</li>`
      );
    }
  });

  const detail=issues.length
    ? `<div class="feedback-detail"><b>สิ่งที่ตรวจพบว่าผิด</b><ul>${issues.join("")}</ul></div>`
    : `<div class="feedback-detail feedback-all-correct"><b>ไม่พบข้อผิดพลาดในเกณฑ์ที่ประเมิน</b></div>`;

  const loScores=Object.entries(result.lo).map(([id,evidence])=>{
    const score=evidence.score===null ? "N/A" : `${evidence.score}%`;
    const cls=evidence.score===null ? "na" : evidence.score>=90 ? "strong" : evidence.score<75 ? "weak" : "developing";
    return `<span class="feedback-lo ${cls}"><small>${feedbackScoreLabels[id] || LO_META[id].short}</small><b>${score}</b></span>`;
  }).join("");

  const questionScores=state.sessionResults.map((item,i)=>
    `<span class="feedback-qscore ${i===state.questionIndex?'current':''}"><small>ข้อ ${i+1}</small><b>${item.score}%</b></span>`
  ).join("");

  return `
    <div class="feedback-scoreline"><span>ผลคะแนนข้อ ${state.questionIndex+1}</span><b>${result.score}%</b></div>
    <div>คะแนนรวมแบบถ่วงน้ำหนัก • Pitch 30% • Stem 10% • Duration 15% • Beam 15% • Accidental 30%</div>
    <div class="feedback-lo-grid" aria-label="คะแนนแยกตามผลลัพธ์การเรียนรู้">${loScores}</div>
    ${detail}
    <div class="feedback-history"><b>คะแนนรายข้อ</b><div class="feedback-question-strip">${questionScores}</div></div>
  `;
}

function shuffle(array){
  const a=[...array];

  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }

  return a;
}

function resetQuestionWorkspace(){
  state.notes=Array(15).fill(null);
  state.selectedIds.clear();
  state.cursorIndex=0;
  state.cursorStaffStep=0;
  state.mobileRangeSelectMode=false;
  state.mobileRangeAnchorIndex=-1;
  state.selectionAnchorIndex=-1;
  state.selectionIsExplicit=false;
  resetEntryTool();
  updateRangeSelectButton();
  hideFeedback();
}

function setQuestionReviewMode(active){
  const editControls=document.querySelectorAll(
    ".notation-palette button, .mobile-note-controls button, #resetScore"
  );

  editControls.forEach(button=>{
    button.disabled=active;
  });

  scoreSvg.style.pointerEvents=active ? "none" : "";
  scoreSvg.setAttribute("aria-disabled",active ? "true" : "false");

  const checkButton=document.getElementById("checkAnswer");
  if(checkButton){
    checkButton.disabled=active;
    checkButton.hidden=active;
  }

  const nextButton=document.getElementById("nextQuestion");
  if(nextButton){
    nextButton.hidden=!active;
  }
}

function startQuestion(key){
  state.questionIndex=state.sessionResults.length;
  state.key=key;
  state.signatureMode="hidden";
  state.isTransitioning=false;

  resetQuestionWorkspace();
  setQuestionReviewMode(false);

  const button=document.getElementById("checkAnswer");
  if(button){
    button.disabled=false;
    button.hidden=false;
    button.textContent="ตรวจคำตอบ";
  }

  const nextButton=document.getElementById("nextQuestion");
  if(nextButton){
    nextButton.hidden=true;
    nextButton.disabled=false;
    nextButton.textContent="ทำข้อต่อไป";
  }

  render();

  requestAnimationFrame(()=>{
    if(!state.sessionComplete) scoreSvg.focus({preventScroll:true});
  });
}

function refillSessionBag(){
  const allowed=KEYS.filter(
    k=>LEVEL_KEYS[state.level].includes(k.tonic)
  );

  if(!allowed.length){
    state.sessionBag=[];
    return;
  }

  const previousTonic=
    state.sessionResults.length>0
      ? state.key?.tonic
      : null;

  const bag=shuffle(allowed);

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

  state.sessionBag=bag;
}

function takeNextQuestionFromBag(){
  const allowedTonics=
    LEVEL_KEYS[state.level] || [];

  const priorityCode=
    (state.masteryPriorityItemCodes || [])
      .find(code=>allowedTonics.includes(code));

  if(priorityCode){
    if(!state.sessionBag.length){
      refillSessionBag();
    }

    const bagIndex=
      state.sessionBag.findIndex(
        item=>item.tonic===priorityCode
      );

    if(bagIndex>=0){
      const [priorityItem]=
        state.sessionBag.splice(bagIndex,1);

      console.log(
        "MASTERY-AWARE QUESTION:",
        priorityItem.name
      );

      return priorityItem;
    }

    const priorityItem=
      KEYS.find(
        item=>item.tonic===priorityCode
      );

    if(priorityItem){
      console.log(
        "MASTERY-AWARE QUESTION:",
        priorityItem.name
      );

      return priorityItem;
    }
  }

  if(!state.sessionBag.length){
    refillSessionBag();
  }

  return state.sessionBag.shift() || null;
}

async function resolveMajorScaleExerciseStage(level){
  const client=window.majorScaleSupabase;

  if(!client){
    throw new Error("Supabase client not available");
  }

  const {data:exercise,error:exerciseError}=await client
    .from("exercises")
    .select("id")
    .eq("code","MAJOR_SCALE_NOTATION")
    .eq("active",true)
    .single();

  if(exerciseError) throw exerciseError;

  const stageCode=`STAGE_${level}`;

  const {data:stage,error:stageError}=await client
    .from("exercise_stages")
    .select("id")
    .eq("exercise_id",exercise.id)
    .eq("code",stageCode)
    .eq("active",true)
    .single();

  if(stageError) throw stageError;

  return {
    exerciseId:exercise.id,
    stageId:stage.id
  };
}

async function createPracticeSessionRecord(generation, level){

  const client = window.majorScaleSupabase;

  if(!client){
    console.error("Supabase client not available");
    return;
  }

  try{

    const {
      data:{user},
      error:userError
    } = await client.auth.getUser();

    if(userError) throw userError;

    if(!user){
      console.log("No authenticated user — session not saved");
      return;
    }

    const {
      exerciseId,
      stageId
    }=await resolveMajorScaleExerciseStage(level);

    const {data,error} = await client
      .from("practice_sessions")
      .insert({
        user_id:user.id,
        exercise_id:exerciseId,
        stage_id:stageId,
        mode:"practice",
        completed_questions:0,
        app_version:"0.7.1"
      })
      .select("id")
      .single();

    if(error) throw error;

    /*
      ถ้าระหว่างรอ Database ผู้ใช้เริ่ม session ใหม่
      ห้ามเอา id ของ session เก่ามาทับ session ปัจจุบัน
    */
    if(generation === state.practiceSessionGeneration){
      state.practiceSessionId = data.id;

      console.log(
        "PRACTICE SESSION CREATED:",
        data.id
      );

      return data.id;
    }

    return null;

  }catch(error){

    console.error(
      "CREATE PRACTICE SESSION ERROR:",
      error
    );

    return null;
  }
}

async function ensurePracticeSessionRecord(generation, level){
  if(generation!==state.practiceSessionGeneration){
    return null;
  }

  if(state.practiceSessionId){
    return state.practiceSessionId;
  }

  if(!state.practiceSessionPromise){
    state.practiceSessionPromise=
      createPracticeSessionRecord(
        generation,
        level
      );
  }

  const practiceSessionId=
    await state.practiceSessionPromise;

  // If creation failed, allow a later checked answer to retry.
  if(
    !practiceSessionId &&
    generation===state.practiceSessionGeneration
  ){
    state.practiceSessionPromise=null;
  }

  return practiceSessionId;
}

async function closeStalePracticeSessionsForCurrentUser(){
  const client=window.majorScaleSupabase;

  if(!client) return 0;

  try{
    const {
      data:{user},
      error:userError
    }=await client.auth.getUser();

    if(userError) throw userError;
    if(!user) return 0;

    const {data:sessions,error:sessionError}=await client
      .from("practice_sessions")
      .select("id,started_at,last_activity_at")
      .eq("user_id",user.id)
      .eq("mode","practice")
      .is("completed_at",null);

    if(sessionError) throw sessionError;
    if(!sessions?.length) return 0;

    let closed=0;

    for(const session of sessions){
      const inferredCompletedAt=
        session.last_activity_at ||
        session.started_at ||
        new Date().toISOString();

      const {error}=await client
        .from("practice_sessions")
        .update({
          completed_at:inferredCompletedAt
        })
        .eq("id",session.id);

      if(error){
        console.error(
          "CLOSE STALE PRACTICE SESSION ERROR:",
          session.id,
          error
        );
        continue;
      }

      closed++;
    }

    if(closed){
      console.log(
        "STALE PRACTICE SESSIONS CLOSED:",
        closed
      );
    }

    return closed;

  }catch(error){
    console.error(
      "CLOSE STALE PRACTICE SESSIONS ERROR:",
      error
    );
    return 0;
  }
}

async function closeCurrentPracticeSession(){
  const client=window.majorScaleSupabase;

  if(!client) return false;

  // If an answer is currently being persisted, finish that write first.
  try{
    await state.attemptSaveChain;
  }catch(error){
    console.error(
      "WAIT FOR ATTEMPT SAVE BEFORE SESSION CLOSE ERROR:",
      error
    );
  }

  const practiceSessionId=state.practiceSessionId;

  if(!practiceSessionId){
    return true;
  }

  try{
    const closedAt=new Date().toISOString();

    const {error}=await client
      .from("practice_sessions")
      .update({
        completed_at:closedAt
      })
      .eq("id",practiceSessionId)
      .is("completed_at",null);

    if(error) throw error;

    console.log(
      "PRACTICE SESSION CLOSED:",
      practiceSessionId
    );

    state.practiceSessionId=null;
    state.practiceSessionPromise=null;

    return true;

  }catch(error){
    console.error(
      "CLOSE PRACTICE SESSION ERROR:",
      error
    );
    return false;
  }
}

window.majorScaleTrainerClosePracticeSession=
  closeCurrentPracticeSession;

async function loadCurrentLevelFromProgress(){
  const client=window.majorScaleSupabase;

  if(!client){
    console.error("Supabase client not available — using Level 1");
    return 1;
  }

  let user=null;

  try{
    const {
      data:{user:authenticatedUser},
      error:userError
    }=await client.auth.getUser();

    if(userError) throw userError;
    if(!authenticatedUser) return 1;

    user=authenticatedUser;

  }catch(error){
    console.error(
      "LOAD CURRENT USER ERROR:",
      error
    );
    return 1;
  }

  // Primary lookup: generic Exercise + Stage progress architecture.
  // UI still uses Level 1–4 temporarily, so STAGE_n is mapped to Level n.
  try{
    const {data:exercise,error:exerciseError}=await client
      .from("exercises")
      .select("id")
      .eq("code","MAJOR_SCALE_NOTATION")
      .eq("active",true)
      .maybeSingle();

    if(exerciseError) throw exerciseError;

    if(exercise?.id){
      const {data:stages,error:stagesError}=await client
        .from("exercise_stages")
        .select("id,code")
        .eq("exercise_id",exercise.id)
        .eq("active",true);

      if(stagesError) throw stagesError;

      const stageRows=Array.isArray(stages) ? stages : [];
      const stageIds=stageRows.map(row=>row.id).filter(Boolean);

      if(stageIds.length){
        const {data:progressRows,error:progressError}=await client
          .from("student_stage_progress")
          .select("stage_id,status")
          .eq("user_id",user.id)
          .eq("status","in_progress")
          .in("stage_id",stageIds);

        if(progressError) throw progressError;

        const stageCodeById=new Map(
          stageRows.map(row=>[row.id,row.code])
        );

        const genericLevels=(progressRows || [])
          .map(row=>stageCodeById.get(row.stage_id))
          .map(code=>{
            const match=/^STAGE_(\d+)$/.exec(code || "");
            return match ? Number(match[1]) : null;
          })
          .filter(level=>
            Number.isInteger(level) && LEVEL_KEYS[level]
          )
          .sort((a,b)=>a-b);

        if(genericLevels.length){
          const level=genericLevels[0];

          console.log(
            "CURRENT STAGE SOURCE: student_stage_progress",
            `STAGE_${level}`
          );

          return level;
        }
      }
    }

    console.warn(
      "No generic in-progress Stage found — using Level 1"
    );

  }catch(error){
    console.error(
      "GENERIC CURRENT STAGE LOOKUP FAILED — using Level 1:",
      error
    );
  }

  return 1;
}

const MASTERY_UI_THRESHOLDS={
  overall:90,
  BN01_TREBLE_PITCH:90,
  BN06_STEM_DIRECTION:85,
  RH01_DURATION_VALUE:85,
  GR02_PRIMARY_BEAM:85,
  MS03_SCALE_ACCIDENTAL:90
};

const MASTERY_UI_SKILLS=[
  {
    key:"bn01_treble_pitch",
    code:"BN01_TREBLE_PITCH",
    label:"Pitch"
  },
  {
    key:"bn06_stem_direction",
    code:"BN06_STEM_DIRECTION",
    label:"Stem"
  },
  {
    key:"rh01_duration_value",
    code:"RH01_DURATION_VALUE",
    label:"Duration"
  },
  {
    key:"gr02_primary_beam",
    code:"GR02_PRIMARY_BEAM",
    label:"Beam"
  },
  {
    key:"ms03_scale_accidental",
    code:"MS03_SCALE_ACCIDENTAL",
    label:"Accidental"
  }
];

function masteryUiScore(value){
  const number=Number(value);
  return Number.isFinite(number)
    ? `${Math.round(number)}%`
    : "—";
}

function setMasteryProgressLoading(level=state.level){
  const evidence=document.getElementById("masteryEvidence");
  const coverage=document.getElementById("masteryCoverage");
  const overall=document.getElementById("masteryOverall");
  const status=document.getElementById("masteryProgressStatus");
  const title=document.getElementById("masteryDetailsTitle");
  const grid=document.getElementById("masteryDetailGrid");
  const powerFill=document.getElementById("masteryPowerFill");
  const powerText=document.getElementById("masteryPowerText");

  if(evidence) evidence.textContent="—";
  if(coverage) coverage.textContent="—";
  if(overall) overall.textContent="—";
  if(powerFill) powerFill.style.width="0%";
  if(powerText) powerText.textContent="0%";

  if(status){
    status.className=
      "mastery-progress-status progressing";
    status.textContent="กำลังอัปเดตความก้าวหน้า...";
  }

  if(title){
    title.textContent=`Level ${level} • ความก้าวหน้ารายทักษะ`;
  }

  if(grid){
    grid.innerHTML="";
  }
}

function renderMasteryProgress(data){
  if(!data) return;

  const evidence=document.getElementById("masteryEvidence");
  const coverage=document.getElementById("masteryCoverage");
  const overall=document.getElementById("masteryOverall");
  const status=document.getElementById("masteryProgressStatus");
  const title=document.getElementById("masteryDetailsTitle");
  const grid=document.getElementById("masteryDetailGrid");
  const powerFill=document.getElementById("masteryPowerFill");
  const powerText=document.getElementById("masteryPowerText");

  const level=Number(data.level ?? state.level);
  const attempts=Number(data.attempts_found ?? 0);
  const windowSize=Number(data.window_size ?? 0);
  const covered=Number(data.covered_keys ?? 0);
  const required=Number(data.required_keys ?? 0);
  const overallNumber=Number(data.overall_score);

  if(evidence){
    evidence.textContent=`${attempts}/${windowSize}`;
  }

  if(coverage){
    coverage.textContent=`${covered}/${required}`;
  }

  if(overall){
    overall.textContent=
      Number.isFinite(overallNumber)
        ? `${Math.round(overallNumber)}%`
        : "—";
  }

  if(title){
    title.textContent=`Level ${level} • ความก้าวหน้ารายทักษะ`;
  }

  // "Level Power" represents the weakest active Mastery requirement.
  // This prevents a high overall score from visually masking incomplete
  // Evidence or Key coverage.
  const skillRatios=MASTERY_UI_SKILLS.map(item=>{
    const score=Number(data[item.key]);
    const threshold=MASTERY_UI_THRESHOLDS[item.code];

    return Number.isFinite(score)
      ? Math.min(1,score/threshold)
      : 0;
  });

  const readinessRatios=[
    windowSize>0 ? Math.min(1,attempts/windowSize) : 0,
    required>0 ? Math.min(1,covered/required) : 0,
    Number.isFinite(overallNumber)
      ? Math.min(1,overallNumber/MASTERY_UI_THRESHOLDS.overall)
      : 0,
    ...skillRatios
  ];

  const levelPower=Math.max(
    0,
    Math.min(
      100,
      Math.round(Math.min(...readinessRatios)*100)
    )
  );

  if(powerFill){
    powerFill.style.width=`${levelPower}%`;
  }

  if(powerText){
    powerText.textContent=`${levelPower}%`;
  }

  let statusText="ทำต่อเพื่อเพิ่มความมั่นใจ";
  let statusClass="progressing";

  if(data.mastery_passed===true){
    statusText="ผ่านเกณฑ์ Level นี้แล้ว ✓";
    statusClass="mastered";
  }else if(data.enough_attempts!==true){
    statusText=`อีก ${Math.max(0,windowSize-attempts)} ข้อเพื่อประเมินความพร้อม`;
    statusClass="progressing";
  }else if(data.coverage_passed!==true){
    const missingCodes=
      Array.isArray(data.missing_item_codes)
        ? data.missing_item_codes
        : [];

    if(missingCodes.length){
      const names=
        missingCodes
          .slice(0,3)
          .map(majorScaleItemDisplayName);

      const moreCount=
        Math.max(0,missingCodes.length-names.length);

      statusText=
        `ฝึกอีก ${missingCodes.length} คีย์: `+
        names.join(", ")+
        (moreCount>0 ? ` +${moreCount}` : "");
    }else{
      statusText=
        `ฝึกให้ครบอีก ${Math.max(0,required-covered)} คีย์`;
    }

    statusClass="needs-work";
  }else{
    const metrics=[
      {
        label:"Score",
        score:overallNumber,
        threshold:MASTERY_UI_THRESHOLDS.overall
      },
      ...MASTERY_UI_SKILLS.map(item=>({
        label:item.label,
        score:Number(data[item.key]),
        threshold:MASTERY_UI_THRESHOLDS[item.code]
      }))
    ];

    const failed=metrics.filter(
      item=>
        !Number.isFinite(item.score) ||
        item.score<item.threshold
    );

    if(failed.length){
      const first=failed[0];
      statusText=
        `ฝึก ${first.label} เพิ่มอีกเล็กน้อย `+
        `${masteryUiScore(first.score)} → เป้าหมาย ${first.threshold}%`;
      statusClass="needs-work";
    }else{
      statusText="ใกล้ถึงเกณฑ์แล้ว ทำต่ออีกนิด";
      statusClass="progressing";
    }
  }

  if(status){
    status.className=
      `mastery-progress-status ${statusClass}`;
    status.textContent=statusText;
  }

  if(grid){
    grid.innerHTML=MASTERY_UI_SKILLS.map(item=>{
      const score=Number(data[item.key]);
      const threshold=MASTERY_UI_THRESHOLDS[item.code];
      const pass=
        Number.isFinite(score) &&
        score>=threshold;
      const skillPower=
        Number.isFinite(score)
          ? Math.max(0,Math.min(100,Math.round(score)))
          : 0;

      return `
        <div class="mastery-detail-item ${pass?"pass":"fail"}">
          <div class="mastery-detail-top">
            <span title="${item.code}">${item.label}</span>
            <b>${masteryUiScore(score)}</b>
          </div>
          <div class="skill-power-track" aria-hidden="true">
            <div class="skill-power-fill" style="width:${skillPower}%"></div>
          </div>
          <small>${pass?"ถึงเกณฑ์ ✓":`เป้าหมาย ${threshold}%`}</small>
        </div>
      `;
    }).join("");
  }
}

function renderMasteryProgressError(){
  const status=document.getElementById("masteryProgressStatus");

  if(status){
    status.className=
      "mastery-progress-status error";
    status.textContent="โหลดความก้าวหน้าไม่สำเร็จ • ลองใหม่";
  }
}

function adaptStageMasteryForUi(result,level){
  if(!result) return null;

  const skillScores={};

  const skillResults=Array.isArray(result.skill_results)
    ? result.skill_results
    : [];

  skillResults.forEach(item=>{
    if(!item?.skill_code) return;

    skillScores[item.skill_code]=
      item.score===null ||
      item.score===undefined
        ? null
        : Number(item.score);
  });

  return {
    level:Number(level),

    window_size:Number(result.rolling_window ?? 0),
    attempts_found:Number(result.attempts_found ?? 0),

    required_keys:Number(result.required_items ?? 0),
    covered_keys:Number(result.covered_items ?? 0),

    overall_score:
      result.overall_score===null ||
      result.overall_score===undefined
        ? null
        : Number(result.overall_score),

    bn01_treble_pitch:
      skillScores.BN01_TREBLE_PITCH ?? null,

    bn06_stem_direction:
      skillScores.BN06_STEM_DIRECTION ?? null,

    rh01_duration_value:
      skillScores.RH01_DURATION_VALUE ?? null,

    gr02_primary_beam:
      skillScores.GR02_PRIMARY_BEAM ?? null,

    ms03_scale_accidental:
      skillScores.MS03_SCALE_ACCIDENTAL ?? null,

    enough_attempts:result.enough_attempts===true,
    coverage_passed:result.coverage_passed===true,
    mastery_passed:result.mastery_passed===true
  };
}

function majorScaleItemDisplayName(itemCode){
  const key=KEYS.find(
    item=>item.tonic===itemCode
  );

  return key?.name || `${itemCode} major`;
}

async function loadMissingStageItemCodes({
  exerciseId,
  stageId,
  rollingWindow
}){
  const client=window.majorScaleSupabase;

  if(
    !client ||
    !exerciseId ||
    !stageId ||
    !rollingWindow
  ){
    return [];
  }

  try{
    const {data:required,error:requiredError}=
      await client
        .from("stage_required_items")
        .select("item_code,sequence_order")
        .eq("stage_id",stageId)
        .eq("active",true)
        .order("sequence_order",{ascending:true});

    if(requiredError) throw requiredError;

    const requiredCodes=
      (required || [])
        .map(row=>row.item_code)
        .filter(Boolean);

    if(!requiredCodes.length){
      return [];
    }

    const {
      data:{user},
      error:userError
    }=await client.auth.getUser();

    if(userError) throw userError;
    if(!user) return [];

    const {data:sessions,error:sessionsError}=
      await client
        .from("practice_sessions")
        .select("id")
        .eq("user_id",user.id)
        .eq("mode","practice")
        .eq("exercise_id",exerciseId)
        .eq("stage_id",stageId);

    if(sessionsError) throw sessionsError;

    const sessionIds=
      (sessions || []).map(row=>row.id);

    if(!sessionIds.length){
      return requiredCodes;
    }

    const {data:attempts,error:attemptsError}=
      await client
        .from("attempts")
        .select("item_code,checked_at")
        .in("practice_session_id",sessionIds)
        .not("item_code","is",null)
        .order("checked_at",{ascending:false})
        .limit(Number(rollingWindow));

    if(attemptsError) throw attemptsError;

    const covered=new Set(
      (attempts || [])
        .map(row=>row.item_code)
        .filter(Boolean)
    );

    return requiredCodes.filter(
      code=>!covered.has(code)
    );

  }catch(error){
    console.error(
      "LOAD MISSING STAGE ITEMS ERROR:",
      error
    );

    return [];
  }
}

async function refreshMasteryProgress(level=state.level){
  const client=window.majorScaleSupabase;

  if(!client){
    renderMasteryProgressError();
    return null;
  }

  const requestedLevel=Number(level);
  const stageCode=`STAGE_${requestedLevel}`;

  setMasteryProgressLoading(requestedLevel);

  try{
    // Primary source: generic Exercise + Stage mastery architecture.
    const genericResponse=await client.rpc(
      "get_my_stage_mastery",
      {
        p_exercise_code:"MAJOR_SCALE_NOTATION",
        p_stage_code:stageCode
      }
    );

    if(!genericResponse.error){
      const genericResult=
        Array.isArray(genericResponse.data)
          ? genericResponse.data[0]
          : genericResponse.data;

      const uiResult=
        adaptStageMasteryForUi(
          genericResult,
          requestedLevel
        );

      if(
        uiResult &&
        uiResult.enough_attempts===true &&
        uiResult.coverage_passed!==true
      ){
        const missingItemCodes=
          await loadMissingStageItemCodes({
            exerciseId:genericResult?.exercise_id,
            stageId:genericResult?.stage_id,
            rollingWindow:genericResult?.rolling_window
          });

        uiResult.missing_item_codes=
          missingItemCodes;
      }else if(uiResult){
        uiResult.missing_item_codes=[];
      }

      // Ignore a late response after the learner has already moved Level.
      if(requestedLevel!==state.level){
        return uiResult;
      }

      if(uiResult){
        state.masteryPriorityItemCodes=
          Array.isArray(uiResult.missing_item_codes)
            ? [...uiResult.missing_item_codes]
            : [];

        renderMasteryProgress(uiResult);
        return uiResult;
      }
    }else{
      console.error(
        "GENERIC MASTERY UI ERROR:",
        genericResponse.error
      );
      throw genericResponse.error;
    }

    // Generic Stage Mastery is now the sole source for the Mastery Progress UI.
    // If it returns no usable row, surface an error instead of silently reading
    // the retired Level-based mastery architecture.
    throw new Error(
      `No usable mastery result for MAJOR_SCALE_NOTATION / ${stageCode}`
    );

  }catch(error){
    console.error(
      "LOAD MASTERY PROGRESS ERROR:",
      error
    );

    if(requestedLevel===state.level){
      renderMasteryProgressError();
    }

    return null;
  }
}

async function startTrainerForAuthenticatedUser(levelOverride=null){
  await closeStalePracticeSessionsForCurrentUser();

  const requestedLevel=Number(levelOverride);
  const level=(Number.isInteger(requestedLevel) && LEVEL_KEYS[requestedLevel])
    ? requestedLevel
    : await loadCurrentLevelFromProgress();
  const select=document.getElementById("levelSelect");

  if(select){
    select.value=String(level);
  }

  console.log(
    "CURRENT LEARNING LEVEL:",
    level
  );

  startSession();

  const mastery=
    await refreshMasteryProgress(level);

  if(
    mastery?.enough_attempts===true &&
    mastery?.coverage_passed!==true &&
    state.masteryPriorityItemCodes.length>0 &&
    state.sessionResults.length===0 &&
    noteCount()===0 &&
    !state.isTransitioning
  ){
    startQuestion(
      takeNextQuestionFromBag()
    );
  }
}

window.majorScaleTrainerStartForAuthenticatedUser=
  startTrainerForAuthenticatedUser;

function startSession(){

  state.level =
    Number(
      document.getElementById("levelSelect")?.value || 1
    );

  state.practiceSessionId = null;
  state.practiceSessionPromise = null;
  state.attemptSaveChain = Promise.resolve();

  const generation =
    ++state.practiceSessionGeneration;

  state.sessionQueue=[];
  state.sessionBag=[];
  state.sessionLength=null;
  state.masteryPriorityItemCodes=[];
  document.getElementById("levelStatus").textContent=
    `Level ${state.level}`;
  setMasteryProgressLoading(state.level);
  state.sessionResults=[];
  state.sessionComplete=false;
  state.questionIndex=0;
  state.lastScore=null;
  state.isTransitioning=false;

  const overlay=document.getElementById("sessionSummary");
  if(overlay) overlay.hidden=true;

  const masteryOverlay=document.getElementById("levelMasteryOverlay");
  if(masteryOverlay) masteryOverlay.hidden=true;
  const app=document.querySelector('.session-app');
  if(app){
    app.inert=false;
    app.removeAttribute('aria-hidden');
  }
  const kicker=document.querySelector('.summary-kicker');
  if(kicker) kicker.textContent="สรุปผลการฝึก";
  const restart=document.getElementById('restartSession');
  if(restart) restart.textContent="เริ่มการฝึกใหม่";

  refillSessionBag();
  startQuestion(takeNextQuestionFromBag());

}

function snapshotAttemptResponse(){
  return {
    notes:state.notes.map((note,index)=>{
      if(!note) return null;

      return {
        slot:index+1,
        letter:note.letter,
        octave:note.octave,
        accidental:note.accidental || "",
        rhythm:note.rhythm,
        stem:note.stem,
        beam_group:note.beamGroup ?? null
      };
    })
  };
}

async function saveAttemptSkillResults(attemptId, loResults){
  const client=window.majorScaleSupabase;

  if(!client || !attemptId || !loResults){
    console.error("ATTEMPT SKILL RESULTS NOT SAVED: missing client, attempt id, or LO results");
    return false;
  }

  const rows=Object.entries(loResults).map(([skillCode,evidence])=>({
    attempt_id:attemptId,
    skill_code:skillCode,
    correct_count:evidence.correct,
    total_count:evidence.total,
    score:evidence.score,
    evidence_flags:evidence.flags
  }));

  try{
    const {error}=await client
      .from("attempt_skill_results")
      .insert(rows);

    if(error) throw error;

    console.log(
      "ATTEMPT SKILL RESULTS CREATED:",
      attemptId,
      rows.length
    );

    return true;

  }catch(error){
    console.error(
      "CREATE ATTEMPT SKILL RESULTS ERROR:",
      error
    );
    return false;
  }
}

async function updatePracticeSessionProgress({
  practiceSessionId,
  completedQuestions
}){
  const client=window.majorScaleSupabase;

  if(!client || !practiceSessionId){
    console.error(
      "PRACTICE SESSION PROGRESS NOT SAVED: missing client or session id"
    );
    return false;
  }

  const updates={
    completed_questions:completedQuestions,
    last_activity_at:new Date().toISOString()
  };

  try{
    const {error}=await client
      .from("practice_sessions")
      .update(updates)
      .eq("id",practiceSessionId);

    if(error) throw error;

    console.log(
      "PRACTICE SESSION UPDATED:",
      practiceSessionId,
      `${completedQuestions} completed`
    );

    return true;

  }catch(error){
    console.error(
      "UPDATE PRACTICE SESSION ERROR:",
      error
    );
    return false;
  }
}

async function completePracticeSessionRecord(
  practiceSessionId,
  overallScore
){
  const client=window.majorScaleSupabase;

  if(!client || !practiceSessionId){
    console.error(
      "PRACTICE SESSION COMPLETION NOT SAVED: missing client or session id"
    );
    return false;
  }

  try{
    const {error}=await client
      .from("practice_sessions")
      .update({
        overall_score:overallScore,
        last_activity_at:new Date().toISOString(),
        completed_at:new Date().toISOString()
      })
      .eq("id",practiceSessionId);

    if(error) throw error;

    console.log(
      "PRACTICE SESSION COMPLETED:",
      practiceSessionId,
      overallScore
    );

    return true;

  }catch(error){
    console.error(
      "COMPLETE PRACTICE SESSION ERROR:",
      error
    );
    return false;
  }
}

async function advanceLevelIfMastered({
  generation,
  level,
  practiceSessionId
}){
  const client=window.majorScaleSupabase;

  if(
    !client ||
    generation!==state.practiceSessionGeneration
  ){
    return {
      advanced:false,
      stale:true
    };
  }

  const stageCode=`STAGE_${level}`;

  const stageCodeToLevel=value=>{
    if(!value) return null;

    const match=String(value).match(/^STAGE_(\d+)$/);
    if(!match) return null;

    const parsed=Number(match[1]);

    return Number.isInteger(parsed)
      ? parsed
      : null;
  };

  const finishMasteredSession=async mastery=>{
    if(!mastery?.advanced) return mastery;

    await completePracticeSessionRecord(
      practiceSessionId,
      mastery.overallScore
    );

    console.log(
      "STAGE MASTERED:",
      `STAGE_${mastery.completedLevel}`,
      "NEXT:",
      mastery.nextLevel===null
        ? null
        : `STAGE_${mastery.nextLevel}`
    );

    return mastery;
  };

  try{
    // Primary progression engine: generic Exercise + Stage architecture.
    const genericResponse=await client.rpc(
      "advance_my_stage_if_mastered",
      {
        p_exercise_code:"MAJOR_SCALE_NOTATION",
        p_stage_code:stageCode
      }
    );

    if(!genericResponse.error){
      const result=Array.isArray(genericResponse.data)
        ? genericResponse.data[0]
        : genericResponse.data;

      if(result){
        const completedLevel=
          stageCodeToLevel(
            result.completed_stage_code
          ) ?? level;

        const nextLevel=
          result.next_stage_code===null ||
          result.next_stage_code===undefined
            ? null
            : stageCodeToLevel(
                result.next_stage_code
              );

        const mastery={
          advanced:result.advanced===true,
          completedLevel,
          nextLevel,
          exerciseMastered:
            result.exercise_mastered===true,
          overallScore:
            result.overall_score===null ||
            result.overall_score===undefined
              ? null
              : Number(result.overall_score),
          source:"generic_stage",
          stale:false
        };


        return await finishMasteredSession(
          mastery
        );
      }
    }else{
      console.error(
        "GENERIC STAGE PROGRESSION ERROR:",
        genericResponse.error
      );
      throw genericResponse.error;
    }

    // Generic Stage Progression is now the sole progression decision engine.
    // Keep legacy data only as a compatibility mirror; never use the retired
    // Level engine to decide whether the learner advances.
    throw new Error(
      `No usable progression result for MAJOR_SCALE_NOTATION / ${stageCode}`
    );

  }catch(error){
    console.error(
      "STAGE MASTERY CHECK ERROR:",
      error
    );

    return {
      advanced:false,
      error:true,
      stale:false
    };
  }
}

function showLevelMasteryTransition(mastery){
  if(!mastery || !mastery.advanced) return;

  const overlay=document.getElementById("levelMasteryOverlay");
  const title=document.getElementById("levelMasteryTitle");
  const score=document.getElementById("levelMasteryScore");
  const message=document.getElementById("levelMasteryMessage");
  const button=document.getElementById("continueNextLevel");

  if(
    !overlay ||
    !title ||
    !score ||
    !message ||
    !button
  ) return;

  const completedLevel=mastery.completedLevel;
  const nextLevel=mastery.nextLevel;
  const overall=Number.isFinite(mastery.overallScore)
    ? Math.round(mastery.overallScore)
    : null;

  title.textContent=`ผ่าน Level ${completedLevel} แล้ว`;
  score.textContent=overall===null
    ? "ผ่าน"
    : `${overall}%`;

  if(nextLevel!==null){
    message.innerHTML=
      `<b>ผ่านเกณฑ์ Rolling Mastery</b>`+
      `<span>Level ${completedLevel} สำเร็จแล้ว • พร้อมเข้าสู่ Level ${nextLevel}</span>`;

    button.textContent=`เริ่ม Level ${nextLevel}`;
    button.dataset.nextLevel=String(nextLevel);
  }else{
    message.innerHTML=
      `<b>ผ่านแบบฝึกหัดครบทุกขั้นแล้ว</b>`+
      `<span>ขั้นที่ ${completedLevel} สำเร็จแล้ว • ดูสถานะการเรียนจบได้ในแดชบอร์ด</span>`;

    button.textContent="ดูผลการเรียน";
    button.dataset.nextLevel="";
  }

  overlay.hidden=false;
  button.focus();
}

async function saveAttemptRecord({
  generation,
  questionNumber,
  itemCode,
  score,
  responseJson,
  loResults,
  completedQuestions,
  level
}){
  const client=window.majorScaleSupabase;

  if(!client){
    console.error("Supabase client not available — attempt not saved");
    return null;
  }

  const practiceSessionId=
    await ensurePracticeSessionRecord(
      generation,
      level
    );

  if(
    generation!==state.practiceSessionGeneration ||
    !practiceSessionId
  ){
    console.error(
      "ATTEMPT NOT SAVED: practice session is unavailable or no longer current"
    );
    return null;
  }

  try{
    const {data,error}=await client
      .from("attempts")
      .insert({
        practice_session_id:practiceSessionId,
        question_number:questionNumber,
        item_code:itemCode,
        score:score,
        response_json:responseJson
      })
      .select("id")
      .single();

    if(error) throw error;

    console.log(
      "ATTEMPT CREATED:",
      data.id,
      `question ${questionNumber}`
    );

    const skillResultsSaved=await saveAttemptSkillResults(
      data.id,
      loResults
    );

    let mastery=null;

    if(skillResultsSaved){
      const progressSaved=
        await updatePracticeSessionProgress({
          practiceSessionId,
          completedQuestions
        });

      if(progressSaved){
        mastery=await advanceLevelIfMastered({
          generation,
          level,
          practiceSessionId
        });
      }
    }else{
      console.error(
        "PRACTICE SESSION PROGRESS NOT UPDATED: skill results were not fully saved"
      );
    }

    return {
      attemptId:data.id,
      mastery
    };

  }catch(error){
    console.error(
      "CREATE ATTEMPT ERROR:",
      error
    );
    return null;
  }
}

function aggregateSession(){
  const aggregate={};

  Object.keys(LO_META).forEach(id=>{
    aggregate[id]={correct:0,total:0,score:0};
  });

  state.sessionResults.forEach(result=>{
    Object.entries(result.lo).forEach(([id,evidence])=>{
      aggregate[id].correct+=evidence.correct;
      aggregate[id].total+=evidence.total;
    });
  });

  Object.values(aggregate).forEach(item=>{
    item.score=percent(item.correct,item.total);
  });

  const overall=weightedScore(aggregate);

  return{overall,aggregate};
}

function renderSessionSummary(){
  const {overall,aggregate}=aggregateSession();
  const mastery=evaluateMastery(overall,aggregate);
  const ranked=Object.entries(aggregate).filter(([,v])=>v.score!==null)
    .sort((a,b)=>b[1].score-a[1].score);

  const strong=ranked.filter(([id,v])=>v.score>=MASTERY_CRITERIA.perLO[id]);
  const weak=ranked.filter(([id,v])=>v.score<MASTERY_CRITERIA.perLO[id]);

  const strongText=strong.length
    ? strong.slice(0,3).map(([id])=>LO_META[id].short).join(" • ")
    : `ด้านที่ทำได้ดีที่สุด: ${ranked.slice(0,2).map(([id])=>LO_META[id].short).join(" • ")}`;

  const weakText=weak.length
    ? weak.slice(-3).reverse().map(([id])=>LO_META[id].short).join(" • ")
    : "ผ่านเกณฑ์รายด้านทุกด้าน";

  document.getElementById("summaryOverall").textContent=`${overall}%`;
  document.getElementById("summaryStrengths").textContent=strongText;
  document.getElementById("summaryWeaknesses").textContent=weakText;

  const status=document.getElementById("summaryMasteryStatus");
  if(status){
    status.className=`summary-mastery-status ${mastery.passed?'passed':'not-passed'}`;
    status.innerHTML=mastery.passed
      ? `<b>ผ่านเกณฑ์ Mastery</b><span>คะแนนรวม ≥ ${MASTERY_CRITERIA.overall}% และคะแนนรายด้านถึงเกณฑ์ทั้งหมด</span>`
      : `<b>ยังไม่ผ่านเกณฑ์ Mastery</b><span>ต้องได้คะแนนรวม ≥ ${MASTERY_CRITERIA.overall}% • Pitch/Accidental ≥ 90% • Duration/Beam/Stem ≥ 85%</span>`;
  }

  document.getElementById("loSummaryList").innerHTML=
    Object.entries(LO_META).map(([id,meta])=>{
      const score=aggregate[id].score;
      const minimum=MASTERY_CRITERIA.perLO[id];
      const level=
        score===null ? "not-assessed" :
        score>=minimum ? "strong" :
        score<minimum ? "weak" :
        "developing";

      return `
        <div class="lo-summary-row ${level}">
          <div class="lo-summary-name">
            <b>${id}</b>
            <span>${meta.th}</span>
          </div>
          <div class="lo-summary-bar">
            <i style="width:${score??0}%"></i>
          </div>
          <strong title="${score===null?'ไม่มี stem ให้ประเมินในชุดนี้':''}">${score===null?'N/A':score+'%'}</strong>
        </div>
      `;
    }).join("");

  document.getElementById("questionScoreStrip").innerHTML=
    state.sessionResults.map((r,i)=>
      `<span><small>${i+1}</small><b>${r.score}%</b></span>`
    ).join("");

  document.getElementById("sessionSummary").hidden=false;
}

function finishSession(){
  state.sessionComplete=true;
  state.isTransitioning=false;
  renderMeta();
  document.getElementById("nextQuestion").hidden=true;
  renderSessionSummary();
  const app=document.querySelector('.session-app');
  if(app){
    app.inert=true;
    app.setAttribute('aria-hidden','true');
  }
  document.getElementById("restartSession").focus();
}

document.getElementById("checkAnswer").onclick=()=>{
  try{
    if(state.isTransitioning || state.sessionComplete) return;

    if(noteCount()!==15){
      const box=document.getElementById("feedback");
      box.className="feedback session-feedback show bad";
      box.innerHTML=`<b>ยังตรวจไม่ได้</b> • เขียนโน้ตให้ครบ 15 ตำแหน่งก่อน (${noteCount()}/15)`;
      renderMeta();
      return;
    }

    const result=check();

    state.lastScore=result.score;

    const attemptGeneration=state.practiceSessionGeneration;
    const attemptLevel=state.level;
    const attemptQuestionNumber=state.questionIndex+1;
    const attemptItemCode=state.key.tonic;
    const attemptResponseJson=snapshotAttemptResponse();

    state.sessionResults.push({
      key:state.key.name,
      score:result.score,
      lo:result.lo
    });

    const completedQuestions=state.sessionResults.length;

    state.attemptSaveChain=state.attemptSaveChain
      .then(()=>
        saveAttemptRecord({
          generation:attemptGeneration,
          questionNumber:attemptQuestionNumber,
          itemCode:attemptItemCode,
          score:result.score,
          responseJson:attemptResponseJson,
          loResults:result.lo,
          completedQuestions,
          level:attemptLevel
        })
      )
      .then(async saveResult=>{
        if(
          attemptGeneration!==
          state.practiceSessionGeneration
        ){
          return saveResult;
        }

        const mastery=saveResult?.mastery;

        await refreshMasteryProgress(attemptLevel);

        if(mastery?.advanced){
          const nextButton=
            document.getElementById("nextQuestion");

          if(nextButton){
            nextButton.disabled=true;
            nextButton.hidden=true;
          }

          showLevelMasteryTransition(mastery);
        }else{
          const nextButton=
            document.getElementById("nextQuestion");

          if(nextButton){
            nextButton.disabled=false;
            nextButton.hidden=false;
            nextButton.textContent="ทำข้อต่อไป";
          }
        }

        return saveResult;
      });

    renderMeta();

    const box=document.getElementById("feedback");
    box.className="feedback session-feedback show "+(result.score>=90?"good":"bad");
    box.innerHTML=questionFeedback(result);

    state.isTransitioning=true;
    setQuestionReviewMode(true);

    const nextButton=document.getElementById("nextQuestion");
    if(nextButton){
      nextButton.disabled=true;
      nextButton.hidden=false;
      nextButton.textContent="กำลังบันทึกและประเมิน...";
    }

  }catch(err){
    console.error(err);
    state.isTransitioning=false;

    const box=document.getElementById("feedback");
    box.className="feedback session-feedback show bad";
    box.innerHTML="<b>เกิดข้อผิดพลาดระหว่างตรวจคำตอบ</b> • "+
      String(err && err.message ? err.message : err);

    const button=document.getElementById("checkAnswer");
    if(button){
      button.disabled=false;
      button.textContent="ตรวจคำตอบ";
    }
  }
};

document.getElementById("continueNextLevel").onclick=async()=>{
  const button=document.getElementById("continueNextLevel");
  const overlay=document.getElementById("levelMasteryOverlay");
  const nextLevel=Number(button?.dataset.nextLevel);

  if(overlay) overlay.hidden=true;

  if(
    Number.isInteger(nextLevel) &&
    LEVEL_KEYS[nextLevel]
  ){
    const select=document.getElementById("levelSelect");

    if(select){
      select.value=String(nextLevel);
    }

    startSession();
    await refreshMasteryProgress(nextLevel);
    return;
  }

  // Level 4 is the final Level in the current pathway.
  state.sessionComplete=true;
  state.isTransitioning=false;

  const nextButton=document.getElementById("nextQuestion");
  if(nextButton){
    nextButton.hidden=true;
    nextButton.disabled=true;
  }

  document.getElementById("levelStatus").textContent=
    `Level ${state.level} • Mastered`;

  renderMeta();

  const dashboardButton=document.getElementById("dashboardButton");
  if(dashboardButton){
    dashboardButton.click();
  }
};

document.getElementById("nextQuestion").onclick=()=>{
  if(state.sessionComplete) return;

  startQuestion(
    takeNextQuestionFromBag()
  );
};

// During feedback review, Enter advances only when the explicit Next button is visible.
document.addEventListener("keydown",ev=>{
  if(ev.key!=="Enter" || ev.ctrlKey || ev.metaKey || ev.altKey || ev.isComposing) return;
  if(state.sessionComplete || !state.isTransitioning || ev.target.closest?.("button,input,select,textarea,a")) return;
  const nextButton=document.getElementById("nextQuestion");
  if(nextButton && !nextButton.hidden && !nextButton.disabled){
    ev.preventDefault();
    ev.stopImmediatePropagation();
    nextButton.click();
  }
},true);

function taskText(){
  const fontWarning=state.smuflFontReady===false
    ? `<span class="font-warning">Bravura/SMuFL ยังโหลดไม่สำเร็จ</span>`
    : "";

  return `
    <strong>เขียนบันไดเสียง ${state.key.name}</strong>
    <span>ขาขึ้น–ขาลงตาม Rhythm Pattern โดยใส่ accidental, stem และ beam ให้ถูกต้อง</span>
    ${fontWarning}
  `;
}

function renderMeta(){
  // Deliberately minimal: learner-facing progress is shown by the
  // gamified Mastery power bar instead of duplicate counters.
}

function cleanInvalidBeam(note){
 if(note && note.beamGroup && !["eighth","sixteenth"].includes(note.rhythm)){
   const group=note.beamGroup;
   state.notes.forEach(n=>{
     if(n && n.beamGroup===group)n.beamGroup=null;
   });
 }
}

function render(){
  document.getElementById("taskText").innerHTML=taskText();
  drawScore();
  renderMeta();
}

let resizeFrame=0;
new ResizeObserver(()=>{
 cancelAnimationFrame(resizeFrame);
 resizeFrame=requestAnimationFrame(()=>drawScore());
}).observe(scoreSvg);

function hideFeedback(){
  const b=document.getElementById("feedback");
  if(!b) return;

  b.className="feedback session-feedback";
  b.innerHTML="";
  b.removeAttribute("style");
}

document.getElementById("restartSession").onclick=startSession;
document.getElementById("levelSelect").addEventListener("change",ev=>{
  const select=ev.currentTarget;
  const hasProgress=noteCount()>0 || state.sessionResults.length>0;
  if(!state.sessionComplete && hasProgress){
    const proceed=window.confirm("เปลี่ยนระดับจะเริ่มชุดใหม่และล้างคำตอบ/ผลของชุดปัจจุบัน ต้องการดำเนินการต่อหรือไม่?");
    if(!proceed){
      select.value=String(state.level);
      return;
    }
  }
  startSession();
});

// Keep keyboard focus inside the summary dialog. `inert` handles modern browsers;
// this is a small fallback for older engines.
document.addEventListener('keydown',ev=>{
  const overlay=document.getElementById('sessionSummary');
  if(!overlay || overlay.hidden || ev.key!=="Tab") return;
  const focusables=[...overlay.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
    .filter(el=>!el.disabled && !el.hidden);
  if(!focusables.length) return;
  ev.preventDefault();
  const current=focusables.indexOf(document.activeElement);
  const next=ev.shiftKey
    ? (current<=0 ? focusables.length-1 : current-1)
    : (current<0 || current===focusables.length-1 ? 0 : current+1);
  focusables[next].focus();
},true);

async function initializeTrainerAfterMusicFont(){
  // Wait for the scoring font, but never leave the application blocked forever
  // when a network or CDN is unavailable.
  let bravuraReady=false;

  try{
    if(document.fonts && document.fonts.load){
      const timeout=new Promise(resolve=>setTimeout(resolve,5000));
      await Promise.race([
        Promise.all([
          document.fonts.load('72px "TrainerBravura"'),
          document.fonts.load('68px "Noto Music"')
        ]),
        timeout
      ]);

      bravuraReady=document.fonts.check('72px "TrainerBravura"');
    }
  }catch(err){
    console.warn("Music font loading warning:", err);
  }

  state.smuflFontReady=bravuraReady;

  if(!bravuraReady){
    console.warn(
      "Bravura scoring font is unavailable. The editor will open, "+
      "but SMuFL score glyphs may not display correctly until the font can load."
    );
  }

  document.documentElement.classList.remove("music-font-loading");
  drawExample();

  if(state.practiceSessionGeneration===0){
    startSession();
  }else{
    render();
  }
}

// Keep keyboard input in the same module as the notation state. The former
// standalone prototype could not see these module-scoped functions.
window.majorScaleTrainerKeyboard={
  insertLetter(letter){
    if(state.sessionComplete || state.isTransitioning)return;
    // Successive letter keys write successive slots. Arrow navigation and
    // click selection remain available for editing an occupied slot.
    if(state.notes[state.cursorIndex]){
      const next=nextEmptyIndex();
      if(state.notes[next])return;
      state.cursorIndex=next;
    }
    const current=stepToPitch(state.cursorStaffStep);
    let bestStep=state.cursorStaffStep;
    let bestDistance=Infinity;

    for(let octave=current.octave-1;octave<=current.octave+1;octave++){
      const candidate=pitchToStep(letter,octave);
      const distance=Math.abs(candidate-state.cursorStaffStep);
      if(distance<bestDistance){
        bestDistance=distance;
        bestStep=candidate;
      }
    }

    state.cursorStaffStep=bestStep;
    insertNoteAtCursor();
  },
  setRhythm(key){
    const rhythm={"1":"whole","2":"half","3":"quarter","4":"eighth","5":"sixteenth"}[key];
    if(!rhythm)return;
    setTool("rhythm",rhythm);
  },
  setAccidental(key){
    const accidental={"+":"#","-":"b","*":"##","/":"bb"}[key];
    if(accidental===undefined)return;
    setTool("accidental",accidental);
  }
};

initializeTrainerAfterMusicFont();
})();
