'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const write=(rel,text)=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);};
function replaceOnce(source,before,after,label){
  const first=source.indexOf(before);
  if(first<0) throw new Error('missing expected source: '+label);
  if(source.indexOf(before,first+1)>=0) throw new Error('expected unique source but found duplicate: '+label);
  return source.slice(0,first)+after+source.slice(first+before.length);
}

const renderer=`(() => {\n'use strict';\nconst app=window.MajorScaleApp=window.MajorScaleApp || {};\nconst NS=\"http://www.w3.org/2000/svg\";\n\nfunction createSvgElement(name,attrs={},text=\"\"){\n  const node=document.createElementNS(NS,name);\n  Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));\n  if(text) node.textContent=text;\n  return node;\n}\n\nfunction accidentalSmuflGlyph(value,smufl){\n  return {\n    \"b\":smufl.accidentalFlat,\n    \"\":smufl.accidentalNatural,\n    \"#\":smufl.accidentalSharp,\n    \"##\":smufl.accidentalDoubleSharp,\n    \"bb\":smufl.accidentalDoubleFlat\n  }[value] ?? \"\";\n}\n\nfunction drawLedger(svg,x,step,stepToY){\n  const ys=[];if(step<0){for(let s=-2;s>=step;s-=2)ys.push(stepToY(s))}\n  else if(step>8){for(let s=10;s<=step;s+=2)ys.push(stepToY(s))}\n  ys.forEach(y=>svg.appendChild(createSvgElement(\"line\",{x1:x-18,y1:y,x2:x+18,y2:y,stroke:\"#111\",\"stroke-width\":1.4})));\n}\n\napp.notationRenderer=Object.freeze({\n  NS,createSvgElement,accidentalSmuflGlyph,drawLedger\n});\n})();\n`;
write('src/domain/notation/notation-renderer.js',renderer);

let trainer=read('src/trainer.js');
trainer=replaceOnce(
  trainer,
  'const notationCore=window.MajorScaleApp.notationCore;\nconst majorScaleModule=',
  'const notationCore=window.MajorScaleApp.notationCore;\nconst notationRenderer=window.MajorScaleApp.notationRenderer;\nconst majorScaleModule=',
  'renderer namespace binding'
);
trainer=replaceOnce(
  trainer,
`function accidentalSmuflGlyph(value){\n  return {\n    \"b\":SMUFL.accidentalFlat,\n    \"\":SMUFL.accidentalNatural,\n    \"#\":SMUFL.accidentalSharp,\n    \"##\":SMUFL.accidentalDoubleSharp,\n    \"bb\":SMUFL.accidentalDoubleFlat\n  }[value] ?? \"\";\n}\nfunction el(name,attrs={},text=\"\"){const n=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n}`,
`function accidentalSmuflGlyph(value){return notationRenderer.accidentalSmuflGlyph(value,SMUFL);}\nfunction el(name,attrs={},text=\"\"){return notationRenderer.createSvgElement(name,attrs,text);}`,
  'accidental/svg primitive wrappers'
);
trainer=replaceOnce(
  trainer,
`function drawLedger(svg,x,step,stepToY){\n const ys=[];if(step<0){for(let s=-2;s>=step;s-=2)ys.push(stepToY(s))}\n else if(step>8){for(let s=10;s<=step;s+=2)ys.push(stepToY(s))}\n ys.forEach(y=>svg.appendChild(el(\"line\",{x1:x-18,y1:y,x2:x+18,y2:y,stroke:\"#111\",\"stroke-width\":1.4})));\n}`,
`function drawLedger(svg,x,step,stepToY){return notationRenderer.drawLedger(svg,x,step,stepToY);}`,
  'ledger wrapper'
);
write('src/trainer.js',trainer);

let html=read('index.html');
html=replaceOnce(
  html,
  '<script src="./src/domain/notation/notation-core.js"></script>\n<script src="./src/exercises/exercise-contract.js"></script>',
  '<script src="./src/domain/notation/notation-core.js"></script>\n<script src="./src/domain/notation/notation-renderer.js"></script>\n<script src="./src/exercises/exercise-contract.js"></script>',
  'renderer script load order'
);
write('index.html',html);

const restoreHelper=`'use strict';\nconst assert=require('assert');\nfunction replaceExact(source,after,before,label){\n  const i=source.indexOf(after);assert(i>=0,'missing renderer-foundation edit: '+label);\n  assert.equal(source.indexOf(after,i+1),-1,'duplicate renderer-foundation edit: '+label);\n  return source.slice(0,i)+before+source.slice(i+after.length);\n}\nmodule.exports=function restoreRendererFoundation(source,file){\n  if(file==='src/trainer.js'){\n    source=replaceExact(source,\n      'const notationCore=window.MajorScaleApp.notationCore;\\nconst notationRenderer=window.MajorScaleApp.notationRenderer;\\nconst majorScaleModule=',\n      'const notationCore=window.MajorScaleApp.notationCore;\\nconst majorScaleModule=',\n      'renderer namespace binding');\n    source=replaceExact(source,\n      'function accidentalSmuflGlyph(value){return notationRenderer.accidentalSmuflGlyph(value,SMUFL);}\\nfunction el(name,attrs={},text=\"\"){return notationRenderer.createSvgElement(name,attrs,text);}',\n      'function accidentalSmuflGlyph(value){\\n  return {\\n    \"b\":SMUFL.accidentalFlat,\\n    \"\":SMUFL.accidentalNatural,\\n    \"#\":SMUFL.accidentalSharp,\\n    \"##\":SMUFL.accidentalDoubleSharp,\\n    \"bb\":SMUFL.accidentalDoubleFlat\\n  }[value] ?? \"\";\\n}\\nfunction el(name,attrs={},text=\"\"){const n=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n}',\n      'accidental/svg primitive wrappers');\n    source=replaceExact(source,\n      'function drawLedger(svg,x,step,stepToY){return notationRenderer.drawLedger(svg,x,step,stepToY);}',\n      'function drawLedger(svg,x,step,stepToY){\\n const ys=[];if(step<0){for(let s=-2;s>=step;s-=2)ys.push(stepToY(s))}\\n else if(step>8){for(let s=10;s<=step;s+=2)ys.push(stepToY(s))}\\n ys.forEach(y=>svg.appendChild(el(\"line\",{x1:x-18,y1:y,x2:x+18,y2:y,stroke:\"#111\",\"stroke-width\":1.4})));\\n}',\n      'ledger wrapper');\n  } else if(file==='index.html'){\n    source=replaceExact(source,\n      '<script src="./src/domain/notation/notation-core.js"></script>\\n<script src="./src/domain/notation/notation-renderer.js"></script>\\n<script src="./src/exercises/exercise-contract.js"></script>',\n      '<script src="./src/domain/notation/notation-core.js"></script>\\n<script src="./src/exercises/exercise-contract.js"></script>',\n      'renderer script load order');\n  }\n  return source;\n};\n`;
write('tests/helpers/restore-renderer-foundation.cjs',restoreHelper);

let boundaryTest=read('tests/notation-boundary.test.js');
boundaryTest=replaceOnce(
  boundaryTest,
  "const restore=require('./helpers/restore-notation-baseline.cjs');\nfor(const file of Object.keys(boundary.files))restore(read(file),file);",
  "const restore=require('./helpers/restore-notation-baseline.cjs');\nconst restoreRenderer=require('./helpers/restore-renderer-foundation.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(read(file),file),file);",
  'boundary restore chain'
);
boundaryTest=replaceOnce(
  boundaryTest,
  "assert(at('src/domain/notation/notation-core.js')<at('src/exercises/major-scale/major-scale.domain.js'));\nassert(at('src/domain/notation/notation-core.js')<at('src/trainer.js'));",
  "assert(at('src/domain/notation/notation-core.js')<at('src/domain/notation/notation-renderer.js'));\nassert(at('src/domain/notation/notation-renderer.js')<at('src/exercises/major-scale/major-scale.domain.js'));\nassert(at('src/domain/notation/notation-renderer.js')<at('src/trainer.js'));",
  'renderer script order assertions'
);
write('tests/notation-boundary.test.js',boundaryTest);

const rendererTest=`'use strict';\nconst fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');\nconst root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');\nconst source=read('src/domain/notation/notation-renderer.js');\nassert(!/supabase|fetch\\s*\\(|XMLHttpRequest|WebSocket|\\beval\\s*\\(|new Function|import\\s*\\(|MAJOR_SCALE_NOTATION|LEVEL_KEYS|STAGE_[1-4]/i.test(source),'renderer foundation must stay presentation-only');\nconst created=[];\nconst document={createElementNS(ns,name){const node={ns,name,attrs:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;}};created.push(node);return node;}};\nconst ctx={window:{},document};vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'notation-renderer.js'});\nconst api=ctx.window.MajorScaleApp.notationRenderer;\nassert(api && Object.isFrozen(api),'renderer namespace API is immutable');\nassert.equal(api.NS,'http://www.w3.org/2000/svg');\nconst node=api.createSvgElement('text',{x:12,'pointer-events':'none'},'abc');\nassert.equal(node.ns,api.NS);assert.equal(node.name,'text');assert.deepStrictEqual(node.attrs,{x:12,'pointer-events':'none'});assert.equal(node.textContent,'abc');\nconst smufl={accidentalFlat:'flat',accidentalNatural:'natural',accidentalSharp:'sharp',accidentalDoubleSharp:'dsharp',accidentalDoubleFlat:'dflat'};\nfor(const [symbol,glyph] of [['b','flat'],['','natural'],['#','sharp'],['##','dsharp'],['bb','dflat'],['x','']])assert.equal(api.accidentalSmuflGlyph(symbol,smufl),glyph);\nfunction linesFor(step){const children=[],svg={appendChild(n){children.push(n);}};api.drawLedger(svg,100,step,s=>200-s*5);return children;}\nlet lines=linesFor(-4);assert.equal(lines.length,2);assert.deepStrictEqual(lines.map(n=>n.attrs),[\n  {x1:82,y1:210,x2:118,y2:210,stroke:'#111','stroke-width':1.4},\n  {x1:82,y1:220,x2:118,y2:220,stroke:'#111','stroke-width':1.4}\n]);\nlines=linesFor(12);assert.equal(lines.length,2);assert.deepStrictEqual(lines.map(n=>n.attrs),[\n  {x1:82,y1:150,x2:118,y2:150,stroke:'#111','stroke-width':1.4},\n  {x1:82,y1:140,x2:118,y2:140,stroke:'#111','stroke-width':1.4}\n]);\nassert.equal(linesFor(4).length,0);\nconst trainer=read('src/trainer.js');\nassert(trainer.includes('function accidentalSmuflGlyph(value){return notationRenderer.accidentalSmuflGlyph(value,SMUFL);}'));\nassert(trainer.includes('function el(name,attrs={},text=\"\"){return notationRenderer.createSvgElement(name,attrs,text);}'));\nassert(trainer.includes('function drawLedger(svg,x,step,stepToY){return notationRenderer.drawLedger(svg,x,step,stepToY);}'));\nfor(const forbidden of ['function drawBeams(){','function render(){','scoreSvg.addEventListener(\"pointerdown\"'])assert(trainer.includes(forbidden),'legacy critical runtime must remain present: '+forbidden);\nconsole.log('PASS notation renderer foundation: SVG creation, accidental glyphs, ledger geometry, wrappers and legacy critical boundaries');\n`;
write('tests/notation-renderer-foundation.test.js',rendererTest);

console.log('Applied v0.8.1-b1 renderer foundation patch');
