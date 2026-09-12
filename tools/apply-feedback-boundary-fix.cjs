'use strict';
const fs=require('fs');

function read(file){return fs.readFileSync(file,'utf8');}
function write(file,content){fs.writeFileSync(file,content);}
function replaceExact(source,before,after,label){
  const first=source.indexOf(before);
  if(first<0) throw new Error(`Missing boundary patch target: ${label}`);
  if(source.indexOf(before,first+before.length)>=0) throw new Error(`Duplicate boundary patch target: ${label}`);
  return source.slice(0,first)+after+source.slice(first+before.length);
}

let major=read('tests/major-scale-domain.test.js');
major=replaceExact(
  major,
  "const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nlet restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');\n",
  "const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nconst restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');\nlet restored=require('./helpers/restore-notation-baseline.cjs')(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(trainer,'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js'),'src/trainer.js');\n",
  'major-scale exact restoration chain'
);
write('tests/major-scale-domain.test.js',major);

let boundary=read('tests/notation-boundary.test.js');
boundary=replaceExact(
  boundary,
  "const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(read(file),file),file),file),file);\n",
  "const restoreNote=require('./helpers/restore-renderer-note-primitives.cjs');\nconst restoreFeedback=require('./helpers/restore-feedback-answer-snapshot.cjs');\nfor(const file of Object.keys(boundary.files))restore(restoreRenderer(restoreStatic(restoreNote(restoreFeedback(read(file),file),file),file),file);\n",
  'notation exact restoration chain'
);
write('tests/notation-boundary.test.js',boundary);

console.log('Applied feedback exact-boundary restoration support');
