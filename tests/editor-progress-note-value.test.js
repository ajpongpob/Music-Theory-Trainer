'use strict';

const fs=require('fs'),assert=require('assert');
const hardening=fs.readFileSync('src/m15-learning-feedback-hardening.js','utf8');
const workflow=fs.readFileSync('.github/workflows/qa.yml','utf8');

assert(hardening.includes('.mastery-power-fill{'),'mastery power fill hardening style must exist');
assert(hardening.includes('position:absolute'),'mastery fill must be positioned so percentage width is measurable');
assert(hardening.includes('promoteSingleHighlightedNoteToExplicitSelection'),'post-insert highlighted note must be promoted to editable selection');
assert(hardening.includes("button.matches('.rhythm')"),'rhythm palette must promote the highlighted note before legacy handler runs');
assert(hardening.includes('isRhythmShortcut(event)'),'duration keyboard shortcuts must use the same selection repair');
assert(hardening.includes('โน้ตที่ไฮไลต์สามารถเปลี่ยนค่า Rhythm ได้ทันที'),'learner hint must match editable-highlight behavior');
assert(workflow.includes('node tests/editor-progress-note-value.browser.cjs'),'QA must gate the real-browser regression');

console.log('PASS editor regression hardening contract');
