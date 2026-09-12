from pathlib import Path
import hashlib,json

ROOT=Path(__file__).resolve().parents[1]
trainer=ROOT/'src/trainer.js'
fixture_path=ROOT/'tests/fixtures/v091-path-stage-boundary.json'
fixture=json.loads(fixture_path.read_text(encoding='utf-8'))
entry=fixture['files']['src/trainer.js']
# Keep beforeGzipBase64 unchanged so all domain/notation tests still reconstruct
# the exact protected v0.9.1 trainer. Only approve the additive feedback shell as
# the current post-checkpoint file.
entry['afterSha256']=hashlib.sha256(trainer.read_bytes()).hexdigest()
fixture['checkpoint']='v0.9.1 + diagnostic-feedback-presentation'
fixture_path.write_text(json.dumps(fixture,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print('Approved additive feedback checkpoint:',entry['afterSha256'])
