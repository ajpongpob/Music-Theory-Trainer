(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};
const registry = app.exerciseRegistry;

if (!registry || typeof registry.register !== 'function') {
  throw new Error('Exercise Registry must load before Major Scale definition');
}

registry.register({
  contractVersion: '1.0',
  code: 'MAJOR_SCALE_NOTATION',
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
    migrationCheckpoint: 'v0.8.0-a'
  }
});
})();
