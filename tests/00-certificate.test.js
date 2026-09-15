'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'src/certificate/certificate.js'),'utf8');
const repository=fs.readFileSync(path.join(ROOT,'src/data/dashboard.repository.js'),'utf8');

// Syntax must remain valid even though this browser module is not executed in Node.
new Function(source);

for(const code of ['STAGE_1','STAGE_2','STAGE_3','STAGE_4']){
  assert(source.includes(code),`Certificate eligibility must require ${code}`);
}
assert(source.includes("stages.length===4&&mastered.length===4"),'Certificate must unlock only after all four levels are mastered');
assert(source.includes('stage_mastered_at'),'Certificate completion date must come from stored mastery timestamps');
assert(source.includes('getStudentDashboard()'),'Certificate eligibility must use the authenticated dashboard data source');
assert(source.includes('getStudentProfileDetails(user.id)'),'Certificate learner name must come from the authenticated profile');
assert(source.includes('Download PDF')&&source.includes('ดาวน์โหลด PDF'),'Certificate page must expose bilingual PDF download copy');
assert(source.includes('pdfFromCanvas'),'Certificate must provide a client-side PDF export');
assert(repository.includes("./src/certificate/certificate.js?v=20260915-cert-1"),'Dashboard V2 must load the certificate module');

const base64=Array.from({length:6},(_,index)=>fs.readFileSync(path.join(ROOT,`src/certificate/template/part${index}.txt`),'utf8').trim()).join('');
const template=Buffer.from(base64,'base64');
assert(template.length>15000,'Certificate template asset should decode to a non-trivial image');
assert.strictEqual(template[0],0xff,'Certificate template must start with JPEG marker');
assert.strictEqual(template[1],0xd8,'Certificate template must start with JPEG marker');
assert.strictEqual(template[template.length-2],0xff,'Certificate template must end with JPEG marker');
assert.strictEqual(template[template.length-1],0xd9,'Certificate template must end with JPEG marker');

console.log('PASS Certificate: four-level eligibility, mastery date, authenticated profile, template integrity and PDF export contracts');
