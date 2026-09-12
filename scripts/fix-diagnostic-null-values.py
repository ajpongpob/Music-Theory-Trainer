from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
source_path=ROOT/'src/diagnostic-feedback.js'
source=source_path.read_text(encoding='utf-8')
old="const finite=value=>Number.isFinite(Number(value));"
new="const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));"
if source.count(old)!=1:
    raise SystemExit(f'finite helper: expected 1 match, found {source.count(old)}')
source=source.replace(old,new,1)
source_path.write_text(source,encoding='utf-8')

test_path=ROOT/'tests/diagnostic-feedback.test.js'
test=test_path.read_text(encoding='utf-8')
needle="assert.equal(api.statusForSkill({score:40,threshold:85,passed:false}),'needs-practice');"
replacement=needle+"\nassert.equal(api.statusForSkill({score:null,threshold:85,passed:false}),'not-assessed','missing score must never be coerced to zero');"
if test.count(needle)!=1:
    raise SystemExit(f'null regression insertion: expected 1 match, found {test.count(needle)}')
test=test.replace(needle,replacement,1)
test_path.write_text(test,encoding='utf-8')

print('Fixed null/undefined numeric normalization in diagnostic feedback')
