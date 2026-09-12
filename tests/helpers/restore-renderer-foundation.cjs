'use strict';
const assert=require('assert');
function replaceExact(source,after,before,label){
  const i=source.indexOf(after);assert(i>=0,'missing renderer-foundation edit: '+label);
  assert.equal(source.indexOf(after,i+1),-1,'duplicate renderer-foundation edit: '+label);
  return source.slice(0,i)+before+source.slice(i+after.length);
}
module.exports=function restoreRendererFoundation(source,file){
  if(file==='src/trainer.js'){
    source=replaceExact(source,
      'const notationCore=window.MajorScaleApp.notationCore;\nconst notationRenderer=window.MajorScaleApp.notationRenderer;\nconst majorScaleModule=',
      'const notationCore=window.MajorScaleApp.notationCore;\nconst majorScaleModule=',
      'renderer namespace binding');
    source=replaceExact(source,
      'function accidentalSmuflGlyph(value){return notationRenderer.accidentalSmuflGlyph(value,SMUFL);}\nfunction el(name,attrs={},text=""){return notationRenderer.createSvgElement(name,attrs,text);}',
      'function accidentalSmuflGlyph(value){\n  return {\n    "b":SMUFL.accidentalFlat,\n    "":SMUFL.accidentalNatural,\n    "#":SMUFL.accidentalSharp,\n    "##":SMUFL.accidentalDoubleSharp,\n    "bb":SMUFL.accidentalDoubleFlat\n  }[value] ?? "";\n}\nfunction el(name,attrs={},text=""){const n=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text)n.textContent=text;return n}',
      'accidental/svg primitive wrappers');
    source=replaceExact(source,
      'function drawLedger(svg,x,step,stepToY){return notationRenderer.drawLedger(svg,x,step,stepToY);}',
      'function drawLedger(svg,x,step,stepToY){\n const ys=[];if(step<0){for(let s=-2;s>=step;s-=2)ys.push(stepToY(s))}\n else if(step>8){for(let s=10;s<=step;s+=2)ys.push(stepToY(s))}\n ys.forEach(y=>svg.appendChild(el("line",{x1:x-18,y1:y,x2:x+18,y2:y,stroke:"#111","stroke-width":1.4})));\n}',
      'ledger wrapper');
  } else if(file==='index.html'){
    source=replaceExact(source,
      '<script src="./src/domain/notation/notation-core.js"></script>\n<script src="./src/domain/notation/notation-renderer.js"></script>\n<script src="./src/exercises/exercise-contract.js"></script>',
      '<script src="./src/domain/notation/notation-core.js"></script>\n<script src="./src/exercises/exercise-contract.js"></script>',
      'renderer script load order');
  }
  return source;
};
