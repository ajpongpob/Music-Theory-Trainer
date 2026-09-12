(() => {
'use strict';

const app=window.MajorScaleApp=window.MajorScaleApp || {};

function getClient(){
  if(!app.supabaseClient){
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const learningRepository={
  ensureProgression(){
    return getClient().rpc('ensure_my_learning_path_progression');
  },

  getRecommendedNextAction(pathCode=null){
    return getClient().rpc('get_my_recommended_next_action',{
      p_path_code:pathCode || null
    });
  },

  getExerciseDiagnostic(exerciseCode){
    return getClient().rpc('get_my_exercise_diagnostic',{
      p_exercise_code:exerciseCode
    });
  },

  applyDiagnosticPlacement(exerciseCode){
    return getClient().rpc('apply_my_diagnostic_placement',{
      p_exercise_code:exerciseCode
    });
  },

  getStageEvidence({exerciseCode,stageCode,mode='practice',latestSessionOnly=false}){
    return getClient().rpc('get_my_stage_evidence',{
      p_exercise_code:exerciseCode,
      p_stage_code:stageCode,
      p_mode:mode,
      p_latest_session_only:!!latestSessionOnly
    });
  }
};

app.learningRepository=Object.freeze(learningRepository);
})();
