'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

class MockElement {
  constructor(id = '') {
    this.id = id;
    this.listeners = {};
    this.style = {};
    this.dataset = {};
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.classList = {add(){}, remove(){}, toggle(){}};
  }
  addEventListener(type, cb) {(this.listeners[type] ||= []).push(cb);}
  appendChild(node) {this.children.push(node); return node;}
  removeAttribute() {}
  setAttribute(name, value) {this[name] = value;}
  getAttribute(name) {return this[name] ?? null;}
  querySelectorAll() {return [];}
  querySelector() {return null;}
  focus() {}
  click() {for (const cb of this.listeners.click || []) cb({currentTarget:this,target:this,preventDefault(){}});}
  setPointerCapture() {}
  getBoundingClientRect() {return {left:0,top:0,width:1200,height:300};}
  getScreenCTM() {return null;}
  createSVGPoint() {return {x:0,y:0,matrixTransform(){return {x:0,y:0};}};}
}

function makeContext() {
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, new MockElement(id));
    return elements.get(id);
  };

  const document = {
    activeElement: null,
    documentElement: {classList:{add(){},remove(){}}},
    fonts: null,
    getElementById: getElement,
    querySelectorAll() {return [];},
    querySelector(selector) {return getElement('query:' + selector);},
    createElementNS() {return new MockElement();},
    addEventListener() {}
  };

  const calls = [];
  const authRepository = {
    async getUser() {
      calls.push(['auth.getUser']);
      return {data:{user:{id:'student-1'}}, error:null};
    }
  };

  const practiceRepository = {
    async getRequiredActiveExerciseByCode(code) {
      calls.push(['practice.getRequiredActiveExerciseByCode', code]);
      return {data:{id:'exercise-1'}, error:null};
    },
    async getRequiredActiveStageByCode(exerciseId, stageCode) {
      calls.push(['practice.getRequiredActiveStageByCode', exerciseId, stageCode]);
      return {data:{id:'stage-2'}, error:null};
    },
    async createPracticeSession(payload) {
      calls.push(['practice.createPracticeSession', payload]);
      return {data:{id:'session-new'}, error:null};
    },
    async getOpenPracticeSessions(userId) {
      calls.push(['practice.getOpenPracticeSessions', userId]);
      return {data:[{id:'stale-1',started_at:'2026-09-01T00:00:00Z',last_activity_at:'2026-09-01T00:10:00Z'}],error:null};
    },
    async closePracticeSession(args) {
      calls.push(['practice.closePracticeSession', args]);
      return {data:null,error:null};
    },
    async createAttempt(payload) {
      calls.push(['practice.createAttempt', payload]);
      return {data:{id:'attempt-1'},error:null};
    },
    async createAttemptSkillResults(rows) {
      calls.push(['practice.createAttemptSkillResults', rows]);
      return {data:null,error:null};
    },
    async updatePracticeSession(sessionId, updates) {
      calls.push(['practice.updatePracticeSession', sessionId, updates]);
      return {data:null,error:null};
    }
  };

  const masteryRepository = {
    async getOptionalActiveExerciseByCode(code) {
      calls.push(['mastery.getOptionalActiveExerciseByCode', code]);
      return {data:{id:'exercise-1'},error:null};
    },
    async getActiveStagesForExercise(exerciseId) {
      calls.push(['mastery.getActiveStagesForExercise', exerciseId]);
      return {data:[{id:'stage-1',code:'STAGE_1'},{id:'stage-2',code:'STAGE_2'}],error:null};
    },
    async getInProgressStageProgress(userId, stageIds) {
      calls.push(['mastery.getInProgressStageProgress', userId, stageIds]);
      return {data:[{stage_id:'stage-2',status:'in_progress'}],error:null};
    },
    async getRequiredStageItems(stageId) {
      calls.push(['mastery.getRequiredStageItems', stageId]);
      return {data:[{item_code:'C',sequence_order:1},{item_code:'G',sequence_order:2}],error:null};
    },
    async getPracticeSessionsForStage(args) {
      calls.push(['mastery.getPracticeSessionsForStage', args]);
      return {data:[{id:'session-old'}],error:null};
    },
    async getRecentAttemptItems(sessionIds, rollingWindow) {
      calls.push(['mastery.getRecentAttemptItems', sessionIds, rollingWindow]);
      return {data:[{item_code:'C',checked_at:'2026-09-01T00:00:00Z'}],error:null};
    },
    async getStageMastery(args) {
      calls.push(['mastery.getStageMastery', args]);
      return {data:[{
        exercise_id:'exercise-1',stage_id:'stage-2',rolling_window:10,
        attempts_found:10,required_items:2,covered_items:1,overall_score:92,
        enough_attempts:true,coverage_passed:false,skills_passed:true,mastery_passed:false,
        skill_results:[
          {skill_code:'BN01_TREBLE_PITCH',score:95,threshold:90,passed:true},
          {skill_code:'BN06_STEM_DIRECTION',score:90,threshold:85,passed:true},
          {skill_code:'RH01_DURATION_VALUE',score:90,threshold:85,passed:true},
          {skill_code:'GR02_PRIMARY_BEAM',score:90,threshold:85,passed:true},
          {skill_code:'MS03_SCALE_ACCIDENTAL',score:95,threshold:90,passed:true}
        ]
      }],error:null};
    },
    async advanceStageIfMastered(args) {
      calls.push(['mastery.advanceStageIfMastered', args]);
      return {data:[{
        advanced:true,
        completed_stage_code:'STAGE_2',
        next_stage_code:'STAGE_3',
        exercise_mastered:false,
        overall_score:96
      }],error:null};
    }
  };

  const windowListeners = {};
  const context = {
    console:{log(){},warn(){},error(...args){calls.push(['console.error', ...args.map(String)]);}},
    document,
    window:null,
    globalThis:null,
    MajorScaleApp:undefined,
    ResizeObserver: class {observe(){} disconnect(){}},
    requestAnimationFrame: cb => setTimeout(cb,0),
    cancelAnimationFrame: clearTimeout,
    setTimeout, clearTimeout,
    Promise, Object, Array, String, Number, Boolean, RegExp, Math, JSON, Date, Map, Set, WeakMap, WeakSet,
    Intl,
    confirm(){return true;}
  };
  context.window = context;
  context.globalThis = context;
  context.window.addEventListener = (type, cb) => {(windowListeners[type] ||= []).push(cb);};
  context.window.removeEventListener = () => {};
  context.window.confirm = () => true;
  context.window.MajorScaleApp = {authRepository, practiceRepository, masteryRepository};
  context.__calls = calls;
  context.__elements = elements;
  return context;
}

function loadTrainer(context) {
  let source = fs.readFileSync(path.join(ROOT, 'src/trainer.js'), 'utf8');
  const oldTail = 'initializeTrainerAfterMusicFont();\n})();';
  const newTail = `window.__trainerDataTestHooks={\n` +
    `state,resolveMajorScaleExerciseStage,createPracticeSessionRecord,ensurePracticeSessionRecord,` +
    `closeStalePracticeSessionsForCurrentUser,closeCurrentPracticeSession,loadCurrentLevelFromProgress,` +
    `loadMissingStageItemCodes,refreshMasteryProgress,saveAttemptSkillResults,updatePracticeSessionProgress,` +
    `completePracticeSessionRecord,advanceLevelIfMastered,saveAttemptRecord};\n})();`;
  assert(source.includes(oldTail), 'trainer initialization tail not found');
  source = source.replace(oldTail, newTail);
  vm.createContext(context);
  vm.runInContext(source, context, {filename:'trainer.js'});
  assert(context.__trainerDataTestHooks, 'trainer data test hooks not exposed');
  return context.__trainerDataTestHooks;
}

(async () => {
  const context = makeContext();
  const hooks = loadTrainer(context);
  const calls = context.__calls;

  const resolved = await hooks.resolveMajorScaleExerciseStage(2);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(resolved)), {exerciseId:'exercise-1',stageId:'stage-2'});

  const currentLevel = await hooks.loadCurrentLevelFromProgress();
  assert.strictEqual(currentLevel, 2, 'current level should map STAGE_2 to Level 2');

  const missing = await hooks.loadMissingStageItemCodes({exerciseId:'exercise-1',stageId:'stage-2',rollingWindow:10});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(missing)), ['G'], 'only uncovered item should be returned');

  hooks.state.level = 2;
  const masteryUi = await hooks.refreshMasteryProgress(2);
  assert(masteryUi, 'mastery UI result should be returned');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(masteryUi.missing_item_codes)), ['G']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(hooks.state.masteryPriorityItemCodes)), ['G']);

  hooks.state.practiceSessionGeneration = 7;
  hooks.state.practiceSessionId = null;
  hooks.state.practiceSessionPromise = null;
  const sessionId = await hooks.createPracticeSessionRecord(7, 2);
  assert.strictEqual(sessionId, 'session-new');
  assert.strictEqual(hooks.state.practiceSessionId, 'session-new');

  const staleClosed = await hooks.closeStalePracticeSessionsForCurrentUser();
  assert.strictEqual(staleClosed, 1);

  hooks.state.practiceSessionId = 'session-new';
  hooks.state.attemptSaveChain = Promise.resolve();
  const closeOk = await hooks.closeCurrentPracticeSession();
  assert.strictEqual(closeOk, true);
  assert.strictEqual(hooks.state.practiceSessionId, null);

  // Full persistence chain: create/reuse session -> attempt -> skill evidence ->
  // session progress -> generic mastery progression -> session completion.
  hooks.state.practiceSessionGeneration = 8;
  hooks.state.practiceSessionId = null;
  hooks.state.practiceSessionPromise = null;
  const saveResult = await hooks.saveAttemptRecord({
    generation:8,
    questionNumber:1,
    itemCode:'C',
    score:100,
    responseJson:{answer:'mock'},
    loResults:{
      BN01_TREBLE_PITCH:{correct:15,total:15,score:100,flags:{}}
    },
    completedQuestions:1,
    level:2
  });

  assert(saveResult, 'saveAttemptRecord should return a result');
  assert.strictEqual(saveResult.attemptId, 'attempt-1');
  assert.strictEqual(saveResult.mastery.advanced, true);
  assert.strictEqual(saveResult.mastery.completedLevel, 2);
  assert.strictEqual(saveResult.mastery.nextLevel, 3);
  assert.strictEqual(saveResult.mastery.overallScore, 96);

  const errorCalls = calls.filter(call => call[0] === 'console.error');
  assert.deepStrictEqual(errorCalls, [], 'data-flow smoke test should not log errors');

  const names = calls.map(call => call[0]);
  for (const required of [
    'practice.createPracticeSession',
    'practice.createAttempt',
    'practice.createAttemptSkillResults',
    'practice.updatePracticeSession',
    'mastery.getStageMastery',
    'mastery.advanceStageIfMastered'
  ]) {
    assert(names.includes(required), `expected ${required} to be called`);
  }

  const sessionCreates = calls.filter(call => call[0] === 'practice.createPracticeSession');
  assert(sessionCreates.some(call => call[1]?.app_version === '0.8.0-a'), 'practice session should persist app_version 0.8.0-a');

  console.log('PASS trainer practice/mastery data-flow smoke');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
