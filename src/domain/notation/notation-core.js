(() => {
'use strict';
const app=window.MajorScaleApp=window.MajorScaleApp || {};
const LETTERS=["C","D","E","F","G","A","B"];

// Mechanical copies of the existing pitch, spacing and symbol helpers.
function pitchToStep(letter,octave){return octave*7+LETTERS.indexOf(letter)-(4*7+LETTERS.indexOf("E"))}

function stepToPitch(step){const idx=4*7+LETTERS.indexOf("E")+step;return{letter:LETTERS[(idx%7+7)%7],octave:Math.floor(idx/7)}}

function musicEm(staffObj){ return staffObj.spacing*4; }

function sp(staffObj,value=1){ return staffObj.spacing*value; }

function clampStaffStep(step,MIN_STAFF_STEP,MAX_STAFF_STEP){
  return Math.max(MIN_STAFF_STEP,Math.min(MAX_STAFF_STEP,step));
}

function accidentalOffset(a){
 const offsets={"":0,"#":1,"b":-1,"##":2,"bb":-2};
 if(!Object.prototype.hasOwnProperty.call(offsets,a))throw new Error("รองรับเครื่องหมายถึง Double Sharp/Flat เท่านั้น");
 return offsets[a];
}

// Lookup data only; keyboard events and editing stay in the legacy runtime.
function rhythmFromShortcut(key){return {"1":"whole","2":"half","3":"quarter","4":"eighth","5":"sixteenth"}[key];}
function accidentalFromShortcut(key){return {".":"","+":"#","-":"b","*":"##","/":"bb"}[key];}

app.notationCore=Object.freeze({
  pitchToStep,stepToPitch,clampStaffStep,musicEm,sp,
  accidentalOffset,rhythmFromShortcut,accidentalFromShortcut
});
})();
