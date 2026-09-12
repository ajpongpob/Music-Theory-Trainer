'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const write=(rel,s)=>{fs.mkdirSync(path.dirname(path.join(root,rel)),{recursive:true});fs.writeFileSync(path.join(root,rel),s);};
function sliceBetween(source,start,end,label){
  const a=source.indexOf(start);assert(a>=0,'missing start '+label);
  const b=source.indexOf(end,a);assert(b>a,'missing end '+label);
  return source.slice(a,b);
}
function replaceOnce(source,before,after,label){
  const i=source.indexOf(before);assert(i>=0,'missing '+label);assert.equal(source.indexOf(before,i+1),-1,'duplicate '+label);
  return source.slice(0,i)+after+source.slice(i+before.length);
}

let renderer=read('src/domain/notation/notation-renderer.js');
const insertion=`function measureSvgTextGlyph(svg,glyph,fontSize,fontFamily){
  // Measure the exact glyph geometry from the same SVG/font used for rendering.
  // A temporary invisible probe avoids relying on font baseline assumptions.
  const probe=createSvgElement("text",{
    x:0,y:0,
    "font-size":fontSize,
    "font-family":fontFamily,
    visibility:"hidden",
    "pointer-events":"none"
  },glyph);

  svg.appendChild(probe);

  let box={x:0,y:-fontSize*.75,width:fontSize*.55,height:fontSize};
  try{
    const measured=probe.getBBox();
    if(measured && measured.width>0 && measured.height>0){
      box={
        x:measured.x,
        y:measured.y,
        width:measured.width,
        height:measured.height
      };
    }
  }catch(err){
    console.warn("SVG glyph measurement fallback:",err);
  }

  probe.remove();
  return box;
}

function noteheadHalfWidthForRhythm(svg,rhythm,options){
  const glyph=
    rhythm==="whole" ? options.smufl.noteheadWhole :
    rhythm==="half" ? options.smufl.noteheadHalf :
    rhythm==="eighth" ? options.smufl.noteheadBlack :
    null;

  if(glyph){
    const box=measureSvgTextGlyph(svg,glyph,options.fontSize,options.fontFamily);
    if(box && box.width>0) return box.width/2;
  }

  // Existing custom ellipse noteheads (quarter/sixteenth).
  return 10.8;
}

function drawNotehead(group,svg,x,y,rhythm,fill,options){
  const useSmuflHead=["whole","half","eighth"].includes(rhythm);

  if(useSmuflHead){
    const glyph=
      rhythm==="whole" ? options.smufl.noteheadWhole :
      rhythm==="half" ? options.smufl.noteheadHalf :
      options.smufl.noteheadBlack;

    const box=measureSvgTextGlyph(svg,glyph,options.fontSize,options.fontFamily);
    const textX=x-(box.x+box.width/2);

    group.appendChild(createSvgElement("text",{
      x:textX,
      y,
      "font-size":options.fontSize,
      "font-family":options.fontFamily,
      fill,
      class:\`smufl-notehead smufl-notehead-\${rhythm}\`,
      "pointer-events":"none"
    },glyph));
  }else{
    group.appendChild(createSvgElement("ellipse",{
      cx:x,cy:y,rx:10.8,ry:7.2,
      fill,
      stroke:fill,
      "stroke-width":2,
      transform:\`rotate(-18 \${x} \${y})\`
    }));
  }
}

function drawAccidentalForNote(group,svg,accidental,noteX,noteY,fill,rhythm,options){
  const glyph=accidentalSmuflGlyph(accidental,options.smufl);
  if(!glyph) return;

  const box=measureSvgTextGlyph(svg,glyph,options.fontSize,options.fontFamily);
  const noteHalfWidth=noteheadHalfWidthForRhythm(svg,rhythm,options);
  const noteHeadLeft=noteX-noteHalfWidth;
  const targetRight=noteHeadLeft-options.accidentalToNoteGap;
  const textX=targetRight-(box.x+box.width);

  group.appendChild(createSvgElement("text",{
    x:textX,
    y:noteY,
    "font-size":options.fontSize,
    "font-family":options.fontFamily,
    fill,
    class:"score-accidental",
    "pointer-events":"none"
  },glyph));
}

function drawStemAndFlag(group,x,y,rhythm,fill,dir,beamGroup,options){
  const sx=dir==="up"?x+10:x-10;
  const endY=dir==="up"?y-55:y+55;

  if(!beamGroup || !["eighth","sixteenth"].includes(rhythm)){
    group.appendChild(createSvgElement("line",{x1:sx,y1:y,x2:sx,y2:endY,stroke:fill,"stroke-width":2.3}));
  }

  if(["eighth","sixteenth"].includes(rhythm)&&!beamGroup){
    // SMuFL provides separate combining flags for up/down stems.
    // Using the dedicated down glyph prevents the flag from being mirrored.
    const flagGlyph=rhythm==="sixteenth"
      ? (dir==="up" ? options.smufl.flag16thUp : options.smufl.flag16thDown)
      : (dir==="up" ? options.smufl.flag8thUp : options.smufl.flag8thDown);

    group.appendChild(createSvgElement("text",{
      x:sx,
      y:endY,
      "font-size":options.fontSize,
      "font-family":options.fontFamily,
      fill,
      class:\`smufl-flag smufl-flag-\${rhythm}-\${dir}\`,
      "pointer-events":"none"
    },flagGlyph));
  }
}

`;
const marker='app.notationRenderer=Object.freeze({';
assert(!renderer.includes('function drawNotehead('),'b3 already applied');
renderer=replaceOnce(renderer,marker,insertion+marker,'renderer export marker');
renderer=replaceOnce(renderer,
`  drawKeySignature,rightEdgeOfSvgClass,drawTimeSignature\n`,
`  drawKeySignature,rightEdgeOfSvgClass,drawTimeSignature,\n  measureSvgTextGlyph,noteheadHalfWidthForRhythm,drawNotehead,\n  drawAccidentalForNote,drawStemAndFlag\n`,'renderer exports');
write('src/domain/notation/notation-renderer.js',renderer);

let trainer=read('src/trainer.js');
const pairs=[];
function replaceCaptured(before,after,label){pairs.push({before,after,label});trainer=replaceOnce(trainer,before,after,label);}

const oldHalf=sliceBetween(trainer,'function noteheadHalfWidthForRhythm(','function visibleAccidentalForNote','noteheadHalfWidthForRhythm');
const newHalf=`function noteheadHalfWidthForRhythm(svg,rhythm,staffObj=staff){\n  return notationRenderer.noteheadHalfWidthForRhythm(svg,rhythm,{\n    smufl:SMUFL,\n    fontSize:musicEm(staffObj),\n    fontFamily:SMUFL_FONT\n  });\n}\n\n\n\n`;
replaceCaptured(oldHalf,newHalf,'noteheadHalfWidthForRhythm');

const oldMeasure=sliceBetween(trainer,'function measureSvgTextGlyph(','function rightEdgeOfTimeSignature','measureSvgTextGlyph');
const newMeasure=`function measureSvgTextGlyph(svg,glyph,fontSize,fontFamily){return notationRenderer.measureSvgTextGlyph(svg,glyph,fontSize,fontFamily);}\n\n`;
replaceCaptured(oldMeasure,newMeasure,'measureSvgTextGlyph');

const oldAcc=sliceBetween(trainer,'function drawAccidentalForNote(','function drawNote(n,i)','drawAccidentalForNote');
const newAcc=`function drawAccidentalForNote(group,accToShow,noteX,noteY,fill,noteIndex){\n  const note=state.notes[noteIndex];\n  return notationRenderer.drawAccidentalForNote(\n    group,scoreSvg,accToShow,noteX,noteY,fill,\n    note ? note.rhythm : "quarter",\n    {\n      smufl:SMUFL,\n      fontSize:musicEm(staff),\n      fontFamily:SMUFL_FONT,\n      accidentalToNoteGap:sp(staff,0.30)\n    }\n  );\n}\n\n`;
replaceCaptured(oldAcc,newAcc,'drawAccidentalForNote');

const noteheadStart=' const open=["whole","half"].includes(n.rhythm);';
const oldNotehead=sliceBetween(trainer,noteheadStart,' const accToShow=','drawNote notehead block');
const newNotehead=` notationRenderer.drawNotehead(g,svg,x,y,n.rhythm,fill,{\n   smufl:SMUFL,\n   fontSize:musicEm(staff),\n   fontFamily:SMUFL_FONT\n });\n`;
replaceCaptured(oldNotehead,newNotehead,'drawNote notehead block');

const stemStart=' if(n.rhythm!=="whole"){';
const oldStem=sliceBetween(trainer,stemStart,' svg.appendChild(g);','drawNote stem/flag block');
const newStem=` if(n.rhythm!=="whole"){\n   const groupItems=n.beamGroup ? state.notes.map((note,idx)=>note&&note.beamGroup===n.beamGroup?{n:note,i:idx}:null).filter(Boolean) : [];\n   const dir=groupItems.length>1 ? getBeamDirection(groupItems) : (n.stem==="auto"?autoStem(n.letter,n.octave):n.stem);\n   notationRenderer.drawStemAndFlag(g,x,y,n.rhythm,fill,dir,n.beamGroup,{\n     smufl:SMUFL,\n     fontSize:musicEm(staff),\n     fontFamily:SMUFL_FONT\n   });\n }\n`;
replaceCaptured(oldStem,newStem,'drawNote stem/flag block');
write('src/trainer.js',trainer);

const helper=`'use strict';\nconst assert=require('assert');\nconst pairs=${JSON.stringify(pairs)};\nfunction replaceExact(source,after,before,label){\n  const i=source.indexOf(after);assert(i>=0,'missing v0.8.1-b3 edit: '+label);\n  assert.equal(source.indexOf(after,i+1),-1,'duplicate v0.8.1-b3 edit: '+label);\n  return source.slice(0,i)+before+source.slice(i+after.length);\n}\nmodule.exports=function restoreNoteRendering(source,file){\n  if(file!=='src/trainer.js') return source;\n  for(const pair of pairs) source=replaceExact(source,pair.after,pair.before,pair.label);\n  return source;\n};\n`;
write('tests/helpers/restore-renderer-note-primitives.cjs',helper);

let boundary=read('tests/notation-boundary.test.js');
boundary=replaceOnce(boundary,
"const restoreStatic=require('./helpers/restore-renderer-static-signatures.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(read(file),file),file),file);",
"const restoreStatic=require('./helpers/restore-renderer-static-signatures.cjs');\nconst restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(read(file),file),file),file),file);",
'notation boundary restore chain');
write('tests/notation-boundary.test.js',boundary);

let domain=read('tests/major-scale-domain.test.js');
domain=replaceOnce(domain,
"const restoreStatic=require('./helpers/restore-renderer-static-signatures.cjs');\nlet restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js');",
"const restoreStatic=require('./helpers/restore-renderer-static-signatures.cjs');\nconst restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nlet restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');",
'major scale restore chain');
write('tests/major-scale-domain.test.js',domain);

const test=`'use strict';\nconst fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');\nconst root=path.resolve(__dirname,'..'),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');\nconst source=read('src/domain/notation/notation-renderer.js');\nassert(!/supabase|fetch\\s*\\(|XMLHttpRequest|WebSocket|\\beval\\s*\\(|new Function|import\\s*\\(|MAJOR_SCALE_NOTATION|LEVEL_KEYS|STAGE_[1-4]/i.test(source),'renderer must stay presentation-only');\nconst document={createElementNS(ns,name){return{ns,name,attrs:{},textContent:'',setAttribute(k,v){this.attrs[k]=v;},remove(){if(this.parent&&this.parent.children){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1);}},getBBox(){return this.box||{x:0,y:-60,width:40,height:80};}};}};\nconst ctx={window:{},document,console};vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'notation-renderer.js'});\nconst api=ctx.window.MajorScaleApp.notationRenderer;assert(api&&Object.isFrozen(api));\nconst smufl={noteheadWhole:'W',noteheadHalf:'H',noteheadBlack:'B',flag8thUp:'8U',flag8thDown:'8D',flag16thUp:'16U',flag16thDown:'16D',accidentalFlat:'FL',accidentalNatural:'N',accidentalSharp:'SH',accidentalDoubleSharp:'DS',accidentalDoubleFlat:'DF'};\nfunction mkSvg(box={x:-2,y:-20,width:20,height:40}){return{children:[],appendChild(n){n.parent=this;n.box=box;this.children.push(n);return n;}};}\nfunction group(){return{children:[],appendChild(n){this.children.push(n);return n;}};}\nlet svg=mkSvg({x:-3,y:-25,width:18,height:45});\nassert.deepStrictEqual(JSON.parse(JSON.stringify(api.measureSvgTextGlyph(svg,'X',72,'TrainerBravura'))),{x:-3,y:-25,width:18,height:45});\nassert.equal(svg.children.length,0,'measurement probe removed');\nsvg=mkSvg({x:-2,y:-20,width:24,height:40});\nassert.equal(api.noteheadHalfWidthForRhythm(svg,'whole',{smufl,fontSize:72,fontFamily:'TrainerBravura'}),12);\nassert.equal(api.noteheadHalfWidthForRhythm(svg,'quarter',{smufl,fontSize:72,fontFamily:'TrainerBravura'}),10.8);\nlet g=group();svg=mkSvg({x:-2,y:-20,width:24,height:40});\napi.drawNotehead(g,svg,100,120,'whole','#111',{smufl,fontSize:72,fontFamily:'TrainerBravura'});\nassert.equal(g.children.length,1);assert.equal(g.children[0].name,'text');assert.equal(g.children[0].textContent,'W');assert.equal(g.children[0].attrs.x,90);assert.equal(g.children[0].attrs.y,120);\ng=group();api.drawNotehead(g,svg,100,120,'quarter','#111',{smufl,fontSize:72,fontFamily:'TrainerBravura'});\nassert.equal(g.children[0].name,'ellipse');assert.deepStrictEqual(g.children[0].attrs,{cx:100,cy:120,rx:10.8,ry:7.2,fill:'#111',stroke:'#111','stroke-width':2,transform:'rotate(-18 100 120)'});\ng=group();svg=mkSvg({x:-2,y:-20,width:20,height:40});\napi.drawAccidentalForNote(g,svg,'#',100,120,'#111','quarter',{smufl,fontSize:72,fontFamily:'TrainerBravura',accidentalToNoteGap:5});\nassert.equal(g.children.length,1);assert.equal(g.children[0].textContent,'SH');assert.equal(g.children[0].attrs.x,66.2);assert.equal(g.children[0].attrs.y,120);\ng=group();api.drawStemAndFlag(g,100,120,'quarter','#111','up',null,{smufl,fontSize:72,fontFamily:'TrainerBravura'});\nassert.equal(g.children.length,1);assert.deepStrictEqual(g.children[0].attrs,{x1:110,y1:120,x2:110,y2:65,stroke:'#111','stroke-width':2.3});\ng=group();api.drawStemAndFlag(g,100,120,'eighth','#111','down',null,{smufl,fontSize:72,fontFamily:'TrainerBravura'});\nassert.equal(g.children.length,2);assert.equal(g.children[1].textContent,'8D');assert.equal(g.children[1].attrs.x,90);assert.equal(g.children[1].attrs.y,175);\ng=group();api.drawStemAndFlag(g,100,120,'sixteenth','#111','up','beam-1',{smufl,fontSize:72,fontFamily:'TrainerBravura'});assert.equal(g.children.length,0,'beamed short note leaves stem/beam rendering to beam engine');\nconst trainer=read('src/trainer.js');\nassert(trainer.includes('return notationRenderer.measureSvgTextGlyph'));\nassert(trainer.includes('return notationRenderer.noteheadHalfWidthForRhythm'));\nassert(trainer.includes('return notationRenderer.drawAccidentalForNote'));\nassert(trainer.includes('notationRenderer.drawNotehead(g,svg,x,y,n.rhythm,fill'));\nassert(trainer.includes('const dir=groupItems.length>1 ? getBeamDirection(groupItems)'));\nassert(trainer.includes('notationRenderer.drawStemAndFlag(g,x,y,n.rhythm,fill,dir,n.beamGroup'));\nfor(const forbidden of ['function drawBeams(){','scoreSvg.addEventListener("pointerdown"','function check(){'])assert(trainer.includes(forbidden),'critical legacy runtime must remain: '+forbidden);\nconsole.log('PASS notation renderer note primitives: glyph measurement, noteheads, accidentals, stems/flags, wrappers and beam/interaction boundaries');\n`;
write('tests/notation-renderer-note-primitives.test.js',test);
console.log('Applied v0.8.1-b3 note rendering extraction');
