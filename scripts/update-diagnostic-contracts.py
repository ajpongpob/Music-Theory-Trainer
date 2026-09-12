from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'tests/answer-feedback-transition.test.js'
text=path.read_text(encoding='utf-8')
old="assert.strictEqual(get('questionResultTitle').textContent,'ผ่านข้อนี้แล้ว ✓');"
new="assert.strictEqual(get('questionResultTitle').textContent,'ข้อ 1 — C Major');\n  assert(get('questionResultFeedback').innerHTML.includes('Treble Pitch'), 'feedback should expose skill-first diagnostic rows');\n  assert(get('questionResultFeedback').innerHTML.includes('Correct'), 'all-correct skill status must be textual, not color-only');"
if text.count(old)!=1:
    raise SystemExit(f'answer feedback title contract expected one match, found {text.count(old)}')
text=text.replace(old,new,1)
path.write_text(text,encoding='utf-8')
print('Diagnostic feedback test contracts updated')
