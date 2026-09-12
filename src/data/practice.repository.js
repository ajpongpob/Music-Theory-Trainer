(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};
const CURRENT_APP_VERSION = app.appVersion || '0.9.3';

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
      .insert({...payload, app_version: CURRENT_APP_VERSION})
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

    if (onlyIfOpen) query = query.is('completed_at', null);
    return query;
  },

  async createAttempt(payload) {
    const client = getClient();
    if (!client.functions || typeof client.functions.invoke !== 'function') {
      return {data:null,error:new Error('Server scoring service is not available')};
    }

    const {data,error} = await client.functions.invoke('submit-major-scale-attempt', {
      body: {
        practice_session_id: payload.practice_session_id,
        question_number: payload.question_number,
        item_code: payload.item_code,
        response_json: payload.response_json
      }
    });

    if (error) return {data:null,error};
    if (!data?.attempt_id) return {data:null,error:new Error('Server scoring returned no attempt id')};

    return {
      data: {
        id: data.attempt_id,
        score: data.score,
        skill_results: data.skill_results,
        scoring_authority: data.scoring_authority
      },
      error: null
    };
  },

  createAttemptSkillResults(rows) {
    // Server scoring already persisted the trusted skill evidence atomically.
    // This compatibility method prevents the legacy Trainer from writing
    // browser-computed evidence while its orchestration is being modularized.
    return Promise.resolve({data: rows || [], error: null});
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
