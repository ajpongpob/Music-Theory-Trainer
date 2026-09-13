
(() => {
'use strict';
function ensureMobileSafariFixStylesheet(){
  if(
    typeof document==='undefined' ||
    typeof document.querySelector!=='function' ||
    typeof document.createElement!=='function' ||
    !document.head
  ) return;
  if(document.querySelector('link[data-mobile-safari-fix]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./styles/mobile-safari-fix.css';
  link.setAttribute('data-mobile-safari-fix','true');
  document.head.appendChild(link);
}
ensureMobileSafariFixStylesheet();

const $ = id => document.getElementById(id);
const screen = $('authScreen'), dashboard = $('studentDashboard'), teacherDashboard = $('teacherDashboard'), trainer = $('trainerApp');
const app = window.MajorScaleApp || {};
const authRepository = app.authRepository;
const client = app.supabaseClient;
const studentDashboardController = app.studentDashboard;
const teacherDashboardController = app.teacherDashboard;
let busy = false, ready = false, revision = 0, activeUser = null, authRouteRevision = 0;
let onboardingProfile = null, onboardingAuthUser = null;
const PASSWORD_RESET_REDIRECT = 'https://ajpongpob.github.io/Music-Theory-Trainer/?mode=reset-password';
const OAUTH_DEFAULT_REDIRECT = 'https://ajpongpob.github.io/Music-Theory-Trainer/';
const passwordRecoveryIntentFromUrl = (() => {
  try{
    const url=new URL(window.location.href);
    const hashParams=new URLSearchParams((url.hash || '').replace(/^#/,''));
    return url.searchParams.get('mode')==='reset-password' || hashParams.get('type')==='recovery';
  }catch(_error){
    return false;
  }
})();
let currentUserRole = null, passwordRecoveryMode = passwordRecoveryIntentFromUrl;
function message(id, text = '', error = false) {
  const target=$(id);
  if(!target) return;
  target.textContent = text;
  target.className = 'auth-message' + (error ? ' error' : '');
}
function controls() {
  [
    'loginButton','registerButton','showLoginButton','showRegisterButton',
    'googleLoginButton','googleRegisterButton',
    'showForgotPasswordButton','forgotPasswordButton','showLoginFromForgotButton',
    'resetPasswordButton','cancelResetPasswordButton',
    'profileOnboardingSaveButton','profileOnboardingLogoutButton',
    'logoutButton','dashboardLogoutButton','teacherDashboardLogoutButton',
    'teacherDashboardRefreshButton','dashboardButton'
  ].forEach(id => {
    const control=$(id);
    if(control) control.disabled = busy || !ready;
  });
}
function oauthRedirectUrl(){
  try{
    const url=new URL(window.location.href);
    url.search='';
    url.hash='';
    return url.href;
  }catch(_error){
    return OAUTH_DEFAULT_REDIRECT;
  }
}
function authRedirectErrorFromUrl(){
  try{
    const url=new URL(window.location.href);
    const hashParams=new URLSearchParams((url.hash || '').replace(/^#/,''));
    const code=url.searchParams.get('error_code') || hashParams.get('error_code') || url.searchParams.get('error') || hashParams.get('error');
    if(!code) return '';
    return url.searchParams.get('error_description') || hashParams.get('error_description') || code;
  }catch(_error){
    return '';
  }
}
function authProviderLabel(user){
  const provider=String(user?.app_metadata?.provider || user?.identities?.[0]?.provider || 'email').toLowerCase();
  return provider==='google' ? 'Google' : 'Email';
}
function ensureGoogleAuthControls(){
  if(typeof document==='undefined' || typeof document.createElement!=='function') return;
  if(!document.querySelector('style[data-google-auth-style]')){
    const style=document.createElement('style');
    style.setAttribute('data-google-auth-style','true');
    style.textContent=`
      .auth-oauth-block{margin-top:14px}
      .auth-oauth-divider{display:flex;align-items:center;gap:10px;margin:2px 0 10px;color:#64748b;font-size:.82rem}
      .auth-oauth-divider::before,.auth-oauth-divider::after{content:"";height:1px;background:#d7dee8;flex:1}
      .auth-google-button{width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;gap:10px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#1f2937;font:inherit;font-weight:700;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.05)}
      .auth-google-button:hover:not(:disabled){background:#f8fafc;border-color:#94a3b8}
      .auth-google-button:focus-visible{outline:3px solid rgba(37,99,235,.28);outline-offset:2px}
      .auth-google-button:disabled{opacity:.55;cursor:not-allowed}
      .auth-google-mark{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:50%;font-weight:800;color:#2563eb;background:#eff6ff}
      .auth-onboarding-card{width:min(680px,calc(100vw - 28px));max-width:680px}
      .auth-onboarding-intro{margin:0 0 16px;color:#475569;line-height:1.55}
      .auth-onboarding-account{display:flex;flex-wrap:wrap;gap:8px 14px;margin:0 0 18px;padding:12px 14px;border-radius:12px;background:#f8fafc;color:#475569;font-size:.9rem}
      .auth-onboarding-account strong{color:#0f172a}
      .auth-onboarding-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .auth-onboarding-grid .auth-field{margin:0}
      .auth-onboarding-grid .auth-wide{grid-column:1/-1}
      .auth-onboarding-grid select{width:100%;min-height:44px;padding:0 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a;font:inherit}
      .auth-required-note{margin:14px 0 0;color:#64748b;font-size:.82rem}
      .auth-onboarding-actions{display:flex;gap:10px;justify-content:space-between;align-items:center;margin-top:18px}
      .auth-onboarding-actions .auth-primary{flex:1}
      @media(max-width:620px){.auth-onboarding-grid{grid-template-columns:1fr}.auth-onboarding-grid .auth-wide{grid-column:auto}.auth-onboarding-actions{flex-direction:column-reverse}.auth-onboarding-actions button{width:100%}}
    `;
    document.head?.appendChild(style);
  }

  const configs=[
    {panel:'loginPanel',anchor:'loginButton',id:'googleLoginButton',label:'เข้าสู่ระบบด้วย Google',messageId:'loginMessage'},
    {panel:'registerPanel',anchor:'registerButton',id:'googleRegisterButton',label:'สมัครหรือเข้าสู่ระบบด้วย Google',messageId:'registerMessage'}
  ];
  for(const config of configs){
    if($(config.id)) continue;
    const panel=$(config.panel), anchor=$(config.anchor);
    if(!panel || !anchor) continue;
    const block=document.createElement('div');
    block.className='auth-oauth-block';
    const divider=document.createElement('div');
    divider.className='auth-oauth-divider';
    divider.textContent='หรือ';
    const button=document.createElement('button');
    button.id=config.id;
    button.type='button';
    button.className='auth-google-button';
    button.setAttribute('aria-label',config.label);
    button.innerHTML='<span class="auth-google-mark" aria-hidden="true">G</span><span></span>';
    button.lastElementChild.textContent=config.label;
    button.addEventListener('click',()=>signInWithGoogle(config.messageId));
    block.append(divider,button);
    anchor.insertAdjacentElement('afterend',block);
  }
}
function ensureProfileOnboardingPanel(){
  if($('profileOnboardingPanel') || typeof document==='undefined') return;
  const panel=document.createElement('section');
  panel.id='profileOnboardingPanel';
  panel.className='auth-card auth-onboarding-card';
  panel.hidden=true;
  panel.innerHTML=`
    <div class="auth-brand">
      <div class="auth-brand-icon">♫</div>
      <div><h1>Major Scale Notation Trainer</h1><p>ตั้งค่าโปรไฟล์ผู้เรียนก่อนเริ่มใช้งาน</p></div>
    </div>
    <h2>ข้อมูลโปรไฟล์</h2>
    <p class="auth-onboarding-intro">กรอกข้อมูลพื้นฐานเพื่อให้ระบบระบุตัวผู้เรียนและใช้แสดงผลใน Dashboard ของผู้เรียนและผู้สอนได้ถูกต้อง</p>
    <div class="auth-onboarding-account"><span>บัญชี: <strong id="profileOnboardingEmail">—</strong></span><span>เข้าสู่ระบบด้วย: <strong id="profileOnboardingProvider">—</strong></span></div>
    <form id="profileOnboardingForm">
      <div class="auth-onboarding-grid">
        <div class="auth-field auth-wide"><label for="profileOnboardingFullName">ชื่อ-นามสกุล *</label><input id="profileOnboardingFullName" name="full_name" type="text" autocomplete="name" maxlength="120" required placeholder="ชื่อ-นามสกุล"></div>
        <div class="auth-field"><label for="profileOnboardingDisplayName">ชื่อที่ต้องการให้แสดง</label><input id="profileOnboardingDisplayName" name="display_name" type="text" maxlength="80" placeholder="เช่น ปิง"></div>
        <div class="auth-field"><label for="profileOnboardingStudentId">รหัสนักศึกษา *</label><input id="profileOnboardingStudentId" name="student_id" type="text" inputmode="numeric" maxlength="60" required placeholder="รหัสนักศึกษา"></div>
        <div class="auth-field"><label for="profileOnboardingProgram">หลักสูตร / สาขาวิชา *</label><input id="profileOnboardingProgram" name="program" type="text" maxlength="120" required placeholder="เช่น ดนตรีสากล"></div>
        <div class="auth-field"><label for="profileOnboardingYearLevel">ชั้นปี *</label><select id="profileOnboardingYearLevel" name="year_level" required><option value="">เลือกชั้นปี</option><option value="1">ปี 1</option><option value="2">ปี 2</option><option value="3">ปี 3</option><option value="4">ปี 4</option><option value="5">ปี 5</option><option value="6">ปี 6</option><option value="graduate">บัณฑิตศึกษา</option><option value="other">อื่น ๆ</option></select></div>
        <div class="auth-field"><label for="profileOnboardingSection">หมู่เรียน / Section</label><input id="profileOnboardingSection" name="section" type="text" maxlength="40" placeholder="ถ้ามี"></div>
      </div>
      <p class="auth-required-note">* จำเป็นต้องกรอกให้ครบก่อนเข้าสู่ระบบครั้งแรก ข้อมูลนี้แก้ไขภายหลังได้จากเมนู Profile</p>
      <div id="profileOnboardingMessage" class="auth-message" aria-live="polite"></div>
      <div class="auth-onboarding-actions"><button id="profileOnboardingLogoutButton" class="auth-switch" type="button">ออกจากระบบ</button><button id="profileOnboardingSaveButton" class="auth-primary" type="submit">บันทึกและเริ่มใช้งาน</button></div>
    </form>`;
  screen.appendChild(panel);
  $('profileOnboardingForm').addEventListener('submit',saveProfileOnboarding);
  $('profileOnboardingLogoutButton').addEventListener('click',()=>$('logoutButton')?.click());
}
function showAuthPanel(name) {
  const panels={
    login:$('loginPanel'),
    register:$('registerPanel'),
    forgot:$('forgotPasswordPanel'),
    reset:$('resetPasswordPanel'),
    onboarding:$('profileOnboardingPanel')
  };
  Object.entries(panels).forEach(([key,element])=>{
    if(element) element.hidden=key!==name;
  });
}
function panel(register) {
  onboardingProfile=null;
  onboardingAuthUser=null;
  showAuthPanel(register ? 'register' : 'login');
  message('loginMessage');
  message('registerMessage');
  message('forgotMessage');
  message('resetPasswordMessage');
  message('profileOnboardingMessage');
}
function showForgotPasswordPanel() {
  const loginEmail=$('loginEmail')?.value.trim();
  if(loginEmail) $('forgotEmail').value=loginEmail;
  showAuthPanel('forgot');
  message('forgotMessage');
}
function showResetPasswordPanel() {
  screen.hidden=false;
  dashboard.hidden=true; dashboard.inert=true;
  teacherDashboard.hidden=true; teacherDashboard.inert=true;
  trainer.hidden=true; trainer.inert=true;
  showAuthPanel('reset');
  message('resetPasswordMessage');
}
function showProfileOnboarding(profile,user,errorMessage=''){
  ensureProfileOnboardingPanel();
  onboardingProfile=profile || {};
  onboardingAuthUser=user || null;
  screen.hidden=false;
  dashboard.hidden=true; dashboard.inert=true;
  teacherDashboard.hidden=true; teacherDashboard.inert=true;
  trainer.hidden=true; trainer.inert=true;
  $('sessionSummary').hidden=true;
  $('levelMasteryOverlay').hidden=true;
  showAuthPanel('onboarding');
  const meta=user?.user_metadata || {};
  $('profileOnboardingEmail').textContent=user?.email || '—';
  $('profileOnboardingProvider').textContent=authProviderLabel(user);
  $('profileOnboardingFullName').value=profile?.full_name || meta.full_name || meta.name || '';
  $('profileOnboardingDisplayName').value=profile?.display_name || '';
  $('profileOnboardingStudentId').value=profile?.student_id || '';
  $('profileOnboardingProgram').value=profile?.program || '';
  $('profileOnboardingYearLevel').value=profile?.year_level || '';
  $('profileOnboardingSection').value=profile?.section || '';
  message('profileOnboardingMessage',errorMessage,!!errorMessage);
  controls();
  setTimeout(()=>$('profileOnboardingFullName')?.focus(),0);
}
async function saveProfileOnboarding(event){
  event?.preventDefault?.();
  if(busy || !ready || !onboardingAuthUser?.id) return;
  const form=$('profileOnboardingForm');
  if(!form?.reportValidity()) return;
  const formData=new FormData(form), value=name=>String(formData.get(name)||'').trim();
  const required=['full_name','student_id','program','year_level'];
  if(required.some(name=>!value(name))){
    message('profileOnboardingMessage','กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบ',true);
    return;
  }
  busy=true; controls();
  message('profileOnboardingMessage','กำลังบันทึกข้อมูลโปรไฟล์...');
  try{
    const metadata=onboardingAuthUser.user_metadata || {};
    const avatarUrl=onboardingProfile?.avatar_url || metadata.avatar_url || metadata.picture || null;
    const {data,error}=await authRepository.updateRegistrationProfile({
      userId:onboardingAuthUser.id,
      fullName:value('full_name'),
      displayName:value('display_name') || null,
      studentId:value('student_id'),
      program:value('program'),
      yearLevel:value('year_level'),
      section:value('section') || null,
      avatarUrl
    });
    if(error) throw error;
    if(!data?.onboarding_completed_at) throw new Error('ระบบยังไม่ยืนยันว่าข้อมูลโปรไฟล์ครบ กรุณาตรวจสอบข้อมูลอีกครั้ง');
    onboardingProfile=data;
    message('profileOnboardingMessage','บันทึกข้อมูลเรียบร้อยแล้ว');
    await showDashboardForAuthenticatedUser();
  }catch(error){
    console.error('PROFILE ONBOARDING SAVE ERROR:',error);
    message('profileOnboardingMessage','บันทึกข้อมูลไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่'),true);
  }finally{
    busy=false; controls();
  }
}
async function resolveAuthenticatedRole() {
  if(!client || !activeUser) return 'student';
  const {data,error}=await authRepository.getUserRole(activeUser);
  if(error) throw error;
  return data?.role || 'student';
}
async function closeActiveExercise() {
  const host=app.exerciseHost;
  if(host?.getCurrentContext()) return host.close();
  const close=window.majorScaleTrainerClosePracticeSession;
  if(typeof close==='function') return close();
}
async function showTeacherDashboardForAuthenticatedUser({closeSession=false}={}) {
  if(!activeUser) return;
  if(closeSession){
    await closeActiveExercise();
  }
  screen.hidden=true;
  dashboard.hidden=true; dashboard.inert=true;
  teacherDashboard.hidden=false; teacherDashboard.inert=false;
  trainer.hidden=true; trainer.inert=true;
  $('sessionSummary').hidden=true;
  $('levelMasteryOverlay').hidden=true;
  if(!teacherDashboardController) throw new Error('Teacher Dashboard module is unavailable');
  await teacherDashboardController.load({activeUser,preferredClassId:$('teacherClassSelect')?.value || null});
}

async function showDashboardForAuthenticatedUser({closeSession=false}={}) {
  if(!activeUser) return;
  try{
    currentUserRole=await resolveAuthenticatedRole();
  }catch(error){
    console.error('RESOLVE USER ROLE ERROR:',error);
    currentUserRole='student';
  }
  if(currentUserRole==='teacher' || currentUserRole==='admin'){
    await showTeacherDashboardForAuthenticatedUser({closeSession});
    return;
  }
  if(closeSession){
    await closeActiveExercise();
  }
  screen.hidden=true;
  teacherDashboard.hidden=true; teacherDashboard.inert=true;
  dashboard.hidden=false;
  dashboard.inert=false;
  trainer.hidden=true;
  trainer.inert=true;
  $('sessionSummary').hidden=true;
  $('levelMasteryOverlay').hidden=true;
  if(!studentDashboardController) throw new Error('Student Dashboard module is unavailable');
  await studentDashboardController.load({activeUser});
}
async function routeAuthenticatedUser(user){
  if(!user?.id || user.id!==activeUser) return;
  const routeToken=++authRouteRevision;
  try{
    currentUserRole=await resolveAuthenticatedRole();
    if(routeToken!==authRouteRevision || user.id!==activeUser) return;
    if(currentUserRole==='teacher' || currentUserRole==='admin'){
      await showTeacherDashboardForAuthenticatedUser();
      return;
    }
    // Runtime-test stubs created before onboarding do not expose these methods.
    // Production always does; the fallback keeps legacy QA harnesses compatible.
    if(typeof authRepository.getRegistrationProfile!=='function'){
      await showDashboardForAuthenticatedUser();
      return;
    }
    const {data,error}=await authRepository.getRegistrationProfile(user.id);
    if(routeToken!==authRouteRevision || user.id!==activeUser) return;
    if(error) throw error;
    if(!data) throw new Error('ไม่พบโปรไฟล์ของบัญชีนี้');
    if(!data.onboarding_completed_at){
      showProfileOnboarding(data,user);
      return;
    }
    await showDashboardForAuthenticatedUser();
  }catch(error){
    console.error('AUTH PROFILE ROUTE ERROR:',error);
    if(routeToken!==authRouteRevision || user.id!==activeUser) return;
    if(typeof authRepository.getRegistrationProfile==='function') showProfileOnboarding(onboardingProfile||{},user,'ไม่สามารถตรวจสอบข้อมูลโปรไฟล์ได้: '+(error.message || 'กรุณาลองใหม่'));
    else await showDashboardForAuthenticatedUser();
  }
}
function sessionView(session) {
  const sessionUser=session?.user || null;
  const user=sessionUser?.id || null;
  const changed = user !== activeUser;
  activeUser = user;
  if(passwordRecoveryMode){
    showResetPasswordPanel();
    return;
  }
  if (!user) {
    authRouteRevision++;
    studentDashboardController?.invalidate?.();
    teacherDashboardController?.invalidate?.();
    currentUserRole=null;
    onboardingProfile=null;
    onboardingAuthUser=null;
    screen.hidden = false;
    dashboard.hidden = true; dashboard.inert = true;
    teacherDashboard.hidden = true; teacherDashboard.inert = true;
    trainer.hidden = true; trainer.inert = true;
    $('sessionSummary').hidden = true;
    $('levelMasteryOverlay').hidden = true;
    panel(false);
  }
  if (changed) {
    $('loginPassword').value = ''; $('registerPassword').value = '';
    if (user) {
      screen.hidden=false;
      dashboard.hidden=true; dashboard.inert=true;
      teacherDashboard.hidden=true; teacherDashboard.inert=true;
      trainer.hidden=true; trainer.inert=true;
      message('loginMessage','กำลังตรวจสอบข้อมูลบัญชี...');
      Promise.resolve(routeAuthenticatedUser(sessionUser)).catch(error=>{
        console.error('SHOW AUTHENTICATED VIEW ERROR:',error);
      });
    }
  }
}
// Prevent document-level notation shortcuts while the authentication screen is open.
for (const type of ['keydown','keyup']) window.addEventListener(type, event => {
  if (screen.hidden && dashboard.hidden && teacherDashboard.hidden) return;
  if (type === 'keydown' && event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    if (event.target.tagName === 'BUTTON') event.target.click();
    else {
      const button=!$('profileOnboardingPanel')?.hidden
        ? $('profileOnboardingSaveButton')
        : !$('resetPasswordPanel').hidden
          ? $('resetPasswordButton')
          : !$('forgotPasswordPanel').hidden
            ? $('forgotPasswordButton')
            : !$('registerPanel').hidden
              ? $('registerButton')
              : $('loginButton');
      button?.click();
    }
  }
  event.stopImmediatePropagation();
}, true);
$('showRegisterButton').addEventListener('click', () => panel(true));
$('showLoginButton').addEventListener('click', () => panel(false));
$('showForgotPasswordButton').addEventListener('click', showForgotPasswordPanel);
$('showLoginFromForgotButton').addEventListener('click', () => panel(false));

async function signInWithGoogle(messageId='loginMessage'){
  if(busy || !ready) return;
  busy=true; controls();
  message(messageId,'กำลังเชื่อมต่อกับ Google...');
  try{
    const {error}=await authRepository.signInWithGoogle({redirectTo:oauthRedirectUrl()});
    if(error) throw error;
  }catch(error){
    busy=false; controls();
    message(messageId,'เข้าสู่ระบบด้วย Google ไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่'),true);
  }
}

async function sendPasswordResetEmail(){
  if(busy || !ready) return;
  const email=$('forgotEmail').value.trim();
  if(!email) return message('forgotMessage','กรุณากรอกอีเมล',true);
  if(!$('forgotEmail').checkValidity()) return message('forgotMessage','กรุณากรอกอีเมลให้ถูกต้อง',true);

  busy=true; controls();
  message('forgotMessage','กำลังส่งลิงก์ตั้งรหัสผ่านใหม่...');
  try{
    const {error}=await authRepository.resetPasswordForEmail(email,PASSWORD_RESET_REDIRECT);
    if(error) throw error;
    message('forgotMessage','หากอีเมลนี้มีบัญชี ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจสอบกล่องจดหมายและโฟลเดอร์สแปม');
  }catch(error){
    message('forgotMessage','ส่งลิงก์ไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่ภายหลัง'),true);
  }finally{
    busy=false; controls();
  }
}

async function saveRecoveredPassword(){
  if(busy || !ready) return;
  const password=$('resetPassword').value;
  const confirmPassword=$('resetPasswordConfirm').value;
  if(!password || !confirmPassword) return message('resetPasswordMessage','กรุณากรอกรหัสผ่านใหม่ให้ครบทั้งสองช่อง',true);
  if(password!==confirmPassword) return message('resetPasswordMessage','รหัสผ่านทั้งสองช่องไม่ตรงกัน',true);

  busy=true; controls();
  message('resetPasswordMessage','กำลังบันทึกรหัสผ่านใหม่...');
  try{
    const {error}=await authRepository.updatePassword(password);
    if(error) throw error;

    $('resetPassword').value='';
    $('resetPasswordConfirm').value='';
    if(window.history?.replaceState){
      window.history.replaceState({},document.title,window.location.pathname);
    }

    const {error:signOutError}=await authRepository.signOutLocal();
    if(signOutError) throw signOutError;

    passwordRecoveryMode=false;
    sessionView(null);
    panel(false);
    message('loginMessage','ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่');
  }catch(error){
    message('resetPasswordMessage','ตั้งรหัสผ่านใหม่ไม่สำเร็จ: '+(error.message || 'ลิงก์อาจหมดอายุ กรุณาขอลิงก์ใหม่'),true);
  }finally{
    busy=false; controls();
  }
}

$('forgotPasswordButton').addEventListener('click', sendPasswordResetEmail);
$('resetPasswordButton').addEventListener('click', saveRecoveredPassword);
$('cancelResetPasswordButton').addEventListener('click', async()=>{
  if(busy || !ready) return;
  busy=true; controls();
  try{
    await authRepository.signOutLocal();
  }finally{
    passwordRecoveryMode=false;
    if(window.history?.replaceState){
      window.history.replaceState({},document.title,window.location.pathname);
    }
    sessionView(null);
    panel(false);
    busy=false; controls();
  }
});

async function submit(register) {
  if (busy || !ready) return;
  const prefix = register ? 'register' : 'login';
  const email = $(prefix+'Email').value.trim(), password = $(prefix+'Password').value;
  const name = register ? $('registerName').value.trim() : '';
  if (!email || !password || (register && !name)) return message(prefix+'Message','กรุณากรอกข้อมูลให้ครบ',true);
  if (!$(prefix+'Email').checkValidity()) return message(prefix+'Message','กรุณากรอกอีเมลให้ถูกต้อง',true);
  busy = true; controls(); message(prefix+'Message', register ? 'กำลังสมัครสมาชิก...' : 'กำลังเข้าสู่ระบบ...');
  try {
    const {data, error} = register
      ? await authRepository.signUp({email,password,fullName:name})
      : await authRepository.signInWithPassword({email,password});
    if (error) throw error;
    if (data.session?.user) sessionView(data.session);
    else if (register) {
      $('registerPassword').value = ''; $('loginEmail').value = email;
      message('registerMessage','สมัครสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี จากนั้นเข้าสู่ระบบเพื่อกรอกข้อมูลโปรไฟล์ผู้เรียนให้ครบก่อนเริ่มใช้งาน');
    } else throw new Error('ยังไม่ได้รับ session กรุณาลองเข้าสู่ระบบอีกครั้ง');
  } catch (error) {
    message(prefix+'Message',(register ? 'สมัครไม่สำเร็จ: ' : 'เข้าสู่ระบบไม่สำเร็จ: ')+(error.message || 'กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่'),true);
  } finally { busy = false; controls(); }
}
$('loginButton').addEventListener('click', () => submit(false));
$('registerButton').addEventListener('click', () => submit(true));
$('dashboardLogoutButton').addEventListener('click', () => $('logoutButton').click());
$('teacherDashboardLogoutButton').addEventListener('click', () => $('logoutButton').click());
$('teacherDashboardRefreshButton').addEventListener('click', () => {
  Promise.resolve(teacherDashboardController?.refresh?.({activeUser,preferredClassId:$('teacherClassSelect')?.value || null})).catch(error=>{
    console.error('REFRESH TEACHER DASHBOARD ERROR:',error);
  });
});
$('teacherClassSelect').addEventListener('change', () => {
  const classId=$('teacherClassSelect').value;
  if(!classId) return;
  Promise.resolve(teacherDashboardController?.selectClass?.(classId)).catch(error=>{
    console.error('CHANGE TEACHER CLASS ERROR:',error);
  });
});
$('dashboardButton').addEventListener('click', () => {
  Promise.resolve(showDashboardForAuthenticatedUser({closeSession:true})).catch(error=>{
    console.error('RETURN TO DASHBOARD ERROR:',error);
  });
});
dashboard.addEventListener('click', event => {
  const button=event.target.closest('.dashboard-continue[data-exercise-code]');
  if(!button) return;
  studentDashboardController?.openExercise?.(button.dataset.exerciseCode,button.dataset.stageCode,button.dataset.sessionMode || 'practice');
});
$('logoutButton').addEventListener('click', async () => {
  if (busy || !ready) return;
  busy = true; controls();
  try {
    await closeActiveExercise();

    const {error} = await authRepository.signOutLocal();
    if (error) throw error;
    sessionView(null);
  } catch (error) { alert('ออกจากระบบไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่')); }
  finally { busy = false; controls(); }
});
async function initializeAuth() {
  ensureGoogleAuthControls();
  ensureProfileOnboardingPanel();
  controls(); message('loginMessage','กำลังตรวจสอบการเข้าสู่ระบบ...');
  try {
    if (!client || !authRepository) {
      throw app.supabaseClientError || new Error('โหลดระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า');
    }
    authRepository.onAuthStateChange((event, session) => {
      revision++;
      if(event==='PASSWORD_RECOVERY') passwordRecoveryMode=true;
      if(passwordRecoveryMode){
        if(event==='SIGNED_OUT'){
          passwordRecoveryMode=false;
          sessionView(null);
          return;
        }
        activeUser=session?.user?.id || activeUser;
        showResetPasswordPanel();
        return;
      }
      sessionView(session);
    });
    const start = revision;
    const {data,error} = await authRepository.getSession();
    if (error) throw error;
    if(passwordRecoveryMode){
      activeUser=data.session?.user?.id || activeUser;
      showResetPasswordPanel();
    }else if (start === revision){
      sessionView(data.session);
    }
    ready = true;
    if(!data.session){
      const redirectError=authRedirectErrorFromUrl();
      if(redirectError) message('loginMessage','เข้าสู่ระบบด้วย Google ไม่สำเร็จ: '+redirectError,true);
    }
  } catch (error) {
    sessionView(null);
    ready = !!client;
    message('loginMessage',error.message || 'ตรวจสอบ session ไม่สำเร็จ กรุณาลองใหม่',true);
  } finally { controls(); }
}
// Wait until the existing trainer has installed its event handlers.
document.addEventListener('DOMContentLoaded', initializeAuth, {once:true});
})();