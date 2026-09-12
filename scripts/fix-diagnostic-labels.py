from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

trainer_path=ROOT/'src/trainer.js'
trainer=trainer_path.read_text(encoding='utf-8')
old='''function feedbackSkillName(code){
  return LO_META[code]?.short || code;
}'''
new='''function feedbackSkillName(code){
  const display={
    BN01_TREBLE_PITCH:"Treble Pitch",
    BN06_STEM_DIRECTION:"Stem Direction",
    RH01_DURATION_VALUE:"Duration Value",
    GR02_PRIMARY_BEAM:"Primary Beam",
    MS03_SCALE_ACCIDENTAL:"Scale Accidental"
  };
  return display[code] || LO_META[code]?.short || code;
}'''
if trainer.count(old)!=1:raise SystemExit(f'trainer skill label match {trainer.count(old)}')
trainer=trainer.replace(old,new,1)
trainer_path.write_text(trainer,encoding='utf-8')

df_path=ROOT/'src/diagnostic-feedback.js'
df=df_path.read_text(encoding='utf-8')
old="const skillLabel=code=>config.LO_META?.[code]?.short||FALLBACK_LABELS[code]||code||'Skill';"
new="const skillLabel=code=>FALLBACK_LABELS[code]||config.LO_META?.[code]?.short||code||'Skill';"
if df.count(old)!=1:raise SystemExit(f'diagnostic skill label match {df.count(old)}')
df=df.replace(old,new,1)
df_path.write_text(df,encoding='utf-8')
print('Diagnostic feedback display labels aligned')
