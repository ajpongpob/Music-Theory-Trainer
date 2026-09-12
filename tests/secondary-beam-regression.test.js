'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../src/trainer.js'),'utf8');
const start=source.indexOf('function drawBeams(){');
const end=source.indexOf('function staffStepToPitch',start);
assert(start>=0 && end>start);
for(const direction of ['up','down']){
  const polygons=[];
  const context={
    state:{notes:[{letter:'C',octave:4,rhythm:'eighth',beamGroup:'g'},{letter:'D',octave:4,rhythm:'sixteenth',beamGroup:'g'}]},
    noteXs:[100,160],getBeamDirection:()=>direction,
    getBeamLevel:n=>n.rhythm==='sixteenth'?2:1,
    pitchToStep:()=>0,stepToY:()=>100,
    el:(tag,attrs)=>({tag,attrs}),scoreSvg:{appendChild(node){if(node.tag==='polygon')polygons.push(node.attrs);}}
  };
  vm.runInNewContext(source.slice(start,end)+'\ndrawBeams();',context);
  assert.equal(polygons.length,2,'one primary beam and one terminal hook');
  const points=polygons[1].points.split(' ').map(p=>p.split(',').map(Number));
  const stem=160+(direction==='up'?10:-10);
  assert.equal(Math.max(...points.map(p=>p[0])),stem);
  assert.equal(Math.min(...points.map(p=>p[0])),stem-12,'terminal hook must point left/inward');
}
console.log('PASS original secondary beam: penultimate eighth / terminal sixteenth inward hook, both stems');
