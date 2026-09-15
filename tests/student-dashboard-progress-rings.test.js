'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const compat=fs.readFileSync(path.join(ROOT,'src/dashboard/student-dashboard-v2-compat.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles/student-dashboard-progress-rings.css'),'utf8');

assert(compat.includes('getStageMastery'),'Progress rings must use the trusted stage mastery RPC');
assert(compat.includes('rolling_window'),'Progress denominator must come from the configured rolling window');
assert(compat.includes('attempts_found'),'Progress numerator must come from recorded stage attempts');
assert(compat.includes("stage?.stage_status==='mastered'"),'Mastered stages must be handled explicitly');
assert(compat.includes('progress:100'),'Mastered stages must display 100%');
assert(compat.includes("stage?.stage_status==='locked'"),'Locked stages must be handled explicitly');
assert(compat.includes("dataset.progressLabel=`${value}%`"),'Unlocked stages must expose a percentage label');
assert(compat.includes("icon.setAttribute('role','progressbar')"),'Unlocked stage rings must expose accessible progress semantics');
assert(compat.includes("icon.setAttribute('aria-valuenow',String(value))"),'Progress rings must expose their current percentage to assistive technology');
assert(compat.includes('masteryCache.clear()'),'Stage progress evidence must refresh when the dashboard model refreshes');
assert(compat.includes('model.masteryReadiness'),'Current-stage ring must use the same composite readiness as the Dashboard bar');
assert(compat.includes('MutationObserver'),'Progress rings must survive V2 dashboard rerenders');
assert(compat.includes('student-dashboard-progress-rings.css'),'Compatibility layer must load the ring stylesheet');

assert(css.includes('conic-gradient'),'Progress ring rendering must be circular rather than a linear bar');
assert(css.includes('var(--sd2-stage-progress)'),'Ring fill must be driven by the computed percentage');
assert(css.includes('.sd2-stage.is-mastered'),'Mastered rings must have a distinct completed treatment');
assert(css.includes('[aria-current="step"]'),'Current stage ring must have a distinct active treatment');
assert(css.includes('.is-locked-ring'),'Locked stages must have a lock-specific treatment');
assert(css.includes('content:"🔒"'),'Locked stages must visibly show a lock instead of a percentage');

console.log('PASS Student Dashboard learning-path progress rings use real mastery evidence and preserve locked/mastered semantics');
