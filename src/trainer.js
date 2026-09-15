
(() => {
"use strict";

const masteryLearningCore=window.MajorScaleApp.masteryLearningCore;
const learningRepository=window.MajorScaleApp.learningRepository;
const notationCore=window.MajorScaleApp.notationCore;
const notationRenderer=window.MajorScaleApp.notationRenderer;
const notationInteraction=window.MajorScaleApp.notationInteraction;
const notationBeaming=window.MajorScaleApp.notationBeaming;
const majorScaleModule=window.MajorScaleApp.majorScaleDomain;
const majorScaleConfig=window.MajorScaleApp.majorScaleConfig;
const {KEYS,LEVEL_KEYS,LO_META}=majorScaleConfig;
const majorScaleRules=majorScaleModule.createRules({autoStem,beamStemDirectionFromNotes,pitchToStep,effectiveStem,beamGroupSignatures});
const SHARP_ORDER=["F","C","G","D","A","E","B"], FLAT_ORDER=["B","E","A","D","G","C","F"];
const LETTERS=["C","D","E","F","G","A","B"];

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
 masteryPriorityItemCodes:[],
 sessionMode:"practice",
 diagnosticItemCodes:[],
 pathStageEnforced:false,
 authoritativeStageCode:null,
 authoritativeLevel:null
};

function stageContextFromCode(stageCode){
  const match=/^STAGE_(\d+)$/.exec(String(stageCode || '').trim());
  if(!match) return {stageCode:null,level:null};
  const level=Number(match[1]);
  if(!Number.isInteger(level) || !LEVEL_KEYS[level]) return {stageCode:null,level:null};
  return {stageCode:`STAGE_${level}`,level};
}

function configurePathStageAuthority(stageCode){
  const resolved=stageContextFromCode(stageCode);
  state.pathStageEnforced=resolved.level!==null;
  state.authoritativeStageCode=resolved.stageCode;
  state.authoritativeLevel=resolved.level;
  return resolved;
}

function effectiveSessionLevel(candidate=state.level){
  if(state.pathStageEnforced && Number.isInteger(state.authoritativeLevel)) return state.authoritativeLevel;
  const parsed=Number(candidate);
  if(Number.isInteger(parsed) && LEVEL_KEYS[parsed]) return parsed;
  return Number.isInteger(state.level) && LEVEL_KEYS[state.level] ? state.level : 1;
}

function enforceAuthoritativeLevelControl(){
  const select=document.getElementById("levelSelect");
  if(!select) return;
  if(state.pathStageEnforced && Number.isInteger(state.authoritativeLevel)){
    select.value=String(state.authoritativeLevel);
    select.disabled=true;
    select.setAttribute("aria-disabled","true");
    select.title="ระดับนี้กำหนดโดย Learning Path";
    return;
  }
  select.disabled=state.sessionMode==="pretest";
  if(!select.disabled) select.removeAttribute("aria-disabled");
}

function acceptTrustedAdvancedLevel(nextLevel){
  const parsed=Number(nextLevel);
  if(!state.pathStageEnforced || !Number.isInteger(parsed) || !LEVEL_KEYS[parsed]) return;
  state.authoritativeLevel=parsed;
  state.authoritativeStageCode=`STAGE_${parsed}`;
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
  return majorScaleRules.buildExpected(key);
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

function musicEm(staffObj){return notationCore.musicEm(staffObj);}
function sp(staffObj,value=1){return notationCore.sp(staffObj,value);}

function accidentalSmuflGlyph(value){return notationRenderer.accidentalSmuflGlyph(value,SMUFL);}
function el(name,attrs={},text=""){return notationRenderer.createSvgElement(name,attrs,text);}
function pitchToStep(letter,octave){return notationCore.pitchToStep(letter,octave);}
function stepToPitch(step){return notationCore.stepToPitch(step);}

function drawSignature(svg,key,signatureMode,staff){
 return notationRenderer.drawKeySignature(svg,key,signatureMode,staff,{
   sharpOrder:SHARP_ORDER,
   flatOrder:FLAT_ORDER,
   sharpGlyph:SMUFL.accidentalSharp,
   flatGlyph:SMUFL.accidentalFlat,
   fontSize:musicEm(staff),
   fontFamily:SMUFL_FONT,
   advance:sp(staff,1.05)
 });
}

function rightEdgeOfSvgClass(svg,className){return notationRenderer.rightEdgeOfSvgClass(svg,className);}

function drawTimeSignature(svg,staff,x){
 return notationRenderer.drawTimeSignature(svg,staff,x,{
   glyph:SMUFL.timeSig4,
   fontSize:musicEm(staff),
   fontFamily:SMUFL_FONT,
   measureText:measureSvgTextGlyph
 });
}
function drawLedger(svg,x,step,stepToY){return notationRenderer.drawLedger(svg,x,step,stepToY);}

/* Example */
const exampleSvg=document.getElementById("exampleSvg");
function drawExample(){
 const svg=exampleSvg, staff={x1:88,x2:1065,top:68,spacing:17,sigX:120};
 const stepToY=s=>staff.top+staff.spacing*4-s*(staff.spacing/2);
 svg.innerHTML="";svg.appendChild(el("rect",{x:0,y:0,width:1100,height:205,fill:"#fff"}));
 notationRenderer.drawStaffLines(svg,staff,{strokeWidth:1.55});
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
 [570,990].forEach(x=>notationRenderer.drawBarline(svg,x,staff,{strokeWidth:1.7}));
 notationRenderer.drawDoubleBarline(svg,1050,1058,staff);

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
  return notationCore.clampStaffStep(step,MIN_STAFF_STEP,MAX_STAFF_STEP);
}


function noteheadHalfWidthForRhythm(svg,rhythm,staffObj=staff){
  return notationRenderer.noteheadHalfWidthForRhythm(svg,rhythm,{
    smufl:SMUFL,
    fontSize:musicEm(staffObj),
    fontFamily:SMUFL_FONT
  });
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
  const leftExtents=indices.map(i=>slotLeftExtent(svg,i,staff));
  const rightExtents=indices.map(i=>slotRightExtent(svg,i,staff));
  return notationRenderer.layoutMeasureWithinBounds(indices,leftBoundary,rightBoundary,{
    leadingPad:options.leadingPad ?? sp(staff,0.35),
    trailingPad:options.trailingPad ?? sp(staff,0.55),
    preferredGap:options.preferredGap ?? sp(staff,0.40),
    minimumGap:options.minimumGap ?? sp(staff,0.12),
    edgeShareMax:sp(staff,0.55),
    leftExtents,
    rightExtents,
    basePositions:baseNoteXs,
    positions:noteXs
  });
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


function stepToY(step){return notationInteraction.staffStepToY(step,staff);}
function yToStep(y){return notationInteraction.staffYToStep(y,staff);}
let compactScore=false;
const COMPACT_X_OFFSETS=[75,550,1085];
const COMPACT_ROW_HEIGHT=220;
function arrangeCompactScore(){
 const stageWidth=scoreSvg.parentElement.clientWidth;
 const viewportWidth=window.visualViewport?.width || window.innerWidth || stageWidth;
 const viewportHeight=window.visualViewport?.height || window.innerHeight || Number.POSITIVE_INFINITY;
 const landscape=viewportWidth>viewportHeight;
 compactScore=stageWidth<800 && !landscape;
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
 notationRenderer.drawStaffLines(svg,staff);
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

 [690,1225].forEach(x=>notationRenderer.drawBarline(svg,x,staff));
 notationRenderer.drawDoubleBarline(svg,1350,1358,staff);

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

function measureSvgTextGlyph(svg,glyph,fontSize,fontFamily){return notationRenderer.measureSvgTextGlyph(svg,glyph,fontSize,fontFamily);}

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
  const note=state.notes[noteIndex];
  return notationRenderer.drawAccidentalForNote(
    group,scoreSvg,accToShow,noteX,noteY,fill,
    note ? note.rhythm : "quarter",
    {
      smufl:SMUFL,
      fontSize:musicEm(staff),
      fontFamily:SMUFL_FONT,
      accidentalToNoteGap:sp(staff,0.30)
    }
  );
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

 notationRenderer.drawNotehead(g,svg,x,y,n.rhythm,fill,{
   smufl:SMUFL,
   fontSize:musicEm(staff),
   fontFamily:SMUFL_FONT
 });
 const accToShow=state.signatureMode==="shown"?"":n.accidental;
 if(accToShow){
   drawAccidentalForNote(g,accToShow,x,y,fill,i);
 }
 if(n.rhythm!=="whole"){
   const groupItems=n.beamGroup ? state.notes.map((note,idx)=>note&&note.beamGroup===n.beamGroup?{n:note,i:idx}:null).filter(Boolean) : [];
   const dir=groupItems.length>1 ? getBeamDirection(groupItems) : (n.stem==="auto"?autoStem(n.letter,n.octave):n.stem);
   notationRenderer.drawStemAndFlag(g,x,y,n.rhythm,fill,dir,n.beamGroup,{
     smufl:SMUFL,
     fontSize:musicEm(staff),
     fontFamily:SMUFL_FONT
   });
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
  return notationInteraction.nearestSlotIndexToX(x,noteXs);
}

function nearestOccupiedIndexToX(x){
  return notationInteraction.nearestOccupiedIndexToX(x,noteXs,state.notes);
}

function selectNoteRange(anchorIndex,currentIndex){
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

function noteTargetFromEvent(ev){
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

  const deltaSteps=notationInteraction.dragDeltaSteps(
    noteInteraction.startY,
    local.y,
    staff.spacing
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
    const {completedByDrag,completedBySecondTap}=notationInteraction.rangeGestureCompletion(
      noteInteraction,
      state.mobileRangeAnchorIndex
    );

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

    notationInteraction.resetPointerInteraction(noteInteraction);

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

  notationInteraction.resetPointerInteraction(noteInteraction);

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

  notationInteraction.resetPointerInteraction(noteInteraction);
});


function getBeamDirection(items){
  return notationBeaming.getBeamDirection(items);
}

function getBeamLevel(note){
  return notationBeaming.getBeamLevel(note);
}

function buildBeamSegments(items){
  return notationBeaming.buildBeamSegments(items);
}

function drawBeams(){
  return notationBeaming.drawBeams(scoreSvg,state.notes,noteXs,{
    stepToY,
    pitchToStep,
    createSvgElement:el
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
  return notationBeaming.normalizeBeamGroups(state.notes,{
    newGroupId:newBeamGroupId,
    measureOfIndex:i=>Math.floor(i/7)
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
 const validation=notationBeaming.validateBeamSelection(idx,state.notes,i=>Math.floor(i/7));
 if(!validation.ok){
   if(validation.reason==="minimum") return alert("เลือกอย่างน้อย 2 โน้ต: คลิกตัวแรก แล้ว Shift+Click ตัวสุดท้าย หรือใช้ปุ่ม เลือกหลายโน้ต");
   if(validation.reason==="contiguous") return alert("กรุณาเลือกโน้ตที่อยู่ติดกัน");
   if(validation.reason==="rhythm") return alert("Beam ได้เฉพาะ eighth/sixteenth notes");
   if(validation.reason==="measure") return alert("เลือกโน้ตในห้องเดียวกันเพื่อ Beam");
 }
 const gid=newBeamGroupId();
 const groupDir=effectiveStem(state.notes[idx[0]]) || autoStem(state.notes[idx[0]].letter,state.notes[idx[0]].octave);
 notationBeaming.applyBeamGroup(state.notes,idx,gid,groupDir);
 normalizeBeamGroups();render();
};
document.getElementById("unbeamSelected").onclick=()=>{
  notationBeaming.clearSelectedBeamGroups(state.notes,state.selectedIds);
  normalizeBeamGroups();
  render();
};

const percent=majorScaleModule.percent;

function meanScore(evidence){
  const scores=Object.values(evidence).map(item=>item.score).filter(Number.isFinite);
  return scores.length ? Math.round(scores.reduce((sum,n)=>sum+n,0)/scores.length) : null;
}

const weightedScore=majorScaleModule.weightedScore;

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

function effectiveStem(note){
  if(!note || note.rhythm==="whole") return null;
  return note.stem==="auto"
    ? autoStem(note.letter,note.octave)
    : note.stem;
}

function beamGroupSignatures(notes){
  return notationBeaming.beamGroupSignatures(notes);
}

function check(){
  return majorScaleRules.evaluateAnswer(buildExpected(),state.notes);
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

const QUESTION_RESULT_SKILL_ORDER=[
  "BN01_TREBLE_PITCH",
  "BN06_STEM_DIRECTION",
  "RH01_DURATION_VALUE",
  "GR02_PRIMARY_BEAM",
  "MS03_SCALE_ACCIDENTAL"
];
const QUESTION_ERROR_PRIORITY=[
  "BN01_TREBLE_PITCH",
  "MS03_SCALE_ACCIDENTAL",
  "RH01_DURATION_VALUE",
  "GR02_PRIMARY_BEAM",
  "BN06_STEM_DIRECTION"
];

function feedbackEscapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,char=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}
function feedbackSkillName(code){
  const display={
    BN01_TREBLE_PITCH:"Treble Pitch",
    BN06_STEM_DIRECTION:"Stem Direction",
    RH01_DURATION_VALUE:"Duration Value",
    GR02_PRIMARY_BEAM:"Primary Beam",
    MS03_SCALE_ACCIDENTAL:"Scale Accidental"
  };
  return display[code] || LO_META[code]?.short || code;
}
function feedbackKeyLabel(name){
  return String(name||state.key?.tonic||"Major Scale")
    .replace(/##/g,"𝄪").replace(/bb/g,"𝄫").replace(/#/g,"♯").replace(/b/g,"♭")
    .replace(/major/ig,"Major");
}
function feedbackAccidental(value){
  return ({"#":"♯","b":"♭","##":"𝄪","bb":"𝄫","":""})[value||""] ?? String(value||"");
}
function feedbackRhythm(value){
  return ({whole:"whole note",half:"half note",quarter:"quarter note",eighth:"eighth note",sixteenth:"sixteenth note"})[value] || String(value||"ไม่พบค่า");
}
function buildQuestionDiagnosticErrors(result){
  const labels=feedbackUnitLabels();
  const expected=Array.isArray(result?.expected)?result.expected:[];
  const actual=state.notes;
  const errors=[];
  const add=(skillCode,index,message,positions=[])=>errors.push({
    skillCode,
    unitIndex:index,
    unitLabel:labels[skillCode]?.[index]||`หน่วย ${index+1}`,
    message,
    positions
  });

  const pitch=result?.lo?.BN01_TREBLE_PITCH;
  pitch?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const want=expected[index]?.letter||"—",got=actual[index]?.letter||"ไม่พบโน้ต";
    add("BN01_TREBLE_PITCH",index,`โน้ตตำแหน่ง ${index+1}: ควรเป็น ${want} แต่เขียน ${got}`,[index+1]);
  });

  const stem=result?.lo?.BN06_STEM_DIRECTION;
  stem?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const unit=labels.BN06_STEM_DIRECTION[index]||`หน่วย ${index+1}`;
    add("BN06_STEM_DIRECTION",index,`${unit}: ทิศทางก้านไม่ตรงตามเกณฑ์ของตำแหน่งโน้ตที่เขียน`,[]);
  });

  const rhythm=result?.lo?.RH01_DURATION_VALUE;
  rhythm?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const want=feedbackRhythm(expected[index]?.rhythm),got=feedbackRhythm(actual[index]?.rhythm);
    add("RH01_DURATION_VALUE",index,`โน้ตตำแหน่ง ${index+1}: ควรเป็น ${want} แต่เป็น ${got}`,[index+1]);
  });

  const beam=result?.lo?.GR02_PRIMARY_BEAM;
  beam?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const unit=labels.GR02_PRIMARY_BEAM[index]||`Beam หน่วย ${index+1}`;
    const message=index<4
      ? `${unit}: ควรรวบ Beam เป็นกลุ่มเดียวกันตาม rhythmic pattern`
      : `${unit}: มี Beam เกินหรือจัดกลุ่มไม่ตรงกับ rhythmic pattern ที่กำหนด`;
    add("GR02_PRIMARY_BEAM",index,message,[]);
  });

  const accidental=result?.lo?.MS03_SCALE_ACCIDENTAL;
  accidental?.flags?.forEach((flag,index)=>{
    if(flag!==false)return;
    const note=expected[index],written=actual[index];
    const expectedAcc=note?.accidental||"",actualAcc=written?.accidental||"";
    const expectedText=expectedAcc
      ? `${note?.letter||""}${feedbackAccidental(expectedAcc)}`
      : `${note?.letter||""} โดยไม่มีเครื่องหมายแปลงเสียง`;
    const actualText=actualAcc?`${written?.letter||note?.letter||""}${feedbackAccidental(actualAcc)}`:"ไม่มีเครื่องหมายแปลงเสียง";
    add("MS03_SCALE_ACCIDENTAL",index,`โน้ตตำแหน่ง ${index+1}: ควรเป็น ${expectedText}; พบ ${actualText}`,[index+1]);
  });

  return errors.sort((a,b)=>
    QUESTION_ERROR_PRIORITY.indexOf(a.skillCode)-QUESTION_ERROR_PRIORITY.indexOf(b.skillCode) ||
    a.unitIndex-b.unitIndex
  );
}

function buildQuestionResult(result){
  const skills=QUESTION_RESULT_SKILL_ORDER.map(skillCode=>{
    const evidence=result?.lo?.[skillCode]||{};
    const total=Number(evidence.total||0),correct=Number(evidence.correct||0);
    const score=evidence.score===null||evidence.score===undefined?null:Number(evidence.score);
    return{
      skillCode,
      label:feedbackSkillName(skillCode),
      score,
      correct,
      total,
      threshold:MASTERY_CRITERIA.perLO[skillCode]??null,
      status:score===null?"not-assessed":(total>0&&correct===total?"correct":"incorrect")
    };
  });
  return{
    questionNumber:state.questionIndex+1,
    itemCode:state.key?.tonic||"",
    keyLabel:feedbackKeyLabel(state.key?.name||state.key?.tonic),
    score:Number(result?.score),
    skills,
    errors:buildQuestionDiagnosticErrors(result),
    checkedAt:new Date().toISOString()
  };
}

function renderQuestionFeedback(questionResult){
  const skillRows=questionResult.skills.map(skill=>{
    const correct=skill.status==="correct";
    const notAssessed=skill.status==="not-assessed";
    const icon=notAssessed?"—":correct?"✓":"✕";
    const text=notAssessed?"Not assessed":correct?"Correct":"Needs review";
    return `<div class="df-question-skill ${correct?'is-correct':'is-review'}" role="listitem"><span class="df-icon" aria-hidden="true">${icon}</span><div><strong>${feedbackEscapeHtml(skill.label)}</strong><small>${feedbackEscapeHtml(skill.skillCode)}${skill.score===null?'':` · ${skill.score}%`}</small></div><span class="df-result-text">${text}</span></div>`;
  }).join("");

  const bySkill=new Map();
  questionResult.errors.forEach(error=>{
    if(!bySkill.has(error.skillCode))bySkill.set(error.skillCode,[]);
    bySkill.get(error.skillCode).push(error);
  });
  const groupedErrors=[...bySkill.entries()]
    .sort((a,b)=>QUESTION_ERROR_PRIORITY.indexOf(a[0])-QUESTION_ERROR_PRIORITY.indexOf(b[0]));
  const diagnostic=groupedErrors.length
    ? `<div class="df-question-diagnostic"><h3>รายละเอียดจุดผิดทั้งหมด</h3>${groupedErrors.map(([skillCode,errors])=>`<div class="df-diagnostic-item"><strong>${feedbackEscapeHtml(feedbackSkillName(skillCode))}</strong><ul>${errors.map(error=>`<li>${feedbackEscapeHtml(error.message)}</li>`).join("")}</ul></div>`).join("")}</div>`
    : `<div class="df-question-good"><span aria-hidden="true">✓</span> ไม่พบข้อผิดพลาดในเกณฑ์ที่ประเมิน</div>`;

  const questionScores=state.sessionResults.map((item,i)=>
    `<span class="feedback-qscore ${i===state.questionIndex?'current':''}"><small>ข้อ ${i+1}</small><b>${item.score}%</b></span>`
  ).join("");

  return `<div class="df-question-skills" role="list" aria-label="ผลรายทักษะของข้อนี้">${skillRows}</div>${diagnostic}<div class="feedback-history"><b>คะแนนรายข้อ</b><div class="feedback-question-strip">${questionScores}</div></div>`;
}

function questionFeedback(result){
  return renderQuestionFeedback(buildQuestionResult(result));
}

function publishQuestionResult(questionResult){
  const app=window.MajorScaleApp=window.MajorScaleApp||{};
  app.lastQuestionResult=questionResult;
  app.diagnosticQuestionResults=state.sessionResults.map(item=>item.diagnostic).filter(Boolean);
  if(typeof window.dispatchEvent==="function"&&typeof window.CustomEvent==="function"){
    window.dispatchEvent(new CustomEvent("major-scale-question-result",{detail:questionResult}));
  }
}

function publishDiagnosticSessionStart(detail){
  const app=window.MajorScaleApp=window.MajorScaleApp||{};
  app.lastDiagnosticSessionStart={...(detail||{})};
  app.diagnosticQuestionResults=[];
  if(typeof window.dispatchEvent==="function"&&typeof window.CustomEvent==="function"){
    window.dispatchEvent(new CustomEvent("major-scale-session-start",{detail:app.lastDiagnosticSessionStart}));
  }
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
  state.sessionBag=majorScaleModule.createSessionBag(state.level,state.sessionResults.length>0 ? state.key?.tonic : null);
}

function takeNextQuestionFromBag(){
  if(state.sessionMode==="pretest"){
    return state.sessionBag.shift() || null;
  }
  const next=majorScaleModule.takeNextQuestion({
    level:state.level,
    sessionBag:state.sessionBag,
    masteryPriorityItemCodes:state.masteryPriorityItemCodes,
    previousTonic:state.sessionResults.length>0 ? state.key?.tonic : null
  });
  state.sessionBag=next.bag;
  if(next.priority) console.log("MASTERY-AWARE QUESTION:",next.key.name);
  return next.key;
}

async function resolveMajorScaleExerciseStage(level){
  const repo=window.MajorScaleApp?.practiceRepository;

  if(!repo){
    throw new Error("Practice repository not available");
  }

  const {data:exercise,error:exerciseError}=
    await repo.getRequiredActiveExerciseByCode(
      majorScaleConfig.exerciseCode
    );

  if(exerciseError) throw exerciseError;

  const stageCode=`STAGE_${level}`;

  const {data:stage,error:stageError}=
    await repo.getRequiredActiveStageByCode(
      exercise.id,
      stageCode
    );

  if(stageError) throw stageError;

  return {
    exerciseId:exercise.id,
    stageId:stage.id
  };
}

async function createPracticeSessionRecord(generation, level){

  if(state.sessionMode==="teacher_demo"){
    return null;
  }

  const sessionLevel=effectiveSessionLevel(level);
  const app=window.MajorScaleApp || {};
  const authRepository=app.authRepository;
  const practiceRepository=app.practiceRepository;

  if(!authRepository || !practiceRepository){
    console.error("Supabase data repositories not available");
    return;
  }

  try{

    const {
      data:{user},
      error:userError
    } = await authRepository.getUser();

    if(userError) throw userError;

    if(!user){
      console.log("No authenticated user — session not saved");
      return;
    }

    const {
      exerciseId,
      stageId
    }=await resolveMajorScaleExerciseStage(sessionLevel);

    const {data,error}=
      await practiceRepository.createPracticeSession({
        user_id:user.id,
        exercise_id:exerciseId,
        stage_id:stageId,
        mode:state.sessionMode,
        planned_questions:Number.isInteger(state.sessionLength) ? state.sessionLength : null,
        completed_questions:0,
        app_version:"0.9.1"
      });

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
  const app=window.MajorScaleApp || {};
  const authRepository=app.authRepository;
  const practiceRepository=app.practiceRepository;

  if(!authRepository || !practiceRepository) return 0;

  try{
    const {
      data:{user},
      error:userError
    }=await authRepository.getUser();

    if(userError) throw userError;
    if(!user) return 0;

    const loadOpen=practiceRepository.getOpenLearningSessions
      ? practiceRepository.getOpenLearningSessions.bind(practiceRepository)
      : practiceRepository.getOpenPracticeSessions.bind(practiceRepository);
    const {data:sessions,error:sessionError}=await loadOpen(user.id);

    if(sessionError) throw sessionError;
    if(!sessions?.length) return 0;

    let closed=0;

    for(const session of sessions){
      const inferredCompletedAt=
        session.last_activity_at ||
        session.started_at ||
        new Date().toISOString();

      const {error}=
        await practiceRepository.closePracticeSession({
          sessionId:session.id,
          completedAt:inferredCompletedAt,
          onlyIfOpen:false
        });

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
  const practiceRepository=
    window.MajorScaleApp?.practiceRepository;

  if(!practiceRepository) return false;

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

    const {error}=
      await practiceRepository.closePracticeSession({
        sessionId:practiceSessionId,
        completedAt:closedAt,
        onlyIfOpen:true
      });

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
  const app=window.MajorScaleApp || {};
  const authRepository=app.authRepository;
  const masteryRepository=app.masteryRepository;

  if(!authRepository || !masteryRepository){
    console.error("Supabase data repositories not available — using Level 1");
    return 1;
  }

  let user=null;

  try{
    const {
      data:{user:authenticatedUser},
      error:userError
    }=await authRepository.getUser();

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
    const {data:exercise,error:exerciseError}=
      await masteryRepository.getOptionalActiveExerciseByCode(
        majorScaleConfig.exerciseCode
      );

    if(exerciseError) throw exerciseError;

    if(exercise?.id){
      const {data:stages,error:stagesError}=
        await masteryRepository.getActiveStagesForExercise(
          exercise.id
        );

      if(stagesError) throw stagesError;

      const stageRows=Array.isArray(stages) ? stages : [];
      const stageIds=stageRows.map(row=>row.id).filter(Boolean);

      if(stageIds.length){
        const {data:progressRows,error:progressError}=
          await masteryRepository.getInProgressStageProgress(
            user.id,
            stageIds
          );

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
  const app=window.MajorScaleApp || {};
  const authRepository=app.authRepository;
  const masteryRepository=app.masteryRepository;

  if(
    !authRepository ||
    !masteryRepository ||
    !exerciseId ||
    !stageId ||
    !rollingWindow
  ){
    return [];
  }

  try{
    const {data:required,error:requiredError}=
      await masteryRepository.getRequiredStageItems(
        stageId
      );

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
    }=await authRepository.getUser();

    if(userError) throw userError;
    if(!user) return [];

    const {data:sessions,error:sessionsError}=
      await masteryRepository.getPracticeSessionsForStage({
        userId:user.id,
        exerciseId,
        stageId
      });

    if(sessionsError) throw sessionsError;

    const sessionIds=
      (sessions || []).map(row=>row.id);

    if(!sessionIds.length){
      return requiredCodes;
    }

    const {data:attempts,error:attemptsError}=
      await masteryRepository.getRecentAttemptItems(
        sessionIds,
        rollingWindow
      );

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
  const masteryRepository=
    window.MajorScaleApp?.masteryRepository;

  if(!masteryRepository){
    renderMasteryProgressError();
    return null;
  }

  const requestedLevel=Number(level);
  const stageCode=`STAGE_${requestedLevel}`;

  setMasteryProgressLoading(requestedLevel);

  try{
    // Primary source: generic Exercise + Stage mastery architecture.
    const genericResponse=
      await masteryRepository.getStageMastery({
        exerciseCode:majorScaleConfig.exerciseCode,
        stageCode
      });

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
      `No usable mastery result for ${majorScaleConfig.exerciseCode} / ${stageCode}`
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

async function startTrainerForAuthenticatedUser(levelOverride=null,sessionMode="practice",stageCode=null){
  state.sessionMode=masteryLearningCore?.normalizeSessionMode(sessionMode) || "practice";
  if(state.sessionMode!=="teacher_demo"){
    await closeStalePracticeSessionsForCurrentUser();
  }
  configurePathStageAuthority(stageCode);

  const requestedLevel=state.pathStageEnforced ? state.authoritativeLevel : Number(levelOverride);
  const level=(Number.isInteger(requestedLevel) && LEVEL_KEYS[requestedLevel])
    ? requestedLevel
    : await loadCurrentLevelFromProgress();
  const select=document.getElementById("levelSelect");

  if(select){
    select.value=String(level);
  }
  enforceAuthoritativeLevelControl();

  console.log(
    "CURRENT LEARNING LEVEL:",
    level,
    "MODE:",
    state.sessionMode
  );

  state.diagnosticItemCodes=[];
  if(state.sessionMode==="pretest"){
    const masteryRepository=window.MajorScaleApp?.masteryRepository;
    const {stageId}=await resolveMajorScaleExerciseStage(level);
    const required=masteryRepository
      ? await masteryRepository.getRequiredStageItems(stageId)
      : {data:[],error:null};
    if(required?.error) throw required.error;
    state.diagnosticItemCodes=masteryLearningCore.buildDiagnosticItemCodes(
      required?.data || [],
      LEVEL_KEYS[level] || []
    );
    if(!state.diagnosticItemCodes.length){
      throw new Error("ไม่มีโจทย์ Diagnostic สำหรับ Stage นี้");
    }
  }

  enforceAuthoritativeLevelControl();
  startSession();

  const mastery=state.sessionMode==="practice"
    ? await refreshMasteryProgress(level)
    : null;

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

  state.level=effectiveSessionLevel(
    document.getElementById("levelSelect")?.value || 1
  );
  enforceAuthoritativeLevelControl();

  state.practiceSessionId = null;
  state.practiceSessionPromise = null;
  state.attemptSaveChain = Promise.resolve();

  const generation =
    ++state.practiceSessionGeneration;

  state.sessionQueue=[];
  state.sessionBag=[];
  state.sessionLength=state.sessionMode==="pretest" ? state.diagnosticItemCodes.length : null;
  state.masteryPriorityItemCodes=[];
  document.getElementById("levelStatus").textContent=
    state.sessionMode==="teacher_demo"
      ? `Teacher Demo · Level ${state.level} · ไม่บันทึกความก้าวหน้า`
      : `Level ${state.level}`;
  const masteryProgress=document.getElementById("masteryProgress");
  if(masteryProgress) masteryProgress.hidden=state.sessionMode==="teacher_demo";
  if(state.sessionMode!=="teacher_demo") setMasteryProgressLoading(state.level);
  state.sessionResults=[];
  state.sessionComplete=false;
  state.questionIndex=0;
  state.lastScore=null;
  state.isTransitioning=false;

  publishDiagnosticSessionStart({
    generation,
    sessionMode:state.sessionMode,
    level:state.level,
    stageCode:state.authoritativeStageCode || `STAGE_${state.level}`,
    exerciseCode:majorScaleConfig.exerciseCode,
    plannedQuestions:state.sessionMode==="pretest" ? state.sessionLength : 5
  });

  const overlay=document.getElementById("sessionSummary");
  if(overlay) overlay.hidden=true;

  const masteryOverlay=document.getElementById("levelMasteryOverlay");
  if(masteryOverlay) masteryOverlay.hidden=true;
  const masteryProgressForSession=document.getElementById("masteryProgress");
  if(masteryProgressForSession && state.sessionMode!=="teacher_demo") masteryProgressForSession.hidden=false;
  const app=document.querySelector('.session-app');
  if(app){
    app.inert=false;
    app.removeAttribute('aria-hidden');
  }
  const kicker=document.querySelector('.summary-kicker');
  if(kicker) kicker.textContent="สรุปผลการฝึก";
  const restart=document.getElementById('restartSession');
  if(restart) restart.textContent="เริ่มการฝึกใหม่";

  if(state.sessionMode==="pretest"){
    state.sessionBag=state.diagnosticItemCodes
      .map(code=>KEYS.find(key=>key.tonic===code))
      .filter(Boolean);
  }else{
    refillSessionBag();
  }
  const firstQuestion=takeNextQuestionFromBag();
  if(firstQuestion) startQuestion(firstQuestion);

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
  const practiceRepository=
    window.MajorScaleApp?.practiceRepository;

  if(!practiceRepository || !attemptId || !loResults){
    console.error("ATTEMPT SKILL RESULTS NOT SAVED: missing repository, attempt id, or LO results");
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
    const {error}=
      await practiceRepository.createAttemptSkillResults(
        rows
      );

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
  const practiceRepository=
    window.MajorScaleApp?.practiceRepository;

  if(!practiceRepository || !practiceSessionId){
    console.error(
      "PRACTICE SESSION PROGRESS NOT SAVED: missing repository or session id"
    );
    return false;
  }

  const updates={
    completed_questions:completedQuestions,
    last_activity_at:new Date().toISOString()
  };

  try{
    const {error}=
      await practiceRepository.updatePracticeSession(
        practiceSessionId,
        updates
      );

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
  const practiceRepository=
    window.MajorScaleApp?.practiceRepository;

  if(!practiceRepository || !practiceSessionId){
    console.error(
      "PRACTICE SESSION COMPLETION NOT SAVED: missing repository or session id"
    );
    return false;
  }

  try{
    const {error}=
      await practiceRepository.updatePracticeSession(
        practiceSessionId,
        {
          overall_score:overallScore,
          last_activity_at:new Date().toISOString(),
          completed_at:new Date().toISOString()
        }
      );

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
  const masteryRepository=
    window.MajorScaleApp?.masteryRepository;

  if(
    !masteryRepository ||
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
    const genericResponse=
      await masteryRepository.advanceStageIfMastered({
        exerciseCode:majorScaleConfig.exerciseCode,
        stageCode
      });

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
      `No usable progression result for ${majorScaleConfig.exerciseCode} / ${stageCode}`
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
  if(state.sessionMode==="teacher_demo"){
    return {
      attemptId:null,
      mastery:null,
      diagnosticPlacement:null,
      teacherDemo:true
    };
  }

  level=effectiveSessionLevel(level);
  const practiceRepository=
    window.MajorScaleApp?.practiceRepository;

  if(!practiceRepository){
    console.error("Practice repository not available — attempt not saved");
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
    const {data,error}=
      await practiceRepository.createAttempt({
        practice_session_id:practiceSessionId,
        question_number:questionNumber,
        item_code:itemCode,
        score:score,
        response_json:responseJson
      });

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
    let diagnosticPlacement=null;

    if(skillResultsSaved){
      const progressSaved=
        await updatePracticeSessionProgress({
          practiceSessionId,
          completedQuestions
        });

      if(progressSaved){
        if(state.sessionMode==="pretest"){
          if(masteryLearningCore.diagnosticComplete(completedQuestions,state.sessionLength)){
            const sessionOverall=state.sessionResults.length
              ? Math.round(state.sessionResults.reduce((sum,item)=>sum+Number(item.score || 0),0)/state.sessionResults.length)
              : null;
            await completePracticeSessionRecord(practiceSessionId,sessionOverall);
            const placementResponse=await learningRepository.applyDiagnosticPlacement(majorScaleConfig.exerciseCode);
            if(placementResponse?.error) throw placementResponse.error;
            diagnosticPlacement=masteryLearningCore.firstResult(placementResponse?.data);
          }
        }else{
          mastery=await advanceLevelIfMastered({
            generation,
            level,
            practiceSessionId
          });
        }
      }
    }else{
      console.error(
        "PRACTICE SESSION PROGRESS NOT UPDATED: skill results were not fully saved"
      );
    }

    return {
      attemptId:data.id,
      mastery,
      diagnosticPlacement
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

let pendingLevelMasteryTransition=null;
let pendingDiagnosticPlacement=null;
let questionResultHideTimer=0;
const QUESTION_RESULT_TRANSITION_MS=180;

function setQuestionResultAction({disabled,text}){
  const button=document.getElementById("questionResultContinue");
  if(!button) return;
  button.disabled=!!disabled;
  button.textContent=text || "ทำข้อต่อไป";
}

function setTrainerInertForQuestionResult(active){
  // Keep the dialog interactive: only its background siblings become inert.
  for(const background of document.querySelectorAll('.session-app > .session-header, .session-app > .session-main')){
    background.inert=!!active;
    if(active){
      background.setAttribute('aria-hidden','true');
    }else{
      background.removeAttribute('aria-hidden');
    }
  }
}

function optimizeQuestionResultSnapshotLayout(snapshot){
  const systems=Array.from(snapshot.querySelectorAll("g[data-system]"));
  if(systems.length!==3) return false;

  const second=systems[1];
  const third=systems[2];
  const secondBody=Array.from(second.children).find(node=>
    node.localName==="g" && node.getAttribute("pointer-events")!=="none"
  );
  const thirdBody=Array.from(third.children).find(node=>
    node.localName==="g" && node.getAttribute("pointer-events")!=="none"
  );
  if(!secondBody || !thirdBody) return false;

  // Review-only layout: keep measure 1 on the first system and place the
  // short final whole-note measure after measure 2 on the second system.
  // The editable score remains unchanged, so interaction geometry is safe.
  secondBody.setAttribute("transform","translate(-600 180)");
  thirdBody.setAttribute("transform","translate(-620 180)");
  Array.from(second.children).forEach(node=>{
    if(node.localName==="line") node.setAttribute("x2","740");
  });
  second.appendChild(thirdBody);
  second.setAttribute("transform","translate(0 -30)");
  third.remove();

  snapshot.setAttribute("viewBox","0 0 750 430");
  snapshot.classList.add("question-result-score-snapshot-compact");
  return true;
}

function renderQuestionResultNotationSnapshot(){
  const container=document.getElementById("questionResultNotation");
  if(!container) return;

  container.innerHTML="";
  if(!scoreSvg || typeof scoreSvg.cloneNode!=="function") return;

  const snapshot=scoreSvg.cloneNode(true);
  snapshot.removeAttribute("id");
  snapshot.removeAttribute("tabindex");
  snapshot.setAttribute("aria-label","คำตอบของผู้เรียนข้อนี้");
  snapshot.setAttribute("focusable","false");
  snapshot.classList.add("question-result-score-snapshot");

  // The review image is evidence of the submitted notation, not an editor.
  // Remove cursor/hit geometry and neutralize selection highlighting so amber
  // does not look like an error marker inside the feedback dialog.
  snapshot.querySelectorAll(".entry-cursor,.note-hit-target").forEach(node=>node.remove());
  snapshot.querySelectorAll("[data-note-id]").forEach(node=>{
    node.removeAttribute("data-note-id");
    node.removeAttribute("style");
  });
  snapshot.querySelectorAll('[fill="#9b6400"]').forEach(node=>node.setAttribute("fill","#111"));
  snapshot.querySelectorAll('[stroke="#9b6400"]').forEach(node=>node.setAttribute("stroke","#111"));

  optimizeQuestionResultSnapshotLayout(snapshot);
  container.appendChild(snapshot);
}

function showQuestionResultTransition(result,questionResult=buildQuestionResult(result)){
  const overlay=document.getElementById("questionResultOverlay");
  const panel=document.getElementById("questionResultPanel");
  const title=document.getElementById("questionResultTitle");
  const subtitle=document.getElementById("questionResultSubtitle");
  const score=document.getElementById("questionResultScore");
  const feedback=document.getElementById("questionResultFeedback");

  if(!overlay || !panel || !title || !subtitle || !score || !feedback) return;

  if(questionResultHideTimer){
    clearTimeout(questionResultHideTimer);
    questionResultHideTimer=0;
  }

  const passed=result.score>=90;

  panel.classList.toggle("passed",passed);
  panel.classList.toggle("needs-work",!passed);
  title.textContent=`ข้อ ${questionResult.questionNumber} — ${questionResult.keyLabel}`;
  subtitle.textContent=passed
    ? "✓ ทำได้ดี ตรวจผลรายทักษะก่อนทำข้อต่อไป"
    : "Diagnostic Feedback แสดงทักษะที่ถูกต้องและจุดที่ควรแก้ก่อน";
  score.textContent=`${result.score}%`;
  feedback.innerHTML=renderQuestionFeedback(questionResult);
  renderQuestionResultNotationSnapshot();

  setQuestionResultAction({
    disabled:true,
    text:"กำลังบันทึกและประเมิน..."
  });

  overlay.hidden=false;
  overlay.setAttribute("aria-hidden","false");
  setTrainerInertForQuestionResult(true);

  requestAnimationFrame(()=>{
    overlay.classList.add("is-visible");
    panel.focus({preventScroll:true});
  });
  return questionResult;
}

function hideQuestionResultTransition({immediate=false}={}){
  const overlay=document.getElementById("questionResultOverlay");
  if(!overlay) return;

  if(questionResultHideTimer){
    clearTimeout(questionResultHideTimer);
    questionResultHideTimer=0;
  }

  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden","true");

  const finishHide=()=>{
    overlay.hidden=true;
    setTrainerInertForQuestionResult(false);
    questionResultHideTimer=0;
  };

  if(immediate){
    finishHide();
  }else{
    questionResultHideTimer=setTimeout(
      finishHide,
      QUESTION_RESULT_TRANSITION_MS
    );
  }
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

    pendingLevelMasteryTransition=null;
    state.lastScore=result.score;

    const attemptGeneration=state.practiceSessionGeneration;
    const attemptLevel=state.level;
    const attemptQuestionNumber=state.questionIndex+1;
    const attemptItemCode=state.key.tonic;
    const attemptResponseJson=snapshotAttemptResponse();
    const questionResult=buildQuestionResult(result);

    state.sessionResults.push({
      key:state.key.name,
      score:result.score,
      lo:result.lo,
      diagnostic:questionResult
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
        const diagnosticPlacement=saveResult?.diagnosticPlacement;

        if(state.sessionMode==="practice") await refreshMasteryProgress(attemptLevel);

        if(diagnosticPlacement){
          pendingDiagnosticPlacement=diagnosticPlacement;
          const nextButton=document.getElementById("nextQuestion");
          if(nextButton){nextButton.disabled=true;nextButton.hidden=true;}
          setQuestionResultAction({disabled:false,text:"ดูแผนการเรียนที่แนะนำ"});
        }else if(mastery?.advanced){
          pendingLevelMasteryTransition=mastery;

          const nextButton=
            document.getElementById("nextQuestion");

          if(nextButton){
            nextButton.disabled=true;
            nextButton.hidden=true;
          }

          setQuestionResultAction({
            disabled:false,
            text:"ดูผล Mastery"
          });
        }else{
          const nextButton=
            document.getElementById("nextQuestion");

          if(nextButton){
            nextButton.disabled=false;
            nextButton.hidden=false;
            nextButton.textContent="ทำข้อต่อไป";
          }

          setQuestionResultAction({
            disabled:false,
            text:"ทำข้อต่อไป"
          });
        }

        return saveResult;
      });

    renderMeta();

    const box=document.getElementById("feedback");
    box.className="feedback session-feedback";
    box.innerHTML="";

    showQuestionResultTransition(result,questionResult);
    publishQuestionResult(questionResult);

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

document.getElementById("questionResultContinue").onclick=()=>{
  if(pendingDiagnosticPlacement){
    pendingDiagnosticPlacement=null;
    hideQuestionResultTransition({immediate:true});
    document.getElementById("dashboardButton")?.click();
    return;
  }
  const mastery=pendingLevelMasteryTransition;
  pendingLevelMasteryTransition=null;

  if(mastery?.advanced){
    hideQuestionResultTransition();
    setTimeout(
      ()=>showLevelMasteryTransition(mastery),
      QUESTION_RESULT_TRANSITION_MS
    );
    return;
  }

  document.getElementById("nextQuestion")?.click();
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
    acceptTrustedAdvancedLevel(nextLevel);
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

  pendingLevelMasteryTransition=null;
  hideQuestionResultTransition({immediate:true});

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

  const diagnostic=state.sessionMode==="pretest";
  return `
    <strong>${diagnostic ? "แบบประเมินก่อนเรียน • " : "เขียนบันไดเสียง "}${state.key.name}</strong>
    <span>${diagnostic ? "ใช้คำตอบนี้เพื่อวิเคราะห์จุดเริ่มต้น โดยยังใช้เกณฑ์การเขียนเดียวกับแบบฝึก" : "ขาขึ้น–ขาลงตาม Rhythm Pattern โดยใส่ accidental, stem และ beam ให้ถูกต้อง"}</span>
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
  if(state.pathStageEnforced){
    enforceAuthoritativeLevelControl();
    return;
  }
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
    const rhythm=notationCore.rhythmFromShortcut(key);
    if(!rhythm)return;
    setTool("rhythm",rhythm);
  },
  setAccidental(key){
    const accidental=notationCore.accidentalFromShortcut(key);
    if(accidental===undefined)return;
    setTool("accidental",accidental);
  }
};

initializeTrainerAfterMusicFont();
})();
