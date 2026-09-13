(() => {
'use strict';

const PROFILE_NAME_SEPARATOR='\u001f';
const $=id=>document.getElementById(id);

function ensureStyles(){
  if(document.querySelector('style[data-profile-onboarding-v2-style]')) return;
  const style=document.createElement('style');
  style.dataset.profileOnboardingV2Style='true';
  style.textContent=`
    .profile-v2-hidden{display:none!important}
    #profileOnboardingSaveButton{
      flex:0 0 auto!important;
      min-width:190px;
      white-space:nowrap;
      padding-inline:22px;
      line-height:1.25;
    }
    @media(max-width:620px){
      #profileOnboardingSaveButton{width:100%;min-width:0}
    }
  `;
  document.head.appendChild(style);
}

function splitName(value){
  const raw=String(value||'').trim();
  if(!raw) return {firstName:'',lastName:''};
  const match=raw.match(/^(\S+)(?:\s+(.+))?$/u);
  return {
    firstName:match?.[1]?.trim()||raw,
    lastName:match?.[2]?.trim()||''
  };
}

function makeField({labelText,id,name,placeholder,maxlength,autocomplete}){
  const field=document.createElement('div');
  field.className='auth-field';
  const label=document.createElement('label');
  label.htmlFor=id;
  label.textContent=labelText;
  const input=document.createElement('input');
  input.id=id;
  input.name=name;
  input.type='text';
  input.placeholder=placeholder;
  input.maxLength=maxlength;
  input.required=true;
  if(autocomplete) input.autocomplete=autocomplete;
  field.append(label,input);
  return {field,input};
}

function syncVisibleNamesFromLegacy(form){
  const firstInput=$('profileOnboardingFullName');
  const lastInput=$('profileOnboardingLastName');
  const compat=form?.querySelector('input[name="full_name"][data-profile-name-compat]');
  if(!firstInput||!lastInput||!compat) return;

  const raw=String(firstInput.value||'').trim();
  if(raw.includes(' ') || !lastInput.value.trim()){
    const split=splitName(raw);
    if(split.firstName) firstInput.value=split.firstName;
    if(split.lastName || raw.includes(' ')) lastInput.value=split.lastName;
  }
  compat.value=`${firstInput.value.trim()}${PROFILE_NAME_SEPARATOR}${lastInput.value.trim()}`;
}

function enhanceForm(){
  const form=$('profileOnboardingForm');
  if(!form) return false;
  if(form.dataset.profileV2==='true') return true;

  const fullInput=$('profileOnboardingFullName');
  const displayInput=$('profileOnboardingDisplayName');
  const yearInput=$('profileOnboardingYearLevel');
  const sectionInput=$('profileOnboardingSection');
  if(!fullInput||!displayInput||!yearInput||!sectionInput) return false;

  form.dataset.profileV2='true';
  ensureStyles();

  const initialName=fullInput.value;
  const fullField=fullInput.closest('.auth-field');
  fullField?.classList.remove('auth-wide');
  const fullLabel=fullField?.querySelector('label');
  if(fullLabel) fullLabel.textContent='ชื่อ *';
  fullInput.name='first_name';
  fullInput.placeholder='ชื่อ';
  fullInput.maxLength=80;
  fullInput.autocomplete='given-name';

  const {field:lastField,input:lastInput}=makeField({
    labelText:'นามสกุล *',
    id:'profileOnboardingLastName',
    name:'last_name',
    placeholder:'นามสกุล',
    maxlength:100,
    autocomplete:'family-name'
  });
  fullField?.insertAdjacentElement('afterend',lastField);

  const compat=document.createElement('input');
  compat.type='hidden';
  compat.name='full_name';
  compat.dataset.profileNameCompat='true';
  form.appendChild(compat);

  const displayField=displayInput.closest('.auth-field');
  const displayLabel=displayField?.querySelector('label');
  if(displayLabel) displayLabel.textContent='ชื่อเล่น';
  displayInput.placeholder='เช่น ปิง';
  displayInput.maxLength=80;

  const yearField=yearInput.closest('.auth-field');
  yearField?.classList.add('profile-v2-hidden');
  yearInput.required=false;
  if(yearInput.tagName==='SELECT' && ![...yearInput.options].some(option=>option.value==='not_applicable')){
    const option=document.createElement('option');
    option.value='not_applicable';
    option.textContent='ไม่ใช้ข้อมูลชั้นปี';
    yearInput.appendChild(option);
  }

  const sectionField=sectionInput.closest('.auth-field');
  sectionField?.classList.add('profile-v2-hidden');

  const split=splitName(initialName);
  fullInput.value=split.firstName;
  lastInput.value=split.lastName;
  compat.value=`${split.firstName}${PROFILE_NAME_SEPARATOR}${split.lastName}`;
  yearInput.value='not_applicable';

  form.addEventListener('submit',()=>{
    const firstName=String(fullInput.value||'').trim();
    const lastName=String(lastInput.value||'').trim();
    compat.value=`${firstName}${PROFILE_NAME_SEPARATOR}${lastName}`;
    yearInput.value='not_applicable';
  },true);

  return true;
}

function resyncWhenShown(){
  const panel=$('profileOnboardingPanel');
  const form=$('profileOnboardingForm');
  if(!panel||!form||panel.hidden) return;
  setTimeout(()=>syncVisibleNamesFromLegacy(form),0);
}

function refresh(){
  if(enhanceForm()) resyncWhenShown();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',refresh,{once:true});
}else{
  refresh();
}

const observer=new MutationObserver(mutations=>{
  let shouldRefresh=false;
  for(const mutation of mutations){
    if(mutation.type==='childList' || (mutation.type==='attributes' && mutation.attributeName==='hidden')){
      shouldRefresh=true;
      break;
    }
  }
  if(shouldRefresh) refresh();
});
observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
})();
