(() => {
'use strict';

const app = window.MajorScaleApp = window.MajorScaleApp || {};
const SUPABASE_URL = 'https://ptksuomvpuiesbwrzzif.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Ws7zEY3M5Pa1J9pF8-8XZQ_rBtC9X_Y';

try {
  if (!window.supabase?.createClient) {
    throw new Error('โหลดระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า');
  }

  app.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
  app.supabaseClientError = null;

  // Temporary compatibility bridge for the existing trainer.
  // This remains intentionally until the trainer data layer is modularized.
  window.majorScaleSupabase = app.supabaseClient;
} catch (error) {
  app.supabaseClient = null;
  app.supabaseClientError = error;
}
})();
