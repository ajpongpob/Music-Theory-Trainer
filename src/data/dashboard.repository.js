(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};

function getClient() {
  if (!app.supabaseClient) {
    throw app.supabaseClientError || new Error('Supabase client is not available');
  }
  return app.supabaseClient;
}

const dashboardRepository = {
  getStudentDashboard() {
    return getClient().rpc('get_my_student_dashboard');
  },

  getStageMastery({exerciseCode, stageCode}) {
    return getClient().rpc('get_my_stage_mastery', {
      p_exercise_code: exerciseCode,
      p_stage_code: stageCode
    });
  },

  getStudentProfile(userId) {
    return getClient()
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
  },

  getActiveSkills() {
    return getClient()
      .from('skills')
      .select('code,short_name,name_th')
      .eq('active', true);
  },

  getTeacherDashboard() {
    return getClient().rpc('get_my_teacher_dashboard');
  },

  getTeacherProfile(userId) {
    return getClient()
      .from('profiles')
      .select('full_name,role')
      .eq('id', userId)
      .maybeSingle();
  },

  getTeacherClassDashboard(classId) {
    return getClient().rpc('get_my_teacher_class_dashboard', {
      p_class_id: classId
    });
  }
};

app.dashboardRepository = Object.freeze(dashboardRepository);
})();
