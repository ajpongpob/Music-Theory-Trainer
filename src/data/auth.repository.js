(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

function getClient() {
  if (!app.supabaseClient) {
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const authRepository = {
  getClient,

  getSession() {
    return getClient().auth.getSession();
  },

  getUser() {
    return getClient().auth.getUser();
  },

  onAuthStateChange(callback) {
    return getClient().auth.onAuthStateChange(callback);
  },

  signInWithPassword({email, password}) {
    return getClient().auth.signInWithPassword({email, password});
  },

  signUp({email, password, fullName}) {
    return getClient().auth.signUp({
      email,
      password,
      options: {data: {full_name: fullName}}
    });
  },

  signOutLocal() {
    return getClient().auth.signOut({scope: 'local'});
  },

  resetPasswordForEmail(email, redirectTo) {
    return getClient().auth.resetPasswordForEmail(email, {redirectTo});
  },

  updatePassword(password) {
    return getClient().auth.updateUser({password});
  },

  getUserRole(userId) {
    return getClient()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
  }
};

app.authRepository = Object.freeze(authRepository);
})();
