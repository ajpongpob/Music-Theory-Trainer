(() => {
'use strict';
const app = window.MajorScaleApp = window.MajorScaleApp || {};
function escapeDashboardHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}
function dashboardStatusMeta(status) {
  const map={
    mastered:{label:'ผ่านแล้ว',icon:'✓',className:'mastered'},
    in_progress:{label:'กำลังเรียน',icon:'●',className:'in-progress'},
    locked:{label:'ยังไม่เปิด',icon:'🔒',className:'locked'},
    not_started:{label:'ยังไม่เริ่ม',icon:'○',className:'not-started'}
  };
  return map[status] || {label:status || '—',icon:'○',className:'not-started'};
}
function dashboardPercent(mastered,total) {
  if(!total) return 0;
  return Math.max(0,Math.min(100,Math.round((mastered/total)*100)));
}
function dashboardScore(value) {
  const n=Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2).replace(/\.00$/,'')}%` : '—';
}
function dashboardCompletionDate(value) {
  if(!value) return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH',{
    day:'numeric',
    month:'short',
    year:'numeric'
  }).format(date);
}

app.dashboardUtils = Object.freeze({
  escapeDashboardHtml,
  dashboardStatusMeta,
  dashboardPercent,
  dashboardScore,
  dashboardCompletionDate
});
})();
