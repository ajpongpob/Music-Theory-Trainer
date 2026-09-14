(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp || {};
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
const LEVEL_KEYS={
  1:["C","F","Bb","G","D"],
  2:["A","E","B","Eb","Ab","Db"],
  3:["Gb","Cb","F#","C#","G#","Fb","D#","Bbb"],
  4:["A#","Ebb","E#","Abb","B#","Dbb","F##","Gbb","C##","Cbb"]
};

const LO_META={
  BN01_TREBLE_PITCH:{
    code:"BN01_TREBLE_PITCH",
    short:"Pitch Name",
    th:"ชื่อระดับเสียงบนกุญแจซอล (ไม่จำกัด Octave)"
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
  RH01_DURATION_VALUE:10,
  GR02_PRIMARY_BEAM:10,
  MS03_SCALE_ACCIDENTAL:40
};


app.majorScaleConfig=Object.freeze({
  exerciseCode:'MAJOR_SCALE_NOTATION', KEYS, LEVEL_KEYS, LO_META, LO_WEIGHTS
});
})();
