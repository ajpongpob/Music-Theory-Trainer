'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const script=fs.readFileSync(path.join(ROOT,'tests/live-pilot-viewports.browser.cjs'),'utf8');
const workflow=fs.readFileSync(path.join(ROOT,'.github/workflows/live-pilot.yml'),'utf8');

for(const token of [
  "{name:'desktop-1440',width:1440,height:900}",
  "{name:'desktop-1280',width:1280,height:800}",
  "{name:'tablet-landscape',width:1024,height:768}",
  "{name:'tablet-portrait',width:768,height:1024}",
  "{name:'mobile-390',width:390,height:844}",
  "{name:'mobile-360',width:360,height:800}"
]) assert(script.includes(token),`missing viewport gate: ${token}`);

assert(script.includes('documentWidth<=metrics.innerWidth+2'),'live viewport suite must reject document horizontal overflow');
assert(script.includes('bodyWidth<=metrics.innerWidth+2'),'live viewport suite must reject body horizontal overflow');
assert(script.includes("page.locator('#levelSelect').isDisabled()"),'responsive gate must preserve Learning Path Stage authority');
assert(script.includes("page.locator('#checkAnswer').isVisible()"),'responsive gate must verify primary exercise action');
assert(script.includes("page.locator('#dashboardButton').isVisible()"),'responsive gate must verify return navigation');
assert(workflow.includes('node tests/live-pilot-viewports.browser.cjs'),'manual live workflow must execute viewport gates');
assert(workflow.includes('environment: pilot-qa'),'live device gates must remain protected by pilot QA environment');
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*:/.test(workflow),'live viewport workflow must not expose service-role credentials');
console.log('PASS M1.5 pilot device gates: desktop, tablet and mobile live Chrome coverage is manually gated and secret-safe');
