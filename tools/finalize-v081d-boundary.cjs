'use strict';
const fs=require('fs'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/v081d-pre-extraction.json','utf8'));
const helper=`'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/v081d-pre-extraction.json'),'utf8'));
function replaceExact(source,after,before,label){
  const i=source.indexOf(after);assert(i>=0,'missing v0.8.1-d edit: '+label);assert.equal(source.indexOf(after,i+1),-1,'duplicate v0.8.1-d edit: '+label);return source.slice(0,i)+before+source.slice(i+after.length);
}
function restoreSegment(source,start,end,before,label){
  const a=source.indexOf(start),b=source.indexOf(end);assert(a>=0&&b>a,'missing v0.8.1-d segment: '+label);return source.slice(0,a)+before+source.slice(b);
}
module.exports=function restoreNotationBeaming(source,file){
  if(file==='index.html') return replaceExact(source,'<script src="./src/domain/notation/notation-interaction.js"></script>\\n<script src="./src/domain/notation/notation-beaming.js"></script>','<script src="./src/domain/notation/notation-interaction.js"></script>','beaming script');
  if(file!=='src/trainer.js') return source;
  source=replaceExact(source,'const notationInteraction=window.MajorScaleApp.notationInteraction;\\nconst notationBeaming=window.MajorScaleApp.notationBeaming;\\nconst majorScaleModule=','const notationInteraction=window.MajorScaleApp.notationInteraction;\\nconst majorScaleModule=','beaming binding');
  source=restoreSegment(source,'scoreSvg.addEventListener("pointermove"','function getBeamDirection(items){',fixture.interaction,'interaction completion');
  source=restoreSegment(source,'function getBeamDirection(items){','function staffStepToPitch(step){',fixture.beaming,'beaming engine');
  source=restoreSegment(source,'function normalizeBeamGroups(){','function syncToolButtons(){',fixture.normalize,'beam normalization');
  source=restoreSegment(source,'document.getElementById("beamSelected").onclick=()=>{','const percent=majorScaleModule.percent;',fixture.controls,'beam controls');
  source=restoreSegment(source,'function beamGroupSignatures(notes){','function check(){',fixture.signatures,'beam signatures');
  return source;
};
`;
fs.writeFileSync('tests/helpers/restore-notation-beaming.cjs',helper);
console.log('Finalized v0.8.1-d exact boundary restoration');
