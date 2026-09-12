'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(__dirname,'../src/domain/notation/notation-beaming.js'),'utf8');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'notation-beaming.js'});
const api=ctx.window.MajorScaleApp.notationBeaming;
assert(api&&Object.isFrozen(api));

for(const direction of ['up','down']){
  const polygons=[];
  const svg={appendChild(node){if(node.tag==='polygon')polygons.push(node.attrs);}};
  const notes=[
    {letter:'C',octave:4,rhythm:'eighth',stem:direction,beamGroup:'g'},
    {letter:'D',octave:4,rhythm:'sixteenth',stem:direction,beamGroup:'g'}
  ];
  api.drawBeams(svg,notes,[100,160],{
    pitchToStep:()=>0,
    stepToY:()=>100,
    createSvgElement:(tag,attrs)=>({tag,attrs})
  });
  assert.equal(polygons.length,2,'one primary beam and one terminal hook');
  const points=polygons[1].points.split(' ').map(p=>p.split(',').map(Number));
  const stem=160+(direction==='up'?10:-10);
  assert.equal(Math.max(...points.map(p=>p[0])),stem);
  assert.equal(Math.min(...points.map(p=>p[0])),stem-12,'terminal hook must point left/inward');
}
console.log('PASS secondary beam regression: penultimate eighth / terminal sixteenth inward hook, both stems, shared beaming engine');
