(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

function getClient() {
  if (!app.supabaseClient) {
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const practiceRepository = {
  getRequiredActiveExerciseByCode(exerciseCode) {
    return getClient()
      .from('exercises')
      .select('id')
      .eq('code', exerciseCode)
      .eq('active', true)
      .single();
  },

  getRequiredActiveStageByCode(exerciseId, stageCode) {
    return getClient()
      .from('exercise_stages')
      .select('id')
      .eq('exercise_id', exerciseId)
      .eq('code', stageCode)
      .eq('active', true)
      .single();
  },

  createPracticeSession(payload) {
    return getClient()
      .from('practice_sessions')
      .insert(payload)
      .select('id')
      .single();
  },

  getOpenPracticeSessions(userId) {
    return getClient()
      .from('practice_sessions')
      .select('id,started_at,last_activity_at')
      .eq('user_id', userId)
      .eq('mode', 'practice')
      .is('completed_at', null);
  },

  getOpenLearningSessions(userId) {
    return getClient()
      .from('practice_sessions')
      .select('id,started_at,last_activity_at,mode')
      .eq('user_id', userId)
      .in('mode', ['practice','pretest'])
      .is('completed_at', null);
  },

  closePracticeSession({sessionId, completedAt, onlyIfOpen = false}) {
    let query = getClient()
      .from('practice_sessions')
      .update({completed_at: completedAt})
      .eq('id', sessionId);

    if (onlyIfOpen) {
      query = query.is('completed_at', null);
    }

    return query;
  },

  createAttempt(payload) {
    return getClient()
      .from('attempts')
      .insert(payload)
      .select('id')
      .single();
  },

  createAttemptSkillResults(rows) {
    return getClient()
      .from('attempt_skill_results')
      .insert(rows);
  },

  updatePracticeSession(sessionId, updates) {
    return getClient()
      .from('practice_sessions')
      .update(updates)
      .eq('id', sessionId);
  }
};

app.practiceRepository = Object.freeze(practiceRepository);
})();
