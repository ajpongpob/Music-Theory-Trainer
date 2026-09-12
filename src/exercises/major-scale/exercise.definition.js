(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};
const registry = app.exerciseRegistry;

if (!registry || typeof registry.register !== 'function') {
  throw new Error('Exercise Registry must load before Major Scale definition');
}

function ensureMobileSafariFixStylesheet(){
  if(
    typeof document==='undefined' ||
    typeof document.querySelector!=='function' ||
    typeof document.createElement!=='function' ||
    !document.head
  ) return;
  if(document.querySelector('link[data-major-scale-mobile-safari-fix]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./styles/mobile-safari-fix.css';
  link.setAttribute('data-major-scale-mobile-safari-fix','true');
  document.head.appendChild(link);
}
ensureMobileSafariFixStylesheet();

registry.register({
  contractVersion: '1.0',
  code: app.majorScaleConfig.exerciseCode,
  runtime: app.majorScaleRuntimeAdapter,
  name: {
    th: 'การเขียนบันไดเสียงเมเจอร์',
    en: 'Major Scale Notation'
  },
  description: 'ฝึกเขียนบันไดเสียงเมเจอร์บนบรรทัดห้าเส้นตาม Stage และเกณฑ์ Mastery ที่กำหนด',
  capabilities: {
    staged: true,
    mastery: true,
    notation: true,
    scoredAttempts: true
  },
  metadata: {
    runtimeStatus: 'legacy-trainer',
    migrationCheckpoint: 'v0.8.1-a'
  }
});
})();
