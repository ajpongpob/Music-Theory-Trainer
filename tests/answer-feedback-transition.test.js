'use strict';

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

const html=read('index.html');
const css=read('styles/app.css');
const keyboardSource=read('src/keyboard.js');
let trainerSource=read('src/trainer.js');

// Static contract: the deployed markup and visible shortcut label must match.
assert(html.includes('id="questionResultOverlay"'), 'question result overlay must exist');
assert(html.includes('id="questionResultFeedback"'), 'question result feedback container must exist');
assert(html.includes('id="questionResultNotation"'), 'question result notation snapshot container must exist');
assert(html.includes('id="questionResultContinue"'), 'question result continue button must exist');
assert(html.includes('data-acc="" data-shortcut="."'), 'Natural button must display . shortcut');
assert(!html.includes('data-acc="" data-shortcut="N"'), 'Natural button must no longer display N shortcut');
assert(css.includes('.question-result-overlay.is-visible'), 'question result transition CSS must exist');
assert(css.includes('@media(prefers-reduced-motion:reduce)'), 'transition must respect reduced motion');
assert(trainerSource.includes('const accidental=notationCore.accidentalFromShortcut(key);'), 'trainer must delegate the same accidental lookup');
assert(read('src/domain/notation/notation-core.js').includes('{".":""'), 'shared accidental lookup must accept . as Natural');
assert(keyboardSource.includes('[".","+","-","*","/"]'), 'keyboard accidental shortcut set must include .');
assert(!keyboardSource.includes('key==="n"'), 'legacy N Natural shortcut must be removed');

class ClassList {
  constructor(){this.values=new Set();}
  add(...names){names.forEach(n=>this.values.add(n));}
  remove(...names){names.forEach(n=>this.values.delete(n));}
  toggle(name,force){
    if(force===true){this.values.add(name);return true;}
    if(force===false){this.values.delete(name);return false;}
    if(this.values.has(name)){this.values.delete(name);return false;}
    this.values.add(name);return true;
  }
  contains(name){return this.values.has(name);}
}

class MockElement {
  constructor(id=''){
    this.id=id;
    this.listeners={};
    this.style={};
    this.dataset={};
    this.className='';
    this.classList=new ClassList();
    this.hidden=false;
    this.disabled=false;
    this.value='';
    this.textContent='';
    this.innerHTML='';
    this.children=[];
    this.inert=false;
    this.attributes={};
    this.onclick=null;
    this.tagName='DIV';
  }
  addEventListener(type,cb){(this.listeners[type] ||= []).push(cb);}
  appendChild(n){this.children.push(n);return n;}
  removeAttribute(name){delete this.attributes[name];delete this[name];}
  setAttribute(name,value){this.attributes[name]=String(value);this[name]=String(value);}
  getAttribute(name){return this.attributes[name] ?? null;}
  querySelectorAll(){return [];}
  querySelector(){return null;}
  cloneNode(){const clone=new MockElement(this.id);clone.tagName=this.tagName;clone.innerHTML=this.innerHTML;clone.textContent=this.textContent;clone.attributes={...this.attributes};return clone;}
  focus(){this.focused=true;}
  click(){if(typeof this.onclick==='function')this.onclick({target:this,currentTarget:this,preventDefault(){}});}
  setPointerCapture(){}
  getBoundingClientRect(){return {left:0,top:0,width:1200,height:300};}
  getScreenCTM(){return null;}
  createSVGPoint(){return {x:0,y:0,matrixTransform(){return {x:0,y:0};}};}
}

function buildTrainerHarness(){
  const elements=new Map();
  const get=id=>{
    if(!elements.has(id)) elements.set(id,new MockElement(id));
    return elements.get(id);
  };
  const sessionApp=get('session-app');
  const document={
    activeElement:null,
    documentElement:{classList:new ClassList()},
    fonts:null,
    getElementById:get,
    querySelector(selector){
      if(selector==='.session-app') return sessionApp;
      return get('query:'+selector);
    },
    querySelectorAll(selector){
      if(selector==='.session-app > .session-header, .session-app > .session-main') return [get('session-header'),get('session-main')];
      return [];
    },
    createElementNS(){return new MockElement();},
    createElement(){return new MockElement();},
    addEventListener(){}
  };
  const context={
    console:{log(){},warn(){},error(){}},
    document,
    window:null,
    ResizeObserver:class{observe(){}},
    requestAnimationFrame:cb=>{cb();return 1;},
    cancelAnimationFrame(){},
    setTimeout,clearTimeout,
    Promise,Object,Array,String,Number,Boolean,RegExp,Math,JSON,Date,Map,Set,WeakMap,WeakSet,Intl,
    confirm(){return true;},
    addEventListener(){}
  };
  context.window=context;
  context.MajorScaleApp={};

  trainerSource=trainerSource.replace(
    'initializeTrainerAfterMusicFont();',
    'window.__trainerUiTest={showQuestionResultTransition,hideQuestionResultTransition,setQuestionResultAction,state};'
  );

  vm.createContext(context);
  for(const rel of ['src/domain/notation/notation-core.js','src/exercises/major-scale/major-scale.config.js','src/exercises/major-scale/major-scale.domain.js']) vm.runInContext(fs.readFileSync(path.join(ROOT,rel),'utf8'),context,{filename:rel});
  vm.runInContext(trainerSource,context,{filename:'trainer.js'});
  return {context,elements,get,sessionApp};
}

{
  const {context,get,sessionApp}=buildTrainerHarness();
  const api=context.__trainerUiTest;
  assert(api, 'trainer UI test bridge should be available in harness');

  const allTrue=n=>Array.from({length:n},()=>true);
  const lo={
    BN01_TREBLE_PITCH:{correct:15,total:15,score:100,flags:allTrue(15)},
    BN06_STEM_DIRECTION:{correct:6,total:6,score:100,flags:allTrue(6)},
    RH01_DURATION_VALUE:{correct:15,total:15,score:100,flags:allTrue(15)},
    GR02_PRIMARY_BEAM:{correct:5,total:5,score:100,flags:allTrue(5)},
    MS03_SCALE_ACCIDENTAL:{correct:15,total:15,score:100,flags:allTrue(15)}
  };
  api.state.questionIndex=0;
  api.state.sessionResults=[{key:'C major',score:100,lo}];

  api.showQuestionResultTransition({score:100,lo});

  const overlay=get('questionResultOverlay');
  const panel=get('questionResultPanel');
  assert.strictEqual(overlay.hidden,false,'overlay should be shown');
  assert(panel.classList.contains('passed'),'passed result should receive passed class');
  assert(!panel.classList.contains('needs-work'),'passed result should not receive needs-work class');
  assert.strictEqual(get('questionResultTitle').textContent,'ข้อ 1 — C Major');
  assert(get('questionResultFeedback').innerHTML.includes('Treble Pitch'), 'feedback should expose skill-first diagnostic rows');
  assert(get('questionResultFeedback').innerHTML.includes('Correct'), 'all-correct skill status must be textual, not color-only');
  assert.strictEqual(get('questionResultScore').textContent,'100%');
  assert(get('questionResultFeedback').innerHTML.includes('ไม่พบข้อผิดพลาด'), 'feedback should show all-correct summary');
  assert(!get('questionResultFeedback').innerHTML.includes('คะแนนรวมแบบถ่วงน้ำหนัก'), 'question feedback must not show weighted-score wording');
  assert.strictEqual(get('questionResultNotation').children.length,1,'submitted notation snapshot should be shown with feedback');
  assert.strictEqual(get('questionResultContinue').disabled,true,'continue waits for persistence/mastery evaluation');
  assert.strictEqual(sessionApp.inert,false,'dialog ancestor must remain interactive');
  for(const id of ['session-header','session-main']){
    assert.strictEqual(get(id).inert,true,'trainer background must be inert while modal is open');
    assert.strictEqual(get(id).getAttribute('aria-hidden'),'true');
  }
  assert(overlay.classList.contains('is-visible'),'overlay transition class should be applied');

  api.setQuestionResultAction({disabled:false,text:'ทำข้อต่อไป'});
  assert.strictEqual(get('questionResultContinue').disabled,false);
  assert.strictEqual(get('questionResultContinue').textContent,'ทำข้อต่อไป');

  api.hideQuestionResultTransition({immediate:true});
  assert.strictEqual(overlay.hidden,true,'overlay should hide cleanly');
  assert.strictEqual(sessionApp.inert,false,'trainer should be interactive after modal closes');
  for(const id of ['session-header','session-main']){
    assert.strictEqual(get(id).inert,false,'background should be interactive after modal closes');
    assert.strictEqual(get(id).getAttribute('aria-hidden'),null);
  }
}

// Runtime keyboard contract: . selects Natural; N must no longer do so.
{
  let keydown=null;
  const accidentalCalls=[];
  const context={
    window:{majorScaleTrainerKeyboard:{
      setAccidental(key){accidentalCalls.push(key);},
      setRhythm(){},insertLetter(){}
    }},
    document:{
      addEventListener(type,cb){if(type==='keydown')keydown=cb;},
      getElementById(){return null;}
    }
  };
  vm.createContext(context);
  vm.runInContext(keyboardSource,context,{filename:'keyboard.js'});
  assert.strictEqual(typeof keydown,'function','keyboard listener should register');

  const makeEvent=key=>({
    key,
    target:{tagName:'DIV'},
    ctrlKey:false,metaKey:false,altKey:false,isComposing:false,
    preventDefault(){this.prevented=true;}
  });
  const dot=makeEvent('.');
  keydown(dot);
  assert.deepStrictEqual(accidentalCalls,['.'],'dot should invoke Natural accidental mapping');
  assert.strictEqual(dot.prevented,true,'dot shortcut should prevent default');

  const n=makeEvent('n');
  keydown(n);
  assert.deepStrictEqual(accidentalCalls,['.'],'N should no longer invoke Natural accidental mapping');
}

console.log('PASS answer feedback transition + Natural hotkey');
