'use strict';
const fs=require('fs'),assert=require('assert');
const trainer=fs.readFileSync('src/trainer.js','utf8');
function segment(start,end){const a=trainer.indexOf(start),b=trainer.indexOf(end);assert(a>=0&&b>a,`missing segment ${start}`);return trainer.slice(a,b);}
const fixture={
 interaction:segment('scoreSvg.addEventListener("pointermove"','function getBeamDirection(items){'),
 beaming:segment('function getBeamDirection(items){','function staffStepToPitch(step){'),
 normalize:segment('function normalizeBeamGroups(){','function syncToolButtons(){'),
 controls:segment('document.getElementById("beamSelected").onclick=()=>{','const percent=majorScaleModule.percent;'),
 signatures:segment('function beamGroupSignatures(notes){','function check(){')
};
fs.writeFileSync('tests/fixtures/v081d-pre-extraction.json',JSON.stringify(fixture));
console.log('Captured v0.8.1-d pre-extraction boundary fragments');
