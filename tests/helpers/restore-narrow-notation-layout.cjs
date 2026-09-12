'use strict';
const assert=require('assert');

const optimizer="function optimizeQuestionResultSnapshotLayout(snapshot){\n  const systems=Array.from(snapshot.querySelectorAll(\"g[data-system]\"));\n  if(systems.length!==3) return false;\n\n  const second=systems[1];\n  const third=systems[2];\n  const secondBody=Array.from(second.children).find(node=>\n    node.localName===\"g\" && node.getAttribute(\"pointer-events\")!==\"none\"\n  );\n  const thirdBody=Array.from(third.children).find(node=>\n    node.localName===\"g\" && node.getAttribute(\"pointer-events\")!==\"none\"\n  );\n  if(!secondBody || !thirdBody) return false;\n\n  // Review-only layout: keep measure 1 on the first system and place the\n  // short final whole-note measure after measure 2 on the second system.\n  // The editable score remains unchanged, so interaction geometry is safe.\n  secondBody.setAttribute(\"transform\",\"translate(-600 180)\");\n  thirdBody.setAttribute(\"transform\",\"translate(-620 180)\");\n  Array.from(second.children).forEach(node=>{\n    if(node.localName===\"line\") node.setAttribute(\"x2\",\"740\");\n  });\n  second.appendChild(thirdBody);\n  second.setAttribute(\"transform\",\"translate(0 -30)\");\n  third.remove();\n\n  snapshot.setAttribute(\"viewBox\",\"0 0 750 430\");\n  snapshot.classList.add(\"question-result-score-snapshot-compact\");\n  return true;\n}\n\n";
const narrowCss="\n/* v0.8.1 feedback preview — narrow-screen notation readability */\n@media(max-width:815px){\n  .workspace-card .score-stage{\n    height:auto !important;\n    min-height:min(94vw,660px) !important;\n    overflow:visible !important;\n    align-items:stretch !important;\n  }\n  .workspace-card #scoreSvg{\n    width:100% !important;\n    height:min(94vw,660px) !important;\n    min-height:min(94vw,660px) !important;\n    max-height:none !important;\n    aspect-ratio:auto !important;\n    flex-shrink:0;\n  }\n  .question-result-notation{\n    overflow:auto;\n  }\n  .question-result-notation .question-result-score-snapshot{\n    max-height:none !important;\n  }\n  .question-result-notation .question-result-score-snapshot-compact{\n    width:100%;\n    height:auto !important;\n    max-height:none !important;\n  }\n}\n";

function replaceExact(source,after,before,label){
  const i=source.indexOf(after);
  assert(i>=0,'missing narrow-layout edit: '+label);
  assert.equal(source.indexOf(after,i+after.length),-1,'duplicate narrow-layout edit: '+label);
  return source.slice(0,i)+before+source.slice(i+after.length);
}

module.exports=function restoreNarrowNotationLayout(source,file){
  if(file==='styles/app.css'){
    return replaceExact(source,narrowCss,'','narrow CSS');
  }
  if(file!=='src/trainer.js') return source;

  source=replaceExact(
    source,
    optimizer+'function renderQuestionResultNotationSnapshot(){\n',
    'function renderQuestionResultNotationSnapshot(){\n',
    'snapshot optimizer'
  );
  source=replaceExact(
    source,
    '  snapshot.querySelectorAll(\'[stroke="#9b6400"]\').forEach(node=>node.setAttribute("stroke","#111"));\n\n  optimizeQuestionResultSnapshotLayout(snapshot);\n  container.appendChild(snapshot);\n',
    '  snapshot.querySelectorAll(\'[stroke="#9b6400"]\').forEach(node=>node.setAttribute("stroke","#111"));\n\n  container.appendChild(snapshot);\n',
    'snapshot optimizer call'
  );
  return source;
};
