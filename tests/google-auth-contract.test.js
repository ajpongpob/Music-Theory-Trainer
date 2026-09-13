'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const repository=read('src/data/auth.repository.js');
const dashboard=read('src/auth-dashboard.js');

assert(repository.includes('signInWithPassword({email, password})'),'email/password login must remain available');
assert(repository.includes('signInWithGoogle({redirectTo} = {})'),'Google OAuth repository method missing');
assert(/signInWithOAuth\(\{[\s\S]*?provider:\s*['"]google['"][\s\S]*?options/.test(repository),'Google OAuth must use Supabase signInWithOAuth with options');
assert(repository.includes('resetPasswordForEmail(email, redirectTo)'),'password recovery must remain available');
assert(repository.includes('signUp({email, password, fullName, emailRedirectTo})'),'email signup must accept an explicit confirmation redirect');
assert(/auth\.signUp\(\{[\s\S]*?options:\s*\{[\s\S]*?emailRedirectTo/.test(repository),'Supabase signup must receive emailRedirectTo in options');
assert(repository.includes("signOut({scope: 'local'})"),'local sign-out behavior must remain unchanged');

assert(dashboard.includes("'googleLoginButton'"),'login Google control must participate in disabled/busy state');
assert(dashboard.includes("'googleRegisterButton'"),'register Google control must participate in disabled/busy state');
assert(dashboard.includes("label:'เข้าสู่ระบบด้วย Google'"),'Google login label missing');
assert(dashboard.includes("label:'สมัครหรือเข้าสู่ระบบด้วย Google'"),'Google registration label missing');
assert(dashboard.includes('authRepository.signInWithGoogle({redirectTo:oauthRedirectUrl()})'),'Google UI must route through auth repository with redirectTo');
assert(dashboard.includes('authRepository.signUp({email,password,fullName:name,emailRedirectTo:oauthRedirectUrl()})'),'email signup must return to the clean current app path');
assert(dashboard.includes("url.search='';") && dashboard.includes("url.hash='';"),'OAuth redirect must return to a clean app URL');
assert(dashboard.includes('authRedirectErrorFromUrl()'),'OAuth redirect errors must be surfaced to the login UI');
assert(dashboard.includes("const PASSWORD_RESET_REDIRECT = 'https://ajpongpob.github.io/Music-Theory-Trainer/?mode=reset-password';"),'password reset redirect must stay intact');

for(const source of [repository,dashboard]){
  assert(!/service[_-]?role/i.test(source),'browser auth code must never contain a service-role credential');
}

console.log('PASS Google OAuth contract: Supabase provider flow, clean redirect, UI controls, legacy password login/recovery and client-secret boundary');
