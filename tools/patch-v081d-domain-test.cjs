'use strict';
const fs=require('fs'),assert=require('assert');
const path='tests/major-scale-domain.test.js';
let s=fs.readFileSync(path,'utf8');
function once(a,b,label){const i=s.indexOf(a);assert(i>=0,'missing '+label);assert.equal(s.indexOf(a,i+1),-1,'duplicate '+label);s=s.slice(0,i)+b+s.slice(i+a.length);}
once("vm.runInContext(read('src/domain/notation/notation-core.js'),ctx);","vm.runInContext(read('src/domain/notation/notation-core.js'),ctx);\nvm.runInContext(read('src/domain/notation/notation-beaming.js'),ctx);",'beaming vm load');
once("vm.runInContext('const notationCore=window.MajorScaleApp.notationCore;\\nconst LETTERS=[\"C\",\"D\",\"E\",\"F\",\"G\",\"A\",\"B\"];\\n'+helpers+","vm.runInContext('const notationCore=window.MajorScaleApp.notationCore;\\nconst notationBeaming=window.MajorScaleApp.notationBeaming;\\nconst LETTERS=[\"C\",\"D\",\"E\",\"F\",\"G\",\"A\",\"B\"];\\n'+helpers+",'beaming helper binding');
fs.writeFileSync(path,s);
console.log('Adapted Major Scale domain regression to shared beaming module');
