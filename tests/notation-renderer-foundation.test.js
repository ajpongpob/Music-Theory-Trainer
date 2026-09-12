'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const source=read('src/domain/notation/notation-renderer.js');
assert(!/supabase|fetch\s*\(|XMLHttpRequest|WebSocket|\beval\s*\(|new Function|import\s*\(|MAJOR_SCALE_NOTATION|LEVEL_KEYS|STAGE_[1-4]/i.test(source),'renderer foundation must stay presentation-only');
const created=[];
const document={createElementNS(ns,name){const node={ns,name,attrs:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;}};created.push(node);return node;}};
const ctx={window:{},document};vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'notation-renderer.js'});
const api=ctx.window.MajorScaleApp.notationRenderer;
assert(api && Object.isFrozen(api),'renderer namespace API is immutable');
assert.equal(api.NS,'http://www.w3.org/2000/svg');
const node=api.createSvgElement('text',{x:12,'pointer-events':'none'},'abc');
assert.equal(node.ns,api.NS);assert.equal(node.name,'text');assert.deepStrictEqual(node.attrs,{x:12,'pointer-events':'none'});assert.equal(node.textContent,'abc');
const smufl={accidentalFlat:'flat',accidentalNatural:'natural',accidentalSharp:'sharp',accidentalDoubleSharp:'dsharp',accidentalDoubleFlat:'dflat'};
for(const [symbol,glyph] of [['b','flat'],['','natural'],['#','sharp'],['##','dsharp'],['bb','dflat'],['x','']])assert.equal(api.accidentalSmuflGlyph(symbol,smufl),glyph);
function linesFor(step){const children=[],svg={appendChild(n){children.push(n);}};api.drawLedger(svg,100,step,s=>200-s*5);return children;}
let lines=linesFor(-4);assert.equal(lines.length,2);assert.deepStrictEqual(lines.map(n=>n.attrs),[
  {x1:82,y1:210,x2:118,y2:210,stroke:'#111','stroke-width':1.4},
  {x1:82,y1:220,x2:118,y2:220,stroke:'#111','stroke-width':1.4}
]);
lines=linesFor(12);assert.equal(lines.length,2);assert.deepStrictEqual(lines.map(n=>n.attrs),[
  {x1:82,y1:150,x2:118,y2:150,stroke:'#111','stroke-width':1.4},
  {x1:82,y1:140,x2:118,y2:140,stroke:'#111','stroke-width':1.4}
]);
assert.equal(linesFor(4).length,0);
const trainer=read('src/trainer.js');
assert(trainer.includes('function accidentalSmuflGlyph(value){return notationRenderer.accidentalSmuflGlyph(value,SMUFL);}'));
assert(trainer.includes('function el(name,attrs={},text=""){return notationRenderer.createSvgElement(name,attrs,text);}'));
assert(trainer.includes('function drawLedger(svg,x,step,stepToY){return notationRenderer.drawLedger(svg,x,step,stepToY);}'));
for(const forbidden of ['function drawBeams(){','function render(){','scoreSvg.addEventListener("pointerdown"'])assert(trainer.includes(forbidden),'legacy critical runtime must remain present: '+forbidden);
console.log('PASS notation renderer foundation: SVG creation, accidental glyphs, ledger geometry, wrappers and legacy critical boundaries');
