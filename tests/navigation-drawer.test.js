'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const js=read('src/navigation-drawer.js');
const css=read('styles/navigation-drawer.css');
const authRepo=read('src/data/auth.repository.js');

assert(js.includes("button.id='appNavigationMenuButton'"),'hamburger button must be created explicitly');
assert(js.includes("drawer.id='appNavigationDrawer'"),'navigation drawer must be a named nav surface');
assert(js.includes("drawer.setAttribute('aria-label','เมนูหลัก')"),'drawer must expose a navigation label');
assert(js.includes("button.setAttribute('aria-expanded','false')"),'hamburger must implement aria-expanded');
assert(js.includes("button.setAttribute('aria-controls','appNavigationDrawer')"),'hamburger must implement aria-controls');
assert(js.includes("event.key==='Escape'"),'Escape must close the drawer');
assert(js.includes("event.key!=='Tab'"),'drawer must trap keyboard focus while open');
assert(js.includes("scrim.addEventListener('click'"),'scrim tap must close the drawer');
assert(js.includes("document.documentElement.classList.toggle('app-nav-drawer-open'"),'drawer open state must lock page scrolling');
assert(js.includes("requestAnimationFrame(()=>target?.focus?.())"),'closing the drawer must restore focus to its opener');
assert(js.includes("if(label.textContent!==nextLabel) label.textContent=nextLabel"),'surface label updates must be idempotent to avoid observer churn');
assert(js.includes('function navigationOwnedNode(node)'),'drawer must identify its own DOM mutations');
assert(js.includes('mutations.some(mutationNeedsSync)'),'MutationObserver must ignore navigation-owned DOM changes');
assert(js.includes('if(surfaceChanged || !lastAccountKey) syncAccount()'),'account reads must not run on every DOM mutation');
for(const action of ['dashboard','practice','progress','profile','logout']){
  assert(js.includes(`actionMarkup('${action}'`),`drawer missing ${action} action`);
}
assert(css.includes('.dashboard-v2-enabled #sd2TopNav{display:none!important;}'),'legacy Dashboard / Practice / Progress / Profile top nav must move out of the header');
assert(css.includes('#trainerApp #dashboardButton.app-nav-moved-action{display:none!important;}'),'trainer Dashboard button must move into the drawer');
assert(css.includes('html.app-nav-drawer-open') && css.includes('overflow:hidden!important'),'body scroll must lock while the drawer is open');
assert(authRepo.includes('./styles/navigation-drawer.css?v=20260913-nav-drawer'),'navigation drawer stylesheet must be loaded by the app');
assert(authRepo.includes('./src/navigation-drawer.js?v=20260913-nav-drawer'),'navigation drawer controller must be loaded by the app');

console.log('PASS universal navigation drawer contract: accessible drawer, stable DOM observation, bounded account reads, moved learner navigation and duplicate Profile/Logout access');
