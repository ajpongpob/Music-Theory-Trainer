(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

function getClient() {
  if (!app.supabaseClient) {
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const masteryRepository = {
  getOptionalActiveExerciseByCode(exerciseCode) {
    return getClient()
      .from('exercises')
      .select('id')
      .eq('code', exerciseCode)
      .eq('active', true)
      .maybeSingle();
  },

  getActiveStagesForExercise(exerciseId) {
    return getClient()
      .from('exercise_stages')
      .select('id,code')
      .eq('exercise_id', exerciseId)
      .eq('active', true);
  },

  getInProgressStageProgress(userId, stageIds) {
    return getClient()
      .from('student_stage_progress')
      .select('stage_id,status')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .in('stage_id', stageIds);
  },

  getRequiredStageItems(stageId) {
    return getClient()
      .from('stage_required_items')
      .select('item_code,sequence_order')
      .eq('stage_id', stageId)
      .eq('active', true)
      .order('sequence_order', {ascending: true});
  },

  getPracticeSessionsForStage({userId, exerciseId, stageId}) {
    return getClient()
      .from('practice_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('mode', 'practice')
      .eq('exercise_id', exerciseId)
      .eq('stage_id', stageId);
  },

  getRecentAttemptItems(sessionIds, rollingWindow) {
    return getClient()
      .from('attempts')
      .select('item_code,checked_at')
      .in('practice_session_id', sessionIds)
      .not('item_code', 'is', null)
      .order('checked_at', {ascending: false})
      .limit(Number(rollingWindow));
  },

  getStageMastery({exerciseCode, stageCode}) {
    return getClient().rpc('get_my_stage_mastery', {
      p_exercise_code: exerciseCode,
      p_stage_code: stageCode
    });
  },

  advanceStageIfMastered({exerciseCode, stageCode}) {
    return getClient().rpc('advance_my_stage_if_mastered', {
      p_exercise_code: exerciseCode,
      p_stage_code: stageCode
    });
  }
};

app.masteryRepository = Object.freeze(masteryRepository);
})();
