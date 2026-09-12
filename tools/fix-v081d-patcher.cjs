'use strict';
const fs=require('fs'),assert=require('assert');
const path='tools/apply-v081d-architecture-freeze.cjs';
let s=fs.readFileSync(path,'utf8');
const replace=(a,b,label)=>{assert(s.includes(a),'missing '+label);s=s.replace(a,b);};
replace(
`function replaceExact(source,before,after,label){
  const i=source.indexOf(before);
  assert(i>=0,'missing block: '+label);
  assert.equal(source.indexOf(before,i+1),-1,'duplicate block: '+label);
  return source.slice(0,i)+after+source.slice(i+before.length);
}`,
`function replaceExact(source,before,after,label){
  const i=source.indexOf(before);
  assert(i>=0,'missing block: '+label);
  assert.equal(source.indexOf(before,i+1),-1,'duplicate block: '+label);
  return source.slice(0,i)+after+source.slice(i+before.length);
}
function replaceFirst(source,before,after,label){
  const i=source.indexOf(before);
  assert(i>=0,'missing block: '+label);
  return source.slice(0,i)+after+source.slice(i+before.length);
}`,
'replaceFirst helper');
replace(
`trainer=replaceExact(trainer,resetBlock2,\`  notationInteraction.resetPointerInteraction(noteInteraction);\`,'note reset');
trainer=replaceExact(trainer,resetBlock2,\`  notationInteraction.resetPointerInteraction(noteInteraction);\`,'cancel reset');`,
`trainer=replaceFirst(trainer,resetBlock2,\`  notationInteraction.resetPointerInteraction(noteInteraction);\`,'note reset');
trainer=replaceFirst(trainer,resetBlock2,\`  notationInteraction.resetPointerInteraction(noteInteraction);\`,'cancel reset');`,
'duplicate pointer resets');
replace(
`boundaryTest=replaceExact(boundaryTest,
\`restoreInteraction(read(file),file)\`,
\`restoreInteraction(restoreBeaming(read(file),file),file)\`,
'boundary files restoration');
boundaryTest=replaceExact(boundaryTest,
\`restoreInteraction(read(file),file)\`,
\`restoreInteraction(restoreBeaming(read(file),file),file)\`,
'protected restoration');`,
`boundaryTest=replaceFirst(boundaryTest,
\`restoreInteraction(read(file),file)\`,
\`restoreInteraction(restoreBeaming(read(file),file),file)\`,
'boundary files restoration');
boundaryTest=replaceFirst(boundaryTest,
\`restoreInteraction(read(file),file)\`,
\`restoreInteraction(restoreBeaming(read(file),file),file)\`,
'protected restoration');`,
'duplicate boundary restoration');
fs.writeFileSync(path,s);
console.log('Hardened v0.8.1-d patcher');
