(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

const FALLBACK_LABELS = Object.freeze({
  BN01_TREBLE_PITCH: {
    th: 'ชื่อระดับเสียง (Pitch Name — ไม่จำกัด Octave)',
    en: 'Pitch Name'
  },
  BN06_STEM_DIRECTION: {
    th: 'ทิศทางก้านโน้ต (Stem Direction)',
    en: 'Stem Direction'
  },
  RH01_DURATION_VALUE: {
    th: 'ค่าความยาวของตัวโน้ต (Duration Value)',
    en: 'Duration Value'
  },
  GR02_PRIMARY_BEAM: {
    th: 'การรวบเขบ็ต (Primary Beam)',
    en: 'Primary Beam'
  },
  MS03_SCALE_ACCIDENTAL: {
    th: 'เครื่องหมายแปลงเสียงในบันไดเสียง (Scale Accidental)',
    en: 'Scale Accidental'
  }
});

const labels = new Map(
  Object.entries(FALLBACK_LABELS).map(([code, value]) => [code, {...value}])
);

let applying = false;
let queued = false;

function currentLanguage() {
  return app.i18n?.getLanguage?.() === 'en' ? 'en' : 'th';
}

function labelFor(code) {
  const row = labels.get(code) || FALLBACK_LABELS[code];
  if (!row) return '';
  return currentLanguage() === 'en'
    ? (row.en || row.th || '')
    : (row.th || row.en || '');
}

function setText(node, value) {
  if (node && value && node.textContent !== value) node.textContent = value;
}

function applySkillLabels() {
  if (applying || typeof document === 'undefined') return;
  applying = true;

  try {
    // Internal skill identifiers remain in data attributes/model state for
    // filtering and mastery calculations, but must never be rendered as UI text.
    document.querySelectorAll('.sd2-skill-code').forEach(node => node.remove());

    document.querySelectorAll('[data-sd2-skill-filter]').forEach(card => {
      const code = card.dataset.sd2SkillFilter || '';
      const label = labelFor(code);
      if (!label) return;
      setText(card.querySelector('.sd2-skill-name'), label);
      card.setAttribute(
        'aria-label',
        currentLanguage() === 'en'
          ? `Open progress for ${label}`
          : `เปิดความก้าวหน้าของ ${label}`
      );
    });

    document.querySelectorAll('[data-progress-skill]').forEach(card => {
      const code = card.dataset.progressSkill || '';
      const label = labelFor(code);
      if (!label) return;
      setText(card.querySelector('.sd2-skill-name'), label);
    });

    const trendFilter = document.getElementById('sd2ProgressTrendFilter');
    if (trendFilter) {
      Array.from(trendFilter.options).forEach(option => {
        if (option.value === 'ALL') {
          setText(option, currentLanguage() === 'en' ? 'All Skills' : 'ทุกทักษะ');
          return;
        }
        setText(option, labelFor(option.value));
      });
    }

    const focusCode = window.__studentDashboardV2Model?.focusSkill?.code;
    if (focusCode) {
      const focusLabel = labelFor(focusCode);
      if (focusLabel) {
        document.querySelectorAll('#sd2ContinueBody .sd2-focus-line strong').forEach(node => {
          setText(node, focusLabel);
        });
      }
    }
  } finally {
    applying = false;
  }
}

function queueApply() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    applySkillLabels();
  });
}

async function refreshLabelsFromDatabase() {
  try {
    const result = await app.dashboardRepository?.getActiveSkills?.();
    if (!result?.error && Array.isArray(result?.data)) {
      result.data.forEach(row => {
        if (!row?.code) return;
        const fallback = FALLBACK_LABELS[row.code] || {};
        labels.set(row.code, {
          th: row.name_th || fallback.th || row.short_name || row.code,
          en: row.short_name || fallback.en || row.name_th || row.code
        });
      });
    }
  } catch (_error) {
    // Fallback labels keep the UI usable if the metadata query is unavailable.
  }
  applySkillLabels();
}

function start() {
  applySkillLabels();
  refreshLabelsFromDatabase();

  const observer = new MutationObserver(queueApply);
  observer.observe(document.body, {childList: true, subtree: true});

  window.addEventListener('major-scale:languagechange', () => {
    requestAnimationFrame(applySkillLabels);
  });

  window.addEventListener('hashchange', () => {
    requestAnimationFrame(applySkillLabels);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, {once: true});
} else {
  start();
}
})();
