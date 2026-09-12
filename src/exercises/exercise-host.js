(() => {
'use strict';
const app = window.MajorScaleApp = window.MajorScaleApp || {};
const registry = app.exerciseRegistry;
if (!registry) throw new Error('Exercise Registry must load before Exercise Host');
let current = null, opening = null, closing = null;
const unavailable = () => ({ok:false, reason:'unavailable', message:'แบบฝึกหัดนี้ยังไม่พร้อมใช้งานในเวอร์ชันปัจจุบัน'});

function launch(input = {}) {
  if (closing) return Promise.resolve({ok:false, reason:'closing'});
  if (opening) return opening;
  const code = typeof input?.exerciseCode === 'string' ? input.exerciseCode.trim().toUpperCase() : '';
  const definition = registry.get(code);
  if (!definition?.runtime) return Promise.resolve(unavailable());
  if (current) return Promise.resolve({ok:false, reason:'active', context:current.context});
  // Identity only: no client, token, arbitrary properties, or runtime state crosses this boundary.
  const context = Object.freeze({
    exerciseCode:definition.code,
    stageCode:typeof input.stageCode === 'string' ? input.stageCode.trim() : null,
    userId:typeof input.userId === 'string' ? input.userId : null
  });
  current = {definition, context};
  opening = Promise.resolve().then(async () => {
    try {
      await definition.runtime.launch(context);
      return {ok:true, context};
    } catch (error) {
      // The adapter owns rollback of its view; close reuses legacy persistence cleanup.
      try { await definition.runtime.close(context); } catch (_cleanupError) {}
      current = null;
      return {ok:false, reason:'launch-failed', message:'เปิดแบบฝึกหัดไม่สำเร็จ: '+(error.message || 'กรุณาลองใหม่')};
    } finally { opening = null; }
  });
  return opening;
}

function close() {
  if (closing) return closing;
  closing = Promise.resolve().then(async () => {
    if (opening) await opening;
    const previous = current;
    try {
      if (previous) await previous.definition.runtime.close(previous.context);
      return {ok:true};
    } catch (error) {
      return {ok:false, reason:'close-failed', message:error.message};
    } finally { current = null; closing = null; }
  });
  return closing;
}

app.exerciseHost = Object.freeze({launch, close, getCurrentContext:() => current?.context || null});
})();
