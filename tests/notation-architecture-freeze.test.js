'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const notation=[
  'src/domain/notation/notation-core.js',
  'src/domain/notation/notation-renderer.js',
  'src/domain/notation/notation-interaction.js',
  'src/domain/notation/notation-beaming.js'
];
for(const file of notation){
  const source=read(file);
  assert(!/supabase|auth\.|repository|practiceSession|student_|teacher_|MAJOR_SCALE_NOTATION|STAGE_[1-4]/i.test(source),'notation layer must stay platform/exercise agnostic: '+file);
}
const trainer=read('src/trainer.js');
assert(trainer.includes('scoreSvg.addEventListener("pointerdown"'),'Trainer remains UI/event orchestrator');
assert(trainer.includes('notationInteraction.dragDeltaSteps('),'drag quantization delegates to interaction module');
assert(trainer.includes('notationInteraction.resetPointerInteraction('),'pointer reset delegates to interaction module');
assert(trainer.includes('notationBeaming.drawBeams('),'beam rendering delegates to beaming module');
assert(trainer.includes('notationBeaming.normalizeBeamGroups('),'beam normalization delegates to beaming module');
assert(!trainer.includes('const hookStart=p.x-12'),'secondary-beam hook algorithm must be outside Trainer');
console.log('PASS architecture freeze: notation core/renderer/interaction/beaming are backend/exercise agnostic; Trainer remains orchestration shell');
