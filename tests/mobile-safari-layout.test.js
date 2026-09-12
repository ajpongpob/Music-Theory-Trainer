'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'styles/mobile-safari-fix.css'),'utf8');
const adapter=fs.readFileSync(path.join(root,'src/exercises/major-scale/runtime-adapter.js'),'utf8');

assert(adapter.includes("./styles/mobile-safari-fix.css"),'Major Scale runtime must load the narrow-screen Safari fix stylesheet');
assert(css.includes('@media (max-width:815px)'),'Safari score fix must be scoped to narrow screens');
assert(css.includes('overflow-y:auto !important'),'narrow Trainer must allow vertical page scrolling');
assert(css.includes('.workspace-card')&&css.includes('overflow:visible !important'),'workspace must not clip compact systems 2-3');
assert(css.includes('grid-template-rows:auto auto auto !important'),'narrow session grid must allow the workspace to grow');
assert(css.includes('.workspace-card .notation-palette')&&css.includes('position:static !important'),'mobile palette must not remain sticky over the navigation row');
assert(css.includes('min-height:44px !important'),'mobile navigation controls must preserve touch-sized hit targets');
assert(css.includes('pointer-events:none !important'),'shortcut labels must never intercept touch events');
console.log('PASS mobile Safari layout contract: 3-system score can grow/scroll and palette cannot overlay mobile navigation hit targets');
