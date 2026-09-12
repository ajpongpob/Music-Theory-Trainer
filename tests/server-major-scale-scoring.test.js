'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

(async()=>{
  const server=await import(pathToFileURL(path.join(root,'supabase/functions/submit-major-scale-attempt/scoring.mjs')).href);
  const trainer=read('src/trainer.js');
  const ctx={window:{}};
  vm.createContext(ctx);
  vm.runInContext(read('src/domain/notation/notation-core.js'),ctx);
  vm.runInContext(read('src/domain/notation/notation-beaming.js'),ctx);
  vm.runInContext(read('src/exercises/major-scale/major-scale.config.js'),ctx);
  vm.runInContext(read('src/exercises/major-scale/major-scale.domain.js'),ctx);
  const slice=(a,b)=>trainer.slice(trainer.indexOf(a),trainer.indexOf(b));
  const helpers=slice('function autoStem(','/* Fixed 3-measure pattern:')+
    slice('function pitchToStep(','function stepToPitch(')+
    slice('function effectiveStem(','function check(){');
  vm.runInContext(
    'const notationCore=window.MajorScaleApp.notationCore;\n'+
    'const notationBeaming=window.MajorScaleApp.notationBeaming;\n'+
    'const LETTERS=["C","D","E","F","G","A","B"];\n'+helpers+
    '\nwindow.rules=window.MajorScaleApp.majorScaleDomain.createRules({autoStem,beamStemDirectionFromNotes,pitchToStep,effectiveStem,beamGroupSignatures});',
    ctx
  );

  const config=ctx.window.MajorScaleApp.majorScaleConfig;
  const rules=ctx.window.rules;
  assert.equal(config.KEYS.length,29);
  assert.deepStrictEqual([...server.SUPPORTED_TONICS].sort(),plain(config.KEYS.map(key=>key.tonic)).sort());

  const toResponse=notes=>({notes:notes.map((note,index)=>({
    slot:index+1,
    letter:note.letter,
    octave:note.octave,
    accidental:note.accidental||'',
    rhythm:note.rhythm,
    stem:note.stem,
    beam_group:note.beamGroup??null
  }))});
  const serverLo=result=>plain(result.lo);
  const compare=(key,notes,label)=>{
    const expected=rules.buildExpected(key);
    const client=plain(rules.evaluateAnswer(expected,notes));
    const backend=server.evaluateMajorScaleResponse(key.tonic,toResponse(notes));
    assert.equal(backend.score,client.score,`${key.tonic} ${label} weighted score parity`);
    assert.deepStrictEqual(serverLo(backend),client.lo,`${key.tonic} ${label} LO evidence parity`);
    return {client,backend};
  };

  let comparisons=0;
  for(const key of config.KEYS){
    const expected=plain(rules.buildExpected(key));
    assert.deepStrictEqual(plain(server.buildExpected(key.tonic)),expected,`${key.tonic} expected answer parity`);

    const correct=compare(key,expected,'correct'); comparisons++;
    assert.equal(correct.backend.score,100,`${key.tonic} correct answer`);

    const octaveShift=plain(expected).map(note=>({...note,octave:note.octave+1}));
    const octave=compare(key,octaveShift,'octave displacement'); comparisons++;
    assert.equal(octave.backend.lo.BN01_TREBLE_PITCH.score,100,`${key.tonic} octave-independent BN01`);

    const accidental=plain(expected);
    accidental[0].accidental=accidental[0].accidental===''?'#':'';
    const accidentalResult=compare(key,accidental,'accidental error'); comparisons++;
    assert.equal(accidentalResult.backend.lo.BN01_TREBLE_PITCH.score,100,`${key.tonic} accidental must not penalize BN01`);
    assert(accidentalResult.backend.lo.MS03_SCALE_ACCIDENTAL.score<100,`${key.tonic} accidental must penalize MS03`);

    const wrongLetter=plain(expected);
    const letters=['C','D','E','F','G','A','B'];
    wrongLetter[0].letter=letters[(letters.indexOf(wrongLetter[0].letter)+1)%7];
    const wrongPitch=compare(key,wrongLetter,'wrong pitch name'); comparisons++;
    assert(wrongPitch.backend.lo.BN01_TREBLE_PITCH.score<100,`${key.tonic} wrong pitch name must penalize BN01`);
  }

  const bKey=plain(config.KEYS.find(key=>key.tonic==='B'));
  for(const stem of ['up','down']){
    const answer=plain(rules.buildExpected(bKey));
    assert.equal(answer[0].letter,'B');
    assert.equal(answer[0].octave,4);
    answer[0].stem=stem;
    const result=compare(bKey,answer,`B4 middle-line stem ${stem}`); comparisons++;
    assert.equal(result.backend.lo.BN06_STEM_DIRECTION.score,100,`independent B4 stem ${stem} accepted`);
  }

  assert.throws(
    ()=>server.evaluateMajorScaleResponse('C',{notes:[]}),
    /exactly 15 notes/,
    'server must reject malformed notation payloads'
  );
  assert.throws(
    ()=>server.evaluateMajorScaleResponse('H',toResponse(plain(rules.buildExpected(config.KEYS[0])))),
    /Unsupported Major key/,
    'server must reject unknown key/item codes'
  );

  console.log(`PASS server/client Major Scale scoring parity: 29 expected answers and ${comparisons} deterministic evaluations; octave-independent pitch, separated accidental, B4 stem policy`);
})().catch(error=>{console.error(error);process.exitCode=1;});
