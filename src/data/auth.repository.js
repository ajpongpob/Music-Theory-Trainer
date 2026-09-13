(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

function getClient() {
  if (!app.supabaseClient) {
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const PROFILE_ONBOARDING_SELECT = 'id,full_name,display_name,student_id,program,year_level,section,avatar_url,role,onboarding_completed_at,created_at,updated_at';

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

  signInWithGoogle({redirectTo} = {}) {
    const options = redirectTo ? {redirectTo} : {};
    return getClient().auth.signInWithOAuth({
      provider: 'google',
      options
    });
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
  },

  async getRegistrationProfile(userId) {
    const result = await getClient()
      .from('profiles')
      .select(PROFILE_ONBOARDING_SELECT)
      .eq('id', userId)
      .maybeSingle();

    // Older QA fixtures and pre-onboarding profile contracts may omit the
    // column entirely. An explicit null means a real new account is incomplete;
    // a missing property means legacy data and is treated as grandfathered.
    if (result?.data && !Object.prototype.hasOwnProperty.call(result.data, 'onboarding_completed_at')) {
      return {data: {...result.data, onboarding_completed_at: 'legacy-profile'}, error: result.error || null};
    }
    return result;
  },

  updateRegistrationProfile({userId, fullName, displayName, studentId, program, yearLevel, section, avatarUrl}) {
    return getClient()
      .from('profiles')
      .update({
        full_name: fullName,
        display_name: displayName,
        student_id: studentId,
        program,
        year_level: yearLevel,
        section,
        avatar_url: avatarUrl
      })
      .eq('id', userId)
      .select(PROFILE_ONBOARDING_SELECT)
      .single();
  }
};

app.authRepository = Object.freeze(authRepository);
})();
