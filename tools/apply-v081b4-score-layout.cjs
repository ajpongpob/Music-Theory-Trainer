'use strict';
const fs=require('fs');
const assert=require('assert');

const trainerPath='src/trainer.js';
const rendererPath='src/domain/notation/notation-renderer.js';
let trainer=fs.readFileSync(trainerPath,'utf8');
let renderer=fs.readFileSync(rendererPath,'utf8');
const pairs=[];

function replaceExact(source,before,after,label,record=true){
  const i=source.indexOf(before);
  assert(i>=0,'missing source block: '+label);
  assert.equal(source.indexOf(before,i+before.length),-1,'duplicate source block: '+label);
  if(record) pairs.push({before,after,label});
  return source.slice(0,i)+after+source.slice(i+before.length);
}
function replaceRange(source,startMarker,endMarker,after,label){
  const start=source.indexOf(startMarker);
  assert(start>=0,'missing range start: '+label);
  const end=source.indexOf(endMarker,start);
  assert(end>start,'missing range end: '+label);
  const before=source.slice(start,end);
  pairs.push({before,after,label});
  return source.slice(0,start)+after+source.slice(end);
}

const rendererInsertion=`
function drawStaffLines(svg,staff,options={}){
  const x1=options.x1 ?? staff.x1;
  const x2=options.x2 ?? staff.x2;
  const yOffset=options.yOffset ?? 0;
  const stroke=options.stroke ?? "#1d2939";
  const strokeWidth=options.strokeWidth ?? 1.7;
  for(let i=0;i<5;i++){
    const y=staff.top+staff.spacing*i+yOffset;
    svg.appendChild(createSvgElement("line",{x1,y1:y,x2,y2:y,stroke,"stroke-width":strokeWidth}));
  }
}

function drawBarline(svg,x,staff,options={}){
  const yOffset=options.yOffset ?? 0;
  svg.appendChild(createSvgElement("line",{
    x1:x,y1:staff.top+yOffset,x2:x,y2:staff.top+staff.spacing*4+yOffset,
    stroke:options.stroke ?? "#111",
    "stroke-width":options.strokeWidth ?? 1.8
  }));
}

function drawDoubleBarline(svg,thinX,thickX,staff,options={}){
  drawBarline(svg,thinX,staff,{
    yOffset:options.yOffset,
    stroke:options.stroke,
    strokeWidth:options.thinWidth ?? 1.4
  });
  drawBarline(svg,thickX,staff,{
    yOffset:options.yOffset,
    stroke:options.stroke,
    strokeWidth:options.thickWidth ?? 3.2
  });
}

function layoutMeasureWithinBounds(indices,leftBoundary,rightBoundary,options={}){
  if(!indices.length) return options.positions;

  const leadingPad=options.leadingPad ?? 0;
  const trailingPad=options.trailingPad ?? 0;
  const preferredGap=options.preferredGap ?? 0;
  const minimumGap=options.minimumGap ?? 0;
  const edgeShareMax=options.edgeShareMax ?? Infinity;
  const leftExtents=options.leftExtents;
  const rightExtents=options.rightExtents;
  const basePositions=options.basePositions;
  const positions=options.positions;

  const innerLeft=leftBoundary+leadingPad;
  const innerRight=rightBoundary-trailingPad;
  const available=Math.max(0,innerRight-innerLeft);

  if(indices.length===1){
    const i=indices[0];
    const minX=innerLeft+leftExtents[0];
    const maxX=innerRight-rightExtents[0];
    positions[i]=Math.max(minX,Math.min(basePositions[i],maxX));
    return positions;
  }

  let glyphWidth=leftExtents[0]+rightExtents[rightExtents.length-1];
  for(let p=1;p<indices.length;p++){
    glyphWidth+=rightExtents[p-1]+leftExtents[p];
  }

  const gapCount=indices.length-1;
  let gap=(available-glyphWidth)/gapCount;
  if(Number.isFinite(gap)) gap=Math.min(preferredGap,Math.max(minimumGap,gap));
  else gap=preferredGap;

  let required=glyphWidth+gap*gapCount;
  if(required>available){
    gap=Math.max(0,(available-glyphWidth)/gapCount);
    required=glyphWidth+gap*gapCount;
  }

  const extra=Math.max(0,available-required);
  const baseDistances=[];
  let baseDistanceTotal=0;
  for(let p=1;p<indices.length;p++){
    const d=Math.max(1,basePositions[indices[p]]-basePositions[indices[p-1]]);
    baseDistances.push(d);
    baseDistanceTotal+=d;
  }

  const edgeShare=Math.min(extra*0.18,edgeShareMax);
  const intervalExtra=Math.max(0,extra-edgeShare*2);
  let x=innerLeft+edgeShare+leftExtents[0];
  positions[indices[0]]=x;

  for(let p=1;p<indices.length;p++){
    const proportionalExtra=baseDistanceTotal>0
      ? intervalExtra*(baseDistances[p-1]/baseDistanceTotal)
      : intervalExtra/gapCount;
    x+=rightExtents[p-1]+gap+leftExtents[p]+proportionalExtra;
    positions[indices[p]]=x;
  }

  const lastIndex=indices[indices.length-1];
  const renderedRight=positions[lastIndex]+rightExtents[rightExtents.length-1];
  const maxRight=rightBoundary-trailingPad;
  if(renderedRight>maxRight){
    const correction=renderedRight-maxRight;
    indices.forEach(i=>{positions[i]-=correction;});
  }

  const firstIndex=indices[0];
  const renderedLeft=positions[firstIndex]-leftExtents[0];
  const minLeft=leftBoundary+leadingPad;
  if(renderedLeft<minLeft){
    const correction=minLeft-renderedLeft;
    indices.forEach(i=>{positions[i]+=correction;});
  }
  return positions;
}

`;
const exportMarker='app.notationRenderer=Object.freeze({\n';
assert(renderer.includes(exportMarker),'renderer export marker missing');
renderer=renderer.replace(exportMarker,rendererInsertion+exportMarker);
renderer=replaceExact(renderer,
  '  drawAccidentalForNote,drawStemAndFlag\n});',
  '  drawAccidentalForNote,drawStemAndFlag,\n  drawStaffLines,drawBarline,drawDoubleBarline,layoutMeasureWithinBounds\n});',
  'renderer exports',false);

trainer=replaceExact(trainer,
  'for(let i=0;i<5;i++){const y=staff.top+i*staff.spacing;svg.appendChild(el("line",{x1:staff.x1,y1:y,x2:staff.x2,y2:y,stroke:"#1d2939","stroke-width":1.55}))}',
  'notationRenderer.drawStaffLines(svg,staff,{strokeWidth:1.55});',
  'example staff lines');
trainer=replaceExact(trainer,
  ' // Measure barlines + final double barline\n [570,990].forEach(x=>svg.appendChild(el("line",{x1:x,y1:staff.top,x2:x,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":1.7})));\n svg.appendChild(el("line",{x1:1050,y1:staff.top,x2:1050,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":1.4}));\n svg.appendChild(el("line",{x1:1058,y1:staff.top,x2:1058,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":3.2}));\n',
  ' // Measure barlines + final double barline\n [570,990].forEach(x=>notationRenderer.drawBarline(svg,x,staff,{strokeWidth:1.7}));\n notationRenderer.drawDoubleBarline(svg,1050,1058,staff);\n',
  'example barlines');

const layoutWrapper=`function layoutMeasureWithinBounds(
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

`;
trainer=replaceRange(trainer,'function layoutMeasureWithinBounds(','function layoutAllMeasuresWithinBounds(svg){',layoutWrapper,'measure horizontal layout');
trainer=replaceExact(trainer,
  'for(let i=0;i<5;i++){const y=staff.top+i*staff.spacing;svg.appendChild(el("line",{x1:staff.x1,y1:y,x2:staff.x2,y2:y,stroke:"#1d2939","stroke-width":1.7}))}',
  'notationRenderer.drawStaffLines(svg,staff);',
  'score staff lines');
trainer=replaceExact(trainer,
  ' [690,1225].forEach(x=>svg.appendChild(el("line",{x1:x,y1:staff.top,x2:x,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":1.8})));\n svg.appendChild(el("line",{x1:1350,y1:staff.top,x2:1350,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":1.4}));\n svg.appendChild(el("line",{x1:1358,y1:staff.top,x2:1358,y2:staff.top+staff.spacing*4,stroke:"#111","stroke-width":3.2}));\n',
  ' [690,1225].forEach(x=>notationRenderer.drawBarline(svg,x,staff));\n notationRenderer.drawDoubleBarline(svg,1350,1358,staff);\n',
  'score barlines');

fs.writeFileSync(trainerPath,trainer);
fs.writeFileSync(rendererPath,renderer);

const helper=`'use strict';\nconst assert=require('assert');\nconst pairs=${JSON.stringify(pairs)};\nfunction replaceExact(source,after,before,label){\n  const i=source.indexOf(after);assert(i>=0,'missing v0.8.1-b4 edit: '+label);\n  assert.equal(source.indexOf(after,i+after.length),-1,'duplicate v0.8.1-b4 edit: '+label);\n  return source.slice(0,i)+before+source.slice(i+after.length);\n}\nmodule.exports=function restoreScoreLayout(source,file){\n  if(file!=='src/trainer.js') return source;\n  for(const pair of [...pairs].reverse()) source=replaceExact(source,pair.after,pair.before,pair.label);\n  return source;\n};\n`;
fs.writeFileSync('tests/helpers/restore-renderer-score-layout.cjs',helper);

let domain=fs.readFileSync('tests/major-scale-domain.test.js','utf8');
domain=domain.replace(
  "const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\n",
  "const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\nconst restoreLayout=require('./helpers/restore-renderer-score-layout.cjs');\n"
);
domain=domain.replace(
  "let restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');",
  "let restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreLayout(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');"
);
assert(domain.includes('restoreLayout(trainer'),'major-scale restore chain patch failed');
fs.writeFileSync('tests/major-scale-domain.test.js',domain);

let boundary=fs.readFileSync('tests/notation-boundary.test.js','utf8');
boundary=boundary.replace(
  "const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\n",
  "const restoreNarrow=require('./helpers/restore-narrow-notation-layout.cjs');\nconst restoreLayout=require('./helpers/restore-renderer-score-layout.cjs');\n"
);
boundary=boundary.replace(
  "for(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(read(file),file),file),file),file),file),file);",
  "for(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(restoreNarrow(restoreLayout(read(file),file),file),file),file),file),file),file);"
);
boundary=boundary.replace(
  "  const source=restoreFeedback(restoreNarrow(read(file),file),file);",
  "  const source=restoreFeedback(restoreNarrow(restoreLayout(read(file),file),file),file);"
);
assert(boundary.includes('restoreLayout(read(file),file'),'notation restore chain patch failed');
fs.writeFileSync('tests/notation-boundary.test.js',boundary);

const test=`'use strict';\nconst fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');\nconst root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');\nconst source=read('src/domain/notation/notation-renderer.js');\nassert(!/supabase|fetch\\s*\\(|XMLHttpRequest|WebSocket|\\beval\\s*\\(|new Function|import\\s*\\(|MAJOR_SCALE_NOTATION|LEVEL_KEYS|STAGE_[1-4]/i.test(source),'renderer must stay presentation-only');\nconst document={createElementNS(ns,name){return{ns,name,attrs:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;}};}};\nconst ctx={window:{},document};vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'notation-renderer.js'});\nconst api=ctx.window.MajorScaleApp.notationRenderer;assert(api&&Object.isFrozen(api));\nconst mkSvg=()=>({children:[],appendChild(n){this.children.push(n);}});\nlet svg=mkSvg();api.drawStaffLines(svg,{x1:10,x2:110,top:20,spacing:8},{strokeWidth:2});\nassert.equal(svg.children.length,5);assert.deepStrictEqual(svg.children.map(n=>[n.attrs.x1,n.attrs.x2,n.attrs.y1,n.attrs.y2,n.attrs['stroke-width']]),[[10,110,20,20,2],[10,110,28,28,2],[10,110,36,36,2],[10,110,44,44,2],[10,110,52,52,2]]);\nsvg=mkSvg();api.drawBarline(svg,80,{top:20,spacing:8},{strokeWidth:1.5});assert.deepStrictEqual([svg.children[0].attrs.x1,svg.children[0].attrs.y1,svg.children[0].attrs.y2,svg.children[0].attrs['stroke-width']],[80,20,52,1.5]);\nsvg=mkSvg();api.drawDoubleBarline(svg,90,96,{top:20,spacing:8});assert.equal(svg.children.length,2);assert.deepStrictEqual(svg.children.map(n=>[n.attrs.x1,n.attrs['stroke-width']]),[[90,1.4],[96,3.2]]);\nlet positions=[0,0,0];api.layoutMeasureWithinBounds([0,1,2],100,300,{leadingPad:10,trailingPad:10,preferredGap:20,minimumGap:5,edgeShareMax:10,leftExtents:[10,10,10],rightExtents:[10,10,10],basePositions:[120,180,260],positions});\nassert(positions[0]-10>=110-1e-9);assert(positions[2]+10<=290+1e-9);assert(positions[0]<positions[1]&&positions[1]<positions[2]);\npositions=[0];api.layoutMeasureWithinBounds([0],100,160,{leadingPad:10,trailingPad:10,preferredGap:20,minimumGap:5,edgeShareMax:10,leftExtents:[12],rightExtents:[12],basePositions:[500],positions});assert.equal(positions[0],138);\nconst trainer=read('src/trainer.js');\nfor(const expected of ['notationRenderer.drawStaffLines(svg,staff','notationRenderer.drawBarline(svg,x,staff','notationRenderer.drawDoubleBarline(svg,1350,1358,staff)','notationRenderer.layoutMeasureWithinBounds(indices,leftBoundary,rightBoundary'])assert(trainer.includes(expected),'missing score-layout delegation: '+expected);\nfor(const protectedMarker of ['function drawBeams(){','scoreSvg.addEventListener(\"pointerdown\"','function render(){'])assert(trainer.includes(protectedMarker),'critical interaction/beaming runtime must remain: '+protectedMarker);\nconsole.log('PASS notation renderer score layout: staff frame, barlines, bounded horizontal slots, trainer delegation and protected interaction/beaming boundaries');\n`;
fs.writeFileSync('tests/notation-renderer-score-layout.test.js',test);
console.log('Applied v0.8.1-b4 score layout extraction');
