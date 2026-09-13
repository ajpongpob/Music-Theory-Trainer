(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

function getClient() {
  if (!app.supabaseClient) {
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const PROFILE_ONBOARDING_SELECT = 'id,first_name,last_name,nickname,full_name,display_name,student_id,program,avatar_url,role,onboarding_completed_at,created_at,updated_at';
const PROFILE_NAME_SEPARATOR = '\u001f';

function decodeProfileName(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return {firstName: null, lastName: null};

  if (raw.includes(PROFILE_NAME_SEPARATOR)) {
    const [firstName, ...lastParts] = raw.split(PROFILE_NAME_SEPARATOR);
    return {
      firstName: firstName.trim() || null,
      lastName: lastParts.join(PROFILE_NAME_SEPARATOR).trim() || null
    };
  }

  const match = raw.match(/^(\S+)(?:\s+(.+))?$/u);
  return {
    firstName: match?.[1]?.trim() || raw,
    lastName: match?.[2]?.trim() || null
  };
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

  signInWithGoogle({redirectTo} = {}) {
    const options = redirectTo ? {redirectTo} : {};
    return getClient().auth.signInWithOAuth({
      provider: 'google',
      options
    });
  },

  signUp({email, password, fullName, emailRedirectTo}) {
    return getClient().auth.signUp({
      email,
      password,
      options: {
        data: {full_name: fullName},
        emailRedirectTo
      }
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

  updateRegistrationProfile({userId, fullName, displayName, studentId, program, avatarUrl}) {
    const {firstName, lastName} = decodeProfileName(fullName);
    return getClient()
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        nickname: displayName || null,
        student_id: studentId,
        program,
        avatar_url: avatarUrl
      })
      .eq('id', userId)
      .select(PROFILE_ONBOARDING_SELECT)
      .single();
  }
};

app.authRepository = Object.freeze(authRepository);

function loadI18n() {
  if (
    typeof document === 'undefined' ||
    typeof document.querySelector !== 'function' ||
    typeof document.createElement !== 'function' ||
    !document.head
  ) return;
  if (document.querySelector('script[data-major-scale-i18n]')) return;
  const script = document.createElement('script');
  script.src = './src/i18n.js?v=20260913-1';
  script.async = false;
  script.dataset.majorScaleI18n = 'true';
  document.head.appendChild(script);
}

function loadI18nUiPolish() {
  if (
    typeof document === 'undefined' ||
    typeof document.querySelector !== 'function' ||
    typeof document.createElement !== 'function' ||
    !document.head
  ) return;
  if (document.querySelector('script[data-major-scale-i18n-ui-polish]')) return;
  const script = document.createElement('script');
  script.src = './src/i18n-ui-polish.js?v=20260913-2';
  script.async = false;
  script.dataset.majorScaleI18nUiPolish = 'true';
  document.head.appendChild(script);
}

function loadSkillLabelLocalization() {
  if (
    typeof document === 'undefined' ||
    typeof document.querySelector !== 'function' ||
    typeof document.createElement !== 'function' ||
    !document.head
  ) return;
  if (document.querySelector('script[data-skill-label-localization]')) return;
  const script = document.createElement('script');
  script.src = './src/skill-label-localization.js?v=20260913-1';
  script.async = false;
  script.dataset.skillLabelLocalization = 'true';
  document.head.appendChild(script);
}

function loadUnifiedTheme() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[data-unified-theme]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './styles/unified-theme.css?v=20260913-1';
  link.dataset.unifiedTheme = 'true';
  document.head.appendChild(link);
}

function loadProfileOnboardingV2() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('script[data-profile-onboarding-v2]')) return;
  const script = document.createElement('script');
  script.src = './src/profile-onboarding-v2.js?v=20260913-profile-v2';
  script.dataset.profileOnboardingV2 = 'true';
  document.head.appendChild(script);
}

function loadNavigationDrawer() {
  if (typeof document === 'undefined' || !document.head) return;
  if (!document.querySelector('link[data-navigation-drawer-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './styles/navigation-drawer.css?v=20260913-nav-drawer';
    link.dataset.navigationDrawerStyle = 'true';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-navigation-drawer]')) {
    const script = document.createElement('script');
    script.src = './src/navigation-drawer.js?v=20260913-nav-drawer';
    script.dataset.navigationDrawer = 'true';
    document.head.appendChild(script);
  }
}

loadI18n();
loadI18nUiPolish();
loadSkillLabelLocalization();
loadUnifiedTheme();
loadProfileOnboardingV2();
loadNavigationDrawer();
})();
