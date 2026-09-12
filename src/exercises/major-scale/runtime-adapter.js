(() => {
'use strict';
const app = window.MajorScaleApp = window.MajorScaleApp || {};
const $ = id => document.getElementById(id);
app.majorScaleRuntimeAdapter = Object.freeze({
  async launch(context) {
    if (!app.majorScaleDomain) throw new Error('Major Scale module ยังไม่พร้อมใช้งาน');
    const start = window.majorScaleTrainerStartForAuthenticatedUser;
    if (typeof start !== 'function') throw new Error('Major Scale runtime ยังไม่พร้อมใช้งาน');
    const match = /^STAGE_(\d+)$/.exec(context.stageCode || '');
    const level = match ? Number(match[1]) : null;
    if (match) $('levelSelect').value = String(level);
    $('studentDashboard').hidden = true; $('studentDashboard').inert = true;
    $('teacherDashboard').hidden = true; $('teacherDashboard').inert = true;
    $('trainerApp').hidden = false; $('trainerApp').inert = false;
    try {
      await start(level, context.sessionMode || 'practice');
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('resize'));
        window.dispatchEvent(new Event('major-scale-trainer-visible'));
      });
    } catch (error) {
      $('trainerApp').hidden = true; $('trainerApp').inert = true;
      $('studentDashboard').hidden = false; $('studentDashboard').inert = false;
      throw error;
    }
  },
  async close() {
    const close = window.majorScaleTrainerClosePracticeSession;
    if (typeof close === 'function') await close();
  }
});
})();
