(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_7355047__) return;
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_7355047__ = true;
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_R21A_7355042__ = true;
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_7355041__ = true;

  const VERSION = '2026-08-17.735.05.0.81-r29.9.2-standard-past-nonblocking-preupload-ctc';
  const DRIVE_FOLDER_FIRESTORE_PRIMARY_7355045 = true;
  const DRIVE_RESUMABLE_DIRECT_7355047 = false;
  const DRIVE_RESUMABLE_SERVER_PROXY_7355066 = true;
  const DRIVE_PROXY_CHUNK_BYTES_7355066 = 4 * 1024 * 1024;
  const CUTOVER_DATE = '2026-08-12';
  const CONSENT_POLICY_VERSION = '2026-08-12.ulim-voice-research-v1';
  const VAPID_KEY = 'BI6tfHhb4rc1M92JzFqVk1j2ZgwAoQDzgmUewsAtWclw5BzMasH8QZSPk-oaMkAL1I_TSGLX17PXCSHJg5pY1OU';
  const FIREBASE_CONFIG = Object.freeze({
    apiKey:'AIzaSyAW-sqtUQ_mJ6ZS_aV8pTOAKvHTSX-FXUM',
    authDomain:'ulim-7b09a.firebaseapp.com',
    projectId:'ulim-7b09a',
    storageBucket:'ulim-7b09a.firebasestorage.app',
    messagingSenderId:'364788231295',
    appId:'1:364788231295:web:b43fb49527bb6af1c6634a',
    measurementId:'G-V3FH7V87E4'
  });

  let currentResultRecordId = '';
  let currentResultDate = '';
  let messagingStarted = false;
  let localSpeechWarmStarted = false;
  let localSpeechWarmReady = false;
  let consentCache = null;
  let preferredTeacherEvaluationId7355070 = '';
  let preferredTeacherEvaluatorKey7355070 = '';

  function text(value) { return String(value == null ? '' : value).trim(); }
  function num(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : (fallback || 0); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function kstDateKey(date) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date || new Date());
    const map = {};
    parts.forEach(function (part) { if (part.type !== 'literal') map[part.type] = part.value; });
    return map.year + '-' + map.month + '-' + map.day;
  }
  function monthKey(year, monthIndex) { return String(year) + '-' + String(Number(monthIndex) + 1).padStart(2, '0'); }
  function currentStudentName() {
    try { if (typeof studentName !== 'undefined' && studentName) return String(studentName); } catch (_ignore) {}
    try { return localStorage.getItem('studentName') || ''; } catch (_ignore2) { return ''; }
  }
  function roomApi() {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72918 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_72917 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_72916 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_72915 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_729 || null;
  }
  function callableError(error, fallback) {
    const raw = text(error && error.message);
    if (/already-exists/i.test(text(error && error.code)) || /오늘은 연습을 완료했습니다/.test(raw)) return '오늘은 연습을 완료했습니다.';
    if (/failed-precondition/i.test(text(error && error.code)) && raw) return raw;
    if (!raw || /internal|deadline-exceeded|unavailable/i.test(text(error && error.code))) return fallback || '연습정보 연결이 지연되었습니다. 잠시 후 다시 시도해주세요.';
    return raw;
  }
  async function runtime() {
    const room = roomApi();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('Firebase 연습 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'practice-intelligence-7355042');
    else if (rt.sdk && typeof rt.sdk.getIdToken === 'function') await rt.sdk.getIdToken(rt.auth.currentUser, false);
    return rt;
  }
  async function call(name, payload) {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, name);
    const response = await fn(payload || {});
    return response && response.data || {};
  }
  function delay7355065(ms) { return new Promise(function(resolve){ setTimeout(resolve, Math.max(0, Number(ms) || 0)); }); }
  async function callWithTimeout7355065(name, payload, timeoutMs) {
    let timer = null;
    try {
      return await Promise.race([
        call(name, payload),
        new Promise(function(_resolve, reject){ timer=setTimeout(function(){ const error=new Error('CALL_TIMEOUT_7355065'); error.code='deadline-exceeded'; reject(error); }, Math.max(1000, Number(timeoutMs)||12000)); })
      ]);
    } finally { if (timer) clearTimeout(timer); }
  }
  function isAcceptedCompletionState7355065(status) {
    const state=text(status&&status.state),archive=text(status&&status.archiveState);
    return state==='complete'||state==='processing_archive'||['upload_received','finalize_processing','finalize_retry','complete','partial_success'].indexOf(archive)>=0;
  }
  function queueVocalCompletionRetry7355067(payload) {
    const storageKey='ulimVocalCompletionRetry7355067';
    try { localStorage.setItem(storageKey,JSON.stringify({payload:payload,savedAt:Date.now()})); } catch (_ignore7355067) {}
    let attempts=0;
    function run(){
      attempts++;
      callWithTimeout7355065('finalizeStudentVocalPractice7355041',payload,9000).then(function(result){
        if(result&&(result.accepted===true||isAcceptedCompletionState7355065(result))){
          try { localStorage.removeItem(storageKey); } catch (_ignore2) {}
          const d=new Date(String(payload.date||kstDateKey())+'T12:00:00+09:00');
          loadMonth(d.getFullYear(),d.getMonth(),true).catch(function(){});
          return;
        }
        if(attempts<6)setTimeout(run,Math.min(15000,1500*attempts));
      }).catch(function(){ if(attempts<6)setTimeout(run,Math.min(15000,1500*attempts)); });
    }
    setTimeout(run,600);
  }
  async function acceptVocalCompletion7355065(payload) {
    try {
      const result=await callWithTimeout7355065('finalizeStudentVocalPractice7355041',payload,6500);
      if(result&&(result.accepted===true||isAcceptedCompletionState7355065(result)))return result;
    } catch (_ackError7355065) {}
    try {
      const status=await callWithTimeout7355065('getStudentVocalPracticeCompletionStatus7355052',{recordId:payload.recordId,date:payload.date},2500);
      if(isAcceptedCompletionState7355065(status))return Object.assign({ok:true,accepted:true,processing:text(status.state)!=='complete'},status);
    } catch (_statusError7355065) {}
    queueVocalCompletionRetry7355067(payload);
    return {ok:true,accepted:true,processing:true,deferred:true,state:'processing_archive',archiveState:'upload_received'};
  }
  async function authSnapshot() {
    const rt = await runtime();
    return { firebaseUid:rt.auth.currentUser.uid, ownerUid:rt.auth.currentUser.uid, authenticated:true };
  }


  function prewarmLocalSpeechModel() {
    if (localSpeechWarmStarted) return;
    localSpeechWarmStarted = true;
    setTimeout(function () {
      try {
        let task = null;
        if (typeof global.getUlimWhisperPipeline_ === 'function') task = global.getUlimWhisperPipeline_(global.ULIM_LOCAL_WHISPER_MODEL || 'Xenova/whisper-tiny');
        else if (typeof getUlimWhisperPipeline_ === 'function') task = getUlimWhisperPipeline_(global.ULIM_LOCAL_WHISPER_MODEL || 'Xenova/whisper-tiny');
        if (task) Promise.resolve(task).then(function(){ localSpeechWarmReady = true; }).catch(function(){ localSpeechWarmReady = false; });
      } catch (_ignore) { localSpeechWarmReady = false; }
    }, 250);
  }
  function preloadConsentAndWarm() {
    call('getPracticeResearchConsent7355042', {}).then(function(current){
      consentCache = current || null;
      if (text(current && current.status) === 'accepted') prewarmLocalSpeechModel();
    }).catch(function(){});
  }
  async function prewarmPronunciationEngine() {
    let current = consentCache;
    if (!current) {
      try { current = await call('getPracticeResearchConsent7355042', {}); consentCache = current || null; } catch (_ignore) { return { ok:false, reason:'consent-unavailable' }; }
    }
    if (text(current && current.status) !== 'accepted') return { ok:false, reason:'consent-not-accepted' };
    prewarmLocalSpeechModel();
    try { return await call('warmPracticePronunciation7355043', {}); }
    catch (_ignore2) { return { ok:false, reason:'warm-deferred' }; }
  }


  async function getToday(options) {
    options = options || {};
    try { return await call('getStudentVocalPracticeToday7355041', { date: options.date || kstDateKey(), reroll: options.reroll === true }); }
    catch (error) { throw new Error(callableError(error, '오늘의 발성훈련 정보를 불러오지 못했습니다.')); }
  }
  async function getTrainingSentence(options) {
    options = options || {};
    const state = await getToday({ date: options.date || kstDateKey(), reroll: options.reroll === true });
    if (state.completed) return { ok:true, status:'completed', completed:true, message:'오늘은 연습을 완료했습니다.', date:state.date, dailyLimit:state.dailyLimit };
    const raw = state && state.sentence && typeof state.sentence === 'object' ? state.sentence : null;
    if (!raw || !text(raw.id || state.sentenceId) || !text(raw.text)) throw new Error('오늘의 발성훈련 문장을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.');
    return Object.assign({}, raw, {
      ok:true,
      status:'success',
      id:text(raw.id || state.sentenceId),
      sentenceSetId:text(state.sentenceSetId || raw.setId),
      cycleKey:'cycle-' + String(state.cycle || 1),
      firebasePracticeDate:state.date,
      firebaseDailyLimit:state.dailyLimit,
      firebaseCompletedCount:state.completedCount || 0,
      source:'firestore-primary'
    });
  }
  async function startTrainingFromPage() {
    const calendar = document.getElementById('calendarDisplayArea');
    if (calendar) calendar.style.display = 'none';
    try { if (typeof showLoading === 'function') showLoading('오늘의 발성훈련 문장을 불러오는 중입니다...'); } catch (_ignore) {}
    try {
      const today = kstDateKey();
      const currentDate = text(global.currentTrainObj && global.currentTrainObj.firebasePracticeDate || (typeof currentTrainObj !== 'undefined' && currentTrainObj && currentTrainObj.firebasePracticeDate) || '');
      const reroll = !!currentDate && currentDate === today;
      const item = await getTrainingSentence({ forceRefresh:true, reroll:reroll });
      if (item.status === 'completed') { alert(item.message || '오늘은 연습을 완료했습니다.'); return null; }
      if (typeof buildTrainingObjectFromSentence_ !== 'function') throw new Error('발성훈련 화면을 준비하지 못했습니다.');
      currentTrainObj = buildTrainingObjectFromSentence_(item);
      currentTrainObj.cycleKey = item.cycleKey || '';
      currentTrainObj.firebasePracticeDate = item.firebasePracticeDate || kstDateKey();
      currentTrainObj.sentenceSetId = item.sentenceSetId || '';
      step = 1;
      const prev = document.getElementById('btn_prev');
      const next = document.getElementById('btn_next');
      if (prev) prev.disabled = true;
      if (next) next.disabled = false;
      const origin = document.getElementById('train_origin');
      if (origin) origin.textContent = currentTrainObj.text || '';
      const recordBox = document.getElementById('recordBox');
      if (recordBox) recordBox.style.display = 'none';
      try { if (typeof safeSetTrainingProAudio_ === 'function') safeSetTrainingProAudio_(currentTrainObj.audio || ''); } catch (_ignore2) {}
      lastRecordedBlob = null;
      recognitionResult = '';
      global.trainingFinalAiResult = null;
      hideResultTabs();
      if (typeof renderTrain === 'function') renderTrain();
      preloadConsentAndWarm();
      return currentTrainObj;
    } catch (error) {
      alert(error && error.message ? error.message : String(error));
      return null;
    } finally {
      try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore3) {}
    }
  }
  async function checkToday(options) {
    options = options || {};
    try {
      const state = await getToday({ date: options.date || kstDateKey() });
      return { completed:!!state.completed, source:'firestore', data:state, message:state.completed ? '오늘은 연습을 완료했습니다.' : '' };
    } catch (error) {
      return { completed:false, source:'firestore_error', error:callableError(error) };
    }
  }
  async function beginCompletion(train, blob) {
    const mimeType = text(blob && blob.type || 'audio/mp4').split(';')[0] || 'audio/mp4';
    const fileSize = Number(blob && blob.size || 0);
    return call('beginStudentVocalPracticeCompletion7355041', { date:text(train && train.firebasePracticeDate) || kstDateKey(), sentenceId:text(train && train.id), sentenceSetId:text(train && train.sentenceSetId), mimeType:mimeType, fileSize:fileSize });
  }

  function consentModal() {
    let overlay = document.getElementById('ulimVoiceResearchConsent7355042');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'ulimVoiceResearchConsent7355042';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.62);display:none;align-items:center;justify-content:center;padding:18px;';
    overlay.innerHTML = '<div style="width:min(620px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:22px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.25);">'
      + '<h3 style="margin:0 0 14px;font-size:20px;line-height:1.4;">AI 모델 개선·연구를 위한 녹음 및 평가 데이터 활용 동의</h3>'
      + '<div style="font-size:14px;line-height:1.75;color:#334155;">'
      + '<p>울림의 음성·발음·발성 분석 시스템 개선 및 연구를 위해 녹음파일, 자동 분석 결과, 강사 평가 및 코멘트를 분석·학습 데이터로 활용할 수 있습니다.</p>'
      + '<p><b>해당 자료는 울림의 음성분석 및 교육 품질 개선 목적에만 사용합니다.</b> 광고·홍보물, 외부 콘텐츠 제작, 음성 복제·합성, 판매 또는 외부 배포 목적으로 사용하지 않습니다.</p>'
      + '<p>동의하지 않아도 녹음파일 업로드와 강사 평가·코멘트 기능은 이용할 수 있습니다. 동의하지 않은 경우 자동 분석 및 모델 학습 데이터에는 사용하지 않습니다.</p>'
      + '</div>'
      + '<div style="display:flex;gap:10px;margin-top:18px;">'
      + '<button type="button" data-consent="declined" style="flex:1;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:12px;font-weight:800;cursor:pointer;">동의하지 않음</button>'
      + '<button type="button" data-consent="accepted" style="flex:1;border:0;background:#2563eb;color:#fff;border-radius:12px;padding:12px;font-weight:900;cursor:pointer;">동의함</button>'
      + '</div></div>';
    document.body.appendChild(overlay);
    return overlay;
  }
  function askConsent() {
    return new Promise(function (resolve) {
      const overlay = consentModal();
      overlay.style.display = 'flex';
      const buttons = overlay.querySelectorAll('[data-consent]');
      const finish = function (decision) {
        overlay.style.display = 'none';
        buttons.forEach(function (button) { button.onclick = null; });
        resolve(decision);
      };
      buttons.forEach(function (button) { button.onclick = function () { finish(button.getAttribute('data-consent')); }; });
    });
  }
  async function ensureResearchConsent() {
    let current = consentCache;
    if (!current) {
      try { current = await call('getPracticeResearchConsent7355042', {}); consentCache = current || null; } catch (_ignore) {}
    }
    const status = text(current && current.status);
    if (status === 'accepted' || status === 'declined') {
      if (status === 'accepted') { prewarmLocalSpeechModel(); prewarmPronunciationEngine().catch(function(){}); }
      return current;
    }
    const decision = await askConsent();
    try {
      current = await call('setPracticeResearchConsent7355042', { status:decision, policyVersion:CONSENT_POLICY_VERSION });
      consentCache = current || null;
      if (decision === 'accepted') { prewarmLocalSpeechModel(); prewarmPronunciationEngine().catch(function(){}); }
      return current;
    } catch (error) {
      throw new Error(callableError(error, '데이터 활용 선택을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.'));
    }
  }

  function normalizeHangul(value) { return text(value).normalize('NFKC').replace(/[^가-힣0-9]/g, ''); }
  function editDistanceLocal(a, b) {
    a = String(a || ''); b = String(b || '');
    const prev = new Array(b.length + 1); const curr = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j += 1) prev[j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j += 1) curr[j] = Math.min(curr[j-1] + 1, prev[j] + 1, prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1));
      for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
    }
    return prev[b.length];
  }
  function matchPercent(target, heard) {
    const a = normalizeHangul(target); const b = normalizeHangul(heard);
    if (!a || !b) return null;
    return Math.round(clamp(1 - editDistanceLocal(a,b) / Math.max(a.length,b.length,1), 0, 1) * 100);
  }
  async function decodeMono(blob) {
    const AudioCtx = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtx) throw new Error('이 기기에서는 음성 분석 기능을 사용할 수 없습니다.');
    const ctx = new AudioCtx();
    try {
      const buffer = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buffer.slice(0));
      const mono = new Float32Array(decoded.length);
      for (let c = 0; c < decoded.numberOfChannels; c += 1) {
        const channel = decoded.getChannelData(c);
        for (let i = 0; i < decoded.length; i += 1) mono[i] += channel[i] / decoded.numberOfChannels;
      }
      return { samples:mono, sampleRate:decoded.sampleRate, durationSec:decoded.duration };
    } finally { try { await ctx.close(); } catch (_ignore) {} }
  }
  function acousticFeatures(decoded, sentence) {
    const samples = decoded.samples; const sampleRate = decoded.sampleRate;
    const windowSize = Math.max(256, Math.floor(sampleRate * 0.05));
    const hop = Math.max(128, Math.floor(sampleRate * 0.025));
    const rms = [];
    for (let start = 0; start + windowSize <= samples.length; start += hop) {
      let sum = 0;
      for (let i = start; i < start + windowSize; i += 1) sum += samples[i] * samples[i];
      rms.push(Math.sqrt(sum / windowSize));
    }
    const avgAll = rms.length ? rms.reduce(function(a,b){return a+b;},0) / rms.length : 0;
    const maxRms = rms.length ? Math.max.apply(null, rms) : 0;
    const silenceThreshold = Math.max(0.006, Math.min(0.035, Math.max(avgAll * 0.28, maxRms * 0.08)));
    const voiced = rms.filter(function(v){ return v > silenceThreshold; });
    const avgVoiced = voiced.length ? voiced.reduce(function(a,b){return a+b;},0) / voiced.length : 0;
    const variance = voiced.length ? voiced.reduce(function(sum,v){ const d=v-avgVoiced; return sum+d*d; },0) / voiced.length : 0;
    const std = Math.sqrt(variance);
    const cv = avgVoiced > 0 ? std / avgVoiced : 1;
    const silenceFrames = rms.filter(function(v){ return v <= silenceThreshold; }).length;
    const silenceRatio = rms.length ? silenceFrames / rms.length : 1;
    let pauseCount = 0; let run = 0; let longestRun = 0;
    const pauseFrameMin = Math.max(1, Math.round(0.25 / (hop / sampleRate)));
    rms.forEach(function(v) {
      if (v <= silenceThreshold) { run += 1; longestRun = Math.max(longestRun, run); }
      else { if (run >= pauseFrameMin) pauseCount += 1; run = 0; }
    });
    if (run >= pauseFrameMin) pauseCount += 1;
    const tailStart = Math.floor(rms.length * 0.8);
    const tail = rms.slice(tailStart).filter(function(v){ return v > silenceThreshold; });
    const tailAvg = tail.length ? tail.reduce(function(a,b){return a+b;},0) / tail.length : 0;
    const tailRatio = avgVoiced > 0 ? clamp(tailAvg / avgVoiced, 0, 1.5) : 0;
    const volumeStabilityScore = Math.round(clamp(100 - cv * 115, 0, 100));
    const breathContinuityScore = Math.round(clamp(100 - silenceRatio * 70 - pauseCount * 8 - Math.max(0, longestRun * hop / sampleRate - 0.3) * 12, 0, 100));
    const endingSustainScore = Math.round(clamp(tailRatio * 100, 0, 100));
    const soundSustainScore = Math.round(clamp(volumeStabilityScore * 0.65 + endingSustainScore * 0.35, 0, 100));
    const speechDurationSec = Math.max(0.05, decoded.durationSec * (1 - silenceRatio));
    const syllableCount = (String(sentence || '').match(/[가-힣]/g) || []).length;
    const syllablesPerSec = syllableCount ? syllableCount / speechDurationSec : 0;
    // Low-cost pitch trace for sustained-sound / intonation learning features.
    const decimate = Math.max(1, Math.round(sampleRate / 8000));
    const pitchSignal = decimate === 1 ? samples : samples.filter(function(_v,i){ return i % decimate === 0; });
    const pitchRate = sampleRate / decimate;
    const pitchWindow = Math.max(160, Math.round(pitchRate * 0.04));
    const pitchHop = Math.max(120, Math.round(pitchRate * 0.05));
    const minLag = Math.max(2, Math.floor(pitchRate / 400));
    const maxLag = Math.max(minLag + 1, Math.ceil(pitchRate / 60));
    const f0 = [];
    for (let start = 0; start + pitchWindow + maxLag < pitchSignal.length; start += pitchHop) {
      let energy = 0;
      for (let i = 0; i < pitchWindow; i += 1) { const v=pitchSignal[start+i]; energy += v*v; }
      const frameRms = Math.sqrt(energy / pitchWindow);
      if (frameRms <= silenceThreshold) continue;
      let bestLag=0, bestCorr=0;
      for (let lag=minLag; lag<=maxLag; lag+=1) {
        let xy=0, xx=0, yy=0;
        for (let i=0;i<pitchWindow;i+=1) {
          const x=pitchSignal[start+i], y=pitchSignal[start+i+lag];
          xy+=x*y; xx+=x*x; yy+=y*y;
        }
        const corr=xy/Math.sqrt(Math.max(1e-12,xx*yy));
        if(corr>bestCorr){bestCorr=corr;bestLag=lag;}
      }
      if(bestLag && bestCorr>=0.48) f0.push(pitchRate/bestLag);
    }
    const f0Mean = f0.length ? f0.reduce(function(a,b){return a+b;},0)/f0.length : 0;
    const f0Variance = f0.length ? f0.reduce(function(sum,v){const d=v-f0Mean;return sum+d*d;},0)/f0.length : 0;
    const f0Std = Math.sqrt(f0Variance);
    const f0Min = f0.length ? Math.min.apply(null,f0) : 0;
    const f0Max = f0.length ? Math.max.apply(null,f0) : 0;
    const pitchCv = f0Mean > 0 ? f0Std/f0Mean : 0;
    const pitchStabilityScore = f0.length >= 3 ? Math.round(clamp(100 - pitchCv * 180, 0, 100)) : 0;
    return {
      durationSec:Number(decoded.durationSec.toFixed(3)),
      speechDurationSec:Number(speechDurationSec.toFixed(3)),
      syllableCount:syllableCount,
      syllablesPerSec:Number(syllablesPerSec.toFixed(3)),
      averageRms:Number(avgVoiced.toFixed(6)),
      rmsStd:Number(std.toFixed(6)),
      rmsCv:Number(cv.toFixed(4)),
      silenceRatio:Number(silenceRatio.toFixed(4)),
      pauseCount:pauseCount,
      longestPauseSec:Number((longestRun * hop / sampleRate).toFixed(3)),
      tailEnergyRatio:Number(tailRatio.toFixed(4)),
      volumeStabilityScore:volumeStabilityScore,
      breathContinuityScore:breathContinuityScore,
      soundSustainScore:soundSustainScore,
      sentenceEndingSustainScore:endingSustainScore,
      f0MeanHz:Number(f0Mean.toFixed(2)),
      f0StdHz:Number(f0Std.toFixed(2)),
      f0MinHz:Number(f0Min.toFixed(2)),
      f0MaxHz:Number(f0Max.toFixed(2)),
      f0RangeHz:Number(Math.max(0,f0Max-f0Min).toFixed(2)),
      pitchCv:Number(pitchCv.toFixed(4)),
      pitchFrameCount:f0.length,
      pitchStabilityScore:pitchStabilityScore,
      analysisEngine:'client-dsp',
      analysisVersion:'acoustic-v1'
    };
  }
  async function bestEffortLocalTranscription(blob, timeoutMs) {
    try {
      if (typeof recognitionResult !== 'undefined' && text(recognitionResult)) return { text:text(recognitionResult), state:'existing-local' };
    } catch (_ignoreExisting) {}
    if (!localSpeechWarmReady) return { text:'', state:'not-warm' };
    if (!global.UlimLocalWhisper || typeof global.UlimLocalWhisper.transcribe !== 'function') return { text:'', state:'unavailable' };
    let timer = null;
    try {
      const result = await Promise.race([
        global.UlimLocalWhisper.transcribe(blob, { language:'ko', task:'transcribe', model:global.ULIM_LOCAL_WHISPER_MODEL || 'Xenova/whisper-tiny' }),
        new Promise(function(resolve){ timer = setTimeout(function(){ resolve({ __timeout:true }); }, Math.max(900, Number(timeoutMs || 2300))); })
      ]);
      if (timer) clearTimeout(timer);
      if (result && result.__timeout) return { text:'', state:'timeout' };
      return { text:text(result && result.text), state:text(result && result.text) ? 'complete' : 'empty', model:text(result && result.model) };
    } catch (_ignore) {
      if (timer) clearTimeout(timer);
      return { text:'', state:'failed' };
    }
  }
  async function analyzeForUpload(blob, sentence) {
    const decodedPromise = decodeMono(blob).then(function(decoded){ return acousticFeatures(decoded, sentence); });
    const transcriptPromise = bestEffortLocalTranscription(blob, 2400);
    const results = await Promise.all([decodedPromise, transcriptPromise]);
    const features = results[0]; const stt = results[1] || {};
    const recognized = text(stt.text);
    features.pronunciationMatchScore = matchPercent(sentence, recognized);
    features.transcriptionState = text(stt.state);
    return { features:features, recognizedText:recognized, model:text(stt.model), analysisProvider:recognized ? 'on-device-speech+client-dsp' : 'client-dsp' };
  }
  async function requestPronunciationAnalysis7355043(recordId, base64Data, mimeType, sentence, standardPronunciation) {
    if (!base64Data) return null;
    try {
      return await callWithTimeout7355065('analyzePracticePronunciation7355043', {
        recordId:text(recordId),
        audioBase64:String(base64Data || ''),
        mimeType:text(mimeType || 'audio/mp4'),
        sentence:text(sentence),
        standardPronunciation:text(standardPronunciation)
      }, 33000);
    } catch (_ignore) { return null; }
  }
  function mergePronunciationSummary7355043(analysis, scored) {
    if (!analysis) analysis = { features:{}, recognizedText:'', model:'', analysisProvider:'client-dsp' };
    if (!analysis.features) analysis.features = {};
    if (!scored || scored.ok !== true) {
      analysis.features.phonemeAnalysisState = text(scored && scored.state) || 'deferred';
      return analysis;
    }
    analysis.features.phonemeAnalysisState = 'complete';
    analysis.features.ctcPronunciationScore = num(scored.ctcPronunciationScore, 0);
    analysis.features.phonemeCount = num(scored.phonemeCount, 0);
    analysis.features.weakPhonemes = Array.isArray(scored.weakPhonemes) ? scored.weakPhonemes.slice(0, 12) : [];
    analysis.features.alignmentCoverage = num(scored.alignmentCoverage, 0);
    analysis.features.gopMethod = text(scored.gopMethod);
    analysis.features.phonemeEngineVersion = text(scored.engineVersion);
    analysis.features.expectedPhonemes = Array.isArray(scored.expectedPhonemes) ? scored.expectedPhonemes.slice(0, 60) : [];
    analysis.features.recognizedPhonemes = Array.isArray(scored.recognizedPhonemes) ? scored.recognizedPhonemes.slice(0, 60) : [];
    analysis.analysisProvider = 'on-device-whisper+client-dsp+server-ctc-gop';
    analysis.phonemeSummary = scored;
    return analysis;
  }


  function scoreRow(label, value, suffix) {
    const n = value == null || value === '' ? null : Number(value);
    const shown = Number.isFinite(n) ? Math.round(n) + (suffix || '') : '-';
    return '<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eef2f7;"><span style="color:#475569;font-weight:700;">' + escapeHtml(label) + '</span><strong style="color:#0f172a;">' + escapeHtml(shown) + '</strong></div>';
  }
  function showResultTabs(recordId, date, analysis, consent) {
    currentResultRecordId = text(recordId);
    currentResultDate = text(date);
    /*
     * R29.7.3: 발성훈련 화면 안에 별도 분석/강사코멘트 패널을 만들지 않습니다.
     * 학생이 날짜를 눌렀을 때 사용하는 canonical 연습기록 팝업 하나만 사용합니다.
     */
    try {
      if (typeof global.ulimOpenStudentPracticeRecord7355073 === 'function') {
        global.ulimOpenStudentPracticeRecord7355073(currentResultDate,currentResultRecordId,'',{
          analysisFallback:analysis || null,
          completionNow:false,
          refresh:false
        });
      }
    } catch (_ignore7355073) {}
  }

  function hideResultTabs() {
    const section = document.getElementById('aiSection');
    if (section) section.style.display = 'none';
  }
  function switchResultTab(kind) {
    const analysis = document.getElementById('practiceAnalysisPane7355042');
    const teacher = document.getElementById('practiceTeacherPane7355042');
    const aBtn = document.getElementById('practiceAnalysisTabBtn7355042');
    const tBtn = document.getElementById('practiceTeacherTabBtn7355042');
    const isTeacher = kind === 'teacher';
    if (analysis) analysis.style.display = isTeacher ? 'none' : 'block';
    if (teacher) teacher.style.display = isTeacher ? 'block' : 'none';
    if (aBtn) { aBtn.style.background = isTeacher ? '#e2e8f0' : '#2563eb'; aBtn.style.color = isTeacher ? '#334155' : '#fff'; }
    if (tBtn) { tBtn.style.background = isTeacher ? '#2563eb' : '#e2e8f0'; tBtn.style.color = isTeacher ? '#fff' : '#334155'; }
    if (isTeacher && currentResultRecordId) refreshTeacherComments(currentResultRecordId,currentResultDate,preferredTeacherEvaluationId7355070,preferredTeacherEvaluatorKey7355070).catch(function(){});
  }
  global.ulimPracticeResultTab7355042 = switchResultTab;

  function teacherEvaluationHtml(log, preferredEvaluationId, preferredEvaluatorKey) {
    const evaluations = Array.isArray(log && log.teacherEvaluations) ? log.teacherEvaluations : [];
    const preferredId = text(preferredEvaluationId || preferredTeacherEvaluationId7355070);
    const preferredKey = text(preferredEvaluatorKey || preferredTeacherEvaluatorKey7355070);
    const final = evaluations.filter(function(ev){ return ev && (text(ev.comment) || text(ev.scoreJson)); }).slice();
    final.sort(function(a,b){
      const aPreferred = (preferredId && text(a.evaluationId) === preferredId) || (preferredKey && text(a.evaluatorKey) === preferredKey);
      const bPreferred = (preferredId && text(b.evaluationId) === preferredId) || (preferredKey && text(b.evaluatorKey) === preferredKey);
      return Number(bPreferred) - Number(aPreferred);
    });
    if (!final.length) return '<div style="padding:16px;border-radius:14px;background:#f8fafc;color:#64748b;">아직 등록된 강사코멘트가 없습니다.</div>';
    const defs = [
      ['pronunciationAccuracy','발음 정확성'],['breathStability','호흡 안정성'],['soundSustain','소리 유지'],
      ['sentenceEndingSustain','문장 말미 유지'],['sentenceConnection','문장 연결'],['overall','종합']
    ];
    return final.map(function(ev){
      let scores = {};
      try { scores = typeof ev.scoreJson === 'string' ? JSON.parse(ev.scoreJson || '{}') : (ev.scores || ev.scoreJson || {}); } catch (_ignore) {}
      const rows = defs.filter(function(d){ return scores[d[0]] != null; }).map(function(d){ return scoreRow(d[1], Number(scores[d[0]]) * 20, ''); }).join('');
      const highlighted = (preferredId && text(ev.evaluationId) === preferredId) || (preferredKey && text(ev.evaluatorKey) === preferredKey);
      return '<div data-evaluation-id="' + escapeHtml(text(ev.evaluationId)) + '" style="border:' + (highlighted ? '2px solid #2563eb' : '1px solid #e2e8f0') + ';border-radius:16px;padding:14px;margin-bottom:10px;background:' + (highlighted ? '#eff6ff' : '#fff') + ';">'
        + (highlighted ? '<div style="display:inline-block;margin-bottom:8px;padding:4px 8px;border-radius:999px;background:#2563eb;color:#fff;font-size:11px;font-weight:900;">🔔 알림으로 연 평가</div>' : '')
        + '<div style="font-weight:900;margin-bottom:8px;">' + escapeHtml(ev.teacherName || '선생님') + ' 선생님</div>'
        + rows
        + (text(ev.comment) ? '<div style="margin-top:12px;padding:12px;border-radius:12px;background:#fffbeb;line-height:1.65;white-space:pre-wrap;">' + escapeHtml(ev.comment) + '</div>' : '')
        + '</div>';
    }).join('');
  }
  async function refreshTeacherComments(recordId, date, preferredEvaluationId, preferredEvaluatorKey) {
    const pane = document.getElementById('practiceTeacherPane7355042');
    if (!pane) return;
    const d = new Date((date || kstDateKey()) + 'T12:00:00+09:00');
    const data = await call('listStudentPracticeLogs7355041', { year:d.getFullYear(), month:d.getMonth() + 1 });
    const log = (Array.isArray(data.logs) ? data.logs : []).find(function(item){ return text(item.recordId) === text(recordId); });
    pane.innerHTML = teacherEvaluationHtml(log || {}, preferredEvaluationId, preferredEvaluatorKey);
    const targetId = text(preferredEvaluationId || preferredTeacherEvaluationId7355070);
    if (targetId) {
      const card = pane.querySelector('[data-evaluation-id="' + CSS.escape(targetId) + '"]');
      if (card && typeof card.scrollIntoView === 'function') setTimeout(function(){ card.scrollIntoView({block:'center',behavior:'smooth'}); }, 40);
    }
  }

  const VOCAL_PENDING_RECORD_KEY_7355072 = 'ulimVocalPendingRecord7355072';
  function updateLocalCompletion(date, train, uploadResult, analysis, recordId) {
    try {
      if (typeof getSavedVocalIds === 'function') {
        const ids = getSavedVocalIds();
        ids.add(train.id);
        localStorage.setItem('savedVocalIds', JSON.stringify(Array.from(ids)));
      }
      const features = analysis && analysis.features && typeof analysis.features === 'object'
        ? Object.assign({}, analysis.features)
        : null;
      sessionStorage.setItem(VOCAL_PENDING_RECORD_KEY_7355072, JSON.stringify({
        savedAt:Date.now(),
        date:text(date),
        record:{
          id:train.id,
          recordId:text(recordId),
          taskType:'vocal_training',
          recordType:'발성훈련',
          sentence:text(train.text),
          text:text(train.text),
          standardPronunciation:text(train.pron),
          completed:true,
          state:'processing',
          uploadState:'processing',
          analysisSummary:features,
          aiComment:'',
          fileUrl:uploadResult && uploadResult.fileUrl || ''
        }
      }));
      try { localStorage.removeItem('vocalRecords'); } catch (_ignoreLegacy7355072) {}
      if (typeof clearVocalTrainingClientCache_ === 'function') clearVocalTrainingClientCache_();
    } catch (_ignore) {}
  }
  function clearPendingVocalRecord7355072(date,recordId) {
    try {
      const raw = sessionStorage.getItem(VOCAL_PENDING_RECORD_KEY_7355072);
      if (!raw) return;
      const row = JSON.parse(raw);
      if ((!date || text(row.date) === text(date)) &&
          (!recordId || text(row.record && row.record.recordId) === text(recordId))) {
        sessionStorage.removeItem(VOCAL_PENDING_RECORD_KEY_7355072);
      }
    } catch (_ignore) {}
  }

  function globalValue(name, fallback) {
    try {
      if (name === 'studentName' && typeof studentName !== 'undefined') return studentName;
      if (name === 'studentNo' && typeof studentNo !== 'undefined') return studentNo;
      if (name === 'phoneLast4' && typeof phoneLast4 !== 'undefined') return phoneLast4;
      if (name === 'currentFilenameBase' && typeof currentFilenameBase !== 'undefined') return currentFilenameBase;
      if (name === 'instructorName' && typeof instructorName !== 'undefined') return instructorName;
    } catch (_ignore) {}
    return fallback == null ? '' : fallback;
  }
  function createArchiveRequestId7355042() {
    try { if (typeof createVocalUploadRequestId_ === 'function') return createVocalUploadRequestId_(); } catch (_ignore) {}
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return 'VOCAL_' + global.crypto.randomUUID();
    return 'VOCAL_' + Date.now() + '_' + Math.random().toString(36).slice(2,10);
  }
  function preferredArchiveExtension7355042(mime, mediaKind) {
    try { if (typeof getExtensionFromMime_ === 'function') return getExtensionFromMime_(mime, mediaKind === 'video' ? 'mp4' : 'm4a'); } catch (_ignore) {}
    if (/mp4|m4a/i.test(mime)) return 'm4a';
    if (/wav/i.test(mime)) return 'wav';
    return 'webm';
  }
  function driveUploadSessions7355047(begin) {
    return Array.isArray(begin && begin.archiveUploadSessions) ? begin.archiveUploadSessions.filter(function(item){ return item && item.sessionUrl && item.folderId; }) : [];
  }
  function blobChunkBase647355066(blob) {
    return new Promise(function(resolve, reject){
      if (!blob || !blob.size) return reject(new Error('녹음 파일 조각이 비어 있습니다.'));
      if (typeof FileReader !== 'function') return reject(new Error('이 브라우저에서 녹음 파일 전송을 지원하지 않습니다.'));
      const reader = new FileReader();
      reader.onerror = function(){ reject(new Error('녹음 파일을 읽지 못했습니다.')); };
      reader.onload = function(){
        const raw = String(reader.result || '');
        const comma = raw.indexOf(',');
        const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
        if (!base64) return reject(new Error('녹음 파일 인코딩에 실패했습니다.'));
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }
  async function uploadDriveChunkWithRetry7355066(payload) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await callWithTimeout7355065('uploadStudentPracticeDriveChunk7355066', payload, 55000);
      } catch (error) {
        lastError = error;
        const code = text(error && error.code).toLowerCase();
        const message = text(error && error.message);
        if (!/unavailable|deadline-exceeded|internal/.test(code) && !/timeout|지연|network/i.test(message)) throw error;
        if (attempt < 2) await delay7355065(700 + attempt * 900);
      }
    }
    throw lastError || new Error('Google Drive 파일 전송이 지연되었습니다.');
  }

  async function uploadOneDriveSession7355051(session, blob, copyIndex, copyCount, recordId) {
    const sessionUrl = text(session && session.sessionUrl);
    if (!/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/i.test(sessionUrl)) {
      throw new Error('녹음 보관 연결주소가 올바르지 않습니다.');
    }
    const total = Number(blob && blob.size || 0);
    if (!total) throw new Error('녹음 파일이 비어 있습니다.');
    const mime = text(blob && blob.type || session.mimeType || 'audio/mp4').split(';')[0] || 'audio/mp4';
    let offset = 0;
    let metadata = {};
    let safety = 0;
    let noProgress = 0;
    while (offset < total) {
      safety += 1;
      if (safety > 64) throw new Error('녹음 파일 전송 범위를 확인하지 못했습니다.');
      const endExclusive = Math.min(total, offset + DRIVE_PROXY_CHUNK_BYTES_7355066);
      const chunk = blob.slice(offset, endExclusive, mime);
      const base64 = await blobChunkBase647355066(chunk);
      try {
        if (typeof showLoading === 'function') {
          const copyText = copyCount > 1 ? ' · 보관 ' + copyIndex + '/' + copyCount : '';
          const percent = Math.max(1, Math.min(99, Math.round((offset / total) * 100)));
          showVocalLoading7355068('녹음 파일을 Drive로 보내는 중입니다... ' + percent + '%' + copyText, 70000);
        }
      } catch (_ignore) {}
      const result = await uploadDriveChunkWithRetry7355066({
        recordId:text(recordId),
        sessionUrl:sessionUrl,
        folderId:text(session.folderId),
        start:offset,
        total:total,
        mimeType:mime,
        chunkBase64:base64
      });
      if (result && result.complete === true) {
        metadata = result || {};
        offset = total;
        break;
      }
      const nextOffset = Number(result && result.nextOffset);
      if (!Number.isFinite(nextOffset) || nextOffset < offset || nextOffset > total) {
        throw new Error('Google Drive가 다음 업로드 위치를 반환하지 않았습니다.');
      }
      if (nextOffset === offset) {
        noProgress += 1;
        if (noProgress >= 3) throw new Error('Google Drive 업로드가 진행되지 않았습니다. 잠시 후 다시 시도해주세요.');
        await delay7355065(600 + noProgress * 500);
        continue;
      }
      noProgress = 0;
      offset = nextOffset;
    }
    const fileId = text(metadata && metadata.fileId);
    return {
      fileId:fileId,
      folderId:text(session.folderId),
      instructorUid:text(session.instructorUid),
      instructor:text(session.instructor),
      webViewLink:text(metadata && metadata.webViewLink),
      fileName:text(metadata && metadata.fileName || session.fileName),
      discoveryRequired:!fileId,
      transportState:fileId ? 'server_proxy_confirmed' : 'server_discovery'
    };
  }
  async function uploadVocalDriveResumable7355047(begin, blob) {
    const sessions = driveUploadSessions7355047(begin);
    if (!sessions.length) throw new Error('녹음 보관 연결을 준비하지 못했습니다.');
    const recordId = text(begin && begin.recordId);
    if (!recordId) throw new Error('연습 기록 식별값이 없습니다.');
    const uploads = [];
    const errors = [];
    for (let i = 0; i < sessions.length; i += 1) {
      try { uploads.push(await uploadOneDriveSession7355051(sessions[i], blob, i + 1, sessions.length, recordId)); }
      catch (error) { errors.push({ folderId:text(sessions[i].folderId), instructor:text(sessions[i].instructor), message:text(error && error.message) }); }
    }
    if (!uploads.length) throw new Error(errors[0] && errors[0].message || '녹음 파일을 보관하지 못했습니다.');
    return { ok:true, status:errors.length ? 'partial_success' : 'uploaded', driveUploads:uploads, uploadErrors:errors };
  }
  function queueIntelligenceRetry7355042(payload) {
    try { localStorage.setItem('ulimPracticeIntelligenceRetry7355042', JSON.stringify({payload:payload,savedAt:Date.now()})); } catch (_ignore) {}
    setTimeout(function(){
      call('completePracticeIntelligence7355042', payload).then(function(){ try { localStorage.removeItem('ulimPracticeIntelligenceRetry7355042'); } catch (_ignore2) {} }).catch(function(){});
    }, 1200);
  }


  let vocalLoadingWatchdog7355068 = null;
  const VOCAL_COMPLETION_PENDING_KEY_7355068 = 'ulimVocalCompletionPending7355068';

  function hardHideVocalLoading7355068() {
    if (vocalLoadingWatchdog7355068) {
      clearTimeout(vocalLoadingWatchdog7355068);
      vocalLoadingWatchdog7355068 = null;
    }
    try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore7355068) {}
    try {
      const overlay = document.getElementById('loadingOverlay');
      if (overlay) overlay.remove();
    } catch (_ignoreDom7355068) {}
  }

  function showVocalLoading7355068(message, timeoutMs) {
    hardHideVocalLoading7355068();
    try { if (typeof showLoading === 'function') showLoading(message); } catch (_ignore7355068) {}
    vocalLoadingWatchdog7355068 = setTimeout(function(){
      hardHideVocalLoading7355068();
    }, Math.max(5000, Number(timeoutMs) || 70000));
  }

  function persistVocalCompletionPending7355068(payload) {
    try {
      localStorage.setItem(VOCAL_COMPLETION_PENDING_KEY_7355068, JSON.stringify({
        payload: payload,
        savedAt: Date.now()
      }));
    } catch (_ignore7355068) {}
  }

  function clearVocalCompletionPending7355068() {
    try { localStorage.removeItem(VOCAL_COMPLETION_PENDING_KEY_7355068); } catch (_ignore7355068) {}
  }

  function submitVocalCompletionBackground7355068(payload, date, recordId) {
    persistVocalCompletionPending7355068(payload);
    Promise.resolve().then(function(){
      return acceptVocalCompletion7355065(payload);
    }).then(function(result){
      clearVocalCompletionPending7355068();
      if (result && result.deferred !== true) {
        try {
          const recStatus = document.getElementById('recStatus');
          if (recStatus && currentResultRecordId === text(recordId)) recStatus.textContent = '업로드 완료';
        } catch (_ignoreStatus7355068) {}
      }
      try {
        const refreshDate = new Date(String(date || kstDateKey()) + 'T12:00:00+09:00');
        loadMonth(refreshDate.getFullYear(), refreshDate.getMonth(), true).then(function(){
          clearPendingVocalRecord7355072(date,recordId);
          try {
            if (typeof global.ulimRefreshStudentPracticeRecord7355073 === 'function') {
              global.ulimRefreshStudentPracticeRecord7355073(date,recordId,null);
            }
          } catch (_ignorePopupRefresh7355073) {}
        }).catch(function(){});
      } catch (_ignoreRefresh7355068) {}
    }).catch(function(){
      queueVocalCompletionRetry7355067(payload);
    });
  }

  function resumeVocalCompletionPending7355068() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(VOCAL_COMPLETION_PENDING_KEY_7355068) || 'null'); } catch (_ignore7355068) {}
    const payload = saved && saved.payload && typeof saved.payload === 'object' ? saved.payload : null;
    const savedAt = Number(saved && saved.savedAt || 0);
    if (!payload || !payload.recordId) return;
    if (savedAt && Date.now() - savedAt > 24 * 60 * 60 * 1000) {
      clearVocalCompletionPending7355068();
      return;
    }
    submitVocalCompletionBackground7355068(payload, text(payload.date) || kstDateKey(), text(payload.recordId));
  }


  async function completeTrainingFromPage() {
    const btnComplete = document.getElementById('btnComplete');
    if (typeof step !== 'undefined' && (step !== 6 || !currentTrainObj)) return alert('최종녹음 단계에서 녹음을 완료해야 업로드할 수 있습니다.');
    if (!lastRecordedBlob) return alert('녹음 파일이 없습니다. 최종녹음 후 다시 눌러주세요.');

    const startedAt = Date.now();
    const date = text(currentTrainObj.firebasePracticeDate) || kstDateKey();
    const todayState = await checkToday({ date:date });
    if (todayState.completed) return alert('오늘은 연습을 완료했습니다.');
    if (todayState.source === 'firestore_error') return alert(todayState.error || '연습 완료 여부를 확인하지 못했습니다.');

    let consent;
    try {
      consent = await ensureResearchConsent();
    } catch (error) {
      hardHideVocalLoading7355068();
      return alert(error && error.message ? error.message : String(error));
    }

    const mime = text(lastRecordedBlob.type || 'audio/mp4').split(';')[0] || 'audio/mp4';
    let begin;
    try {
      showVocalLoading7355068('녹음 보관을 준비하는 중입니다...', 70000);
      begin = await beginCompletion(currentTrainObj, lastRecordedBlob);
    } catch (error) {
      hardHideVocalLoading7355068();
      return alert(callableError(error, '업로드 준비에 실패했습니다.'));
    }

    call('beginPracticeIntelligence7355042', {
      recordId:begin.recordId, taskType:'vocal_training', practiceDate:date,
      sentenceId:text(currentTrainObj.id), sentence:text(currentTrainObj.text), standardPronunciation:text(currentTrainObj.pron)
    }).catch(function(){});

    const accepted = text(consent && consent.status) === 'accepted';
    const localAnalysisPromise = accepted
      ? analyzeForUpload(lastRecordedBlob, text(currentTrainObj.text)).catch(function(){ return null; })
      : Promise.resolve(null);
    const analysisBase64Promise = accepted && typeof blobToBase64 === 'function'
      ? blobToBase64(lastRecordedBlob).catch(function(){ return ''; })
      : Promise.resolve('');
    const serverScorePromise = accepted ? analysisBase64Promise.then(function(base64Data){
      if (!base64Data) return { ok:false, state:'encoding_failed' };
      return requestPronunciationAnalysis7355043(
        begin.recordId,
        base64Data,
        mime,
        text(currentTrainObj.text),
        text(currentTrainObj.pron)
      );
    }).catch(function(){ return null; }) : Promise.resolve(null);

    let uploadResult;
    try {
      showVocalLoading7355068('녹음 파일을 보관하는 중입니다...', 70000);
      uploadResult = await uploadVocalDriveResumable7355047(begin, lastRecordedBlob);
    } catch (_uploadError) {
      hardHideVocalLoading7355068();
      const uploadMessage = text(_uploadError && _uploadError.message) || '네트워크 상태를 확인한 뒤 다시 시도해주세요.';
      return alert('녹음 파일 보관을 완료하지 못했습니다.\n\n' + uploadMessage);
    }

    /*
     * 7.35.5.0.68:
     * Google Drive 파일 전송이 성공한 순간부터 UI를 더 이상 차단하지 않는다.
     * Firestore 완료 접수/Drive 최종 링크 수렴은 아래 background path가 담당한다.
     */
    hardHideVocalLoading7355068();

    let analysis = await localAnalysisPromise;
    let serverScore = null;
    if (accepted) {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(250, 4700 - elapsed);
      serverScore = await Promise.race([
        serverScorePromise,
        new Promise(function(resolve){
          setTimeout(function(){ resolve({ ok:false, state:'processing' }); }, remaining);
        })
      ]).catch(function(){ return null; });
      analysis = mergePronunciationSummary7355043(analysis, serverScore);

      if (!serverScore || serverScore.ok !== true) {
        serverScorePromise.then(function(done){
          if (!done || done.ok !== true) return;
          if (currentResultRecordId === text(begin.recordId)) {
            const merged = mergePronunciationSummary7355043(analysis, done);
            try {
              if (typeof global.ulimRefreshStudentPracticeRecord7355073 === 'function') {
                global.ulimRefreshStudentPracticeRecord7355073(date,begin.recordId,merged);
              }
            } catch (_ignorePopupRefresh7355073) {}
          }
        }).catch(function(){});
      }
    }

    const completionPayload7355068 = {
      recordId:begin.recordId,
      date:date,
      sentenceId:text(currentTrainObj.id),
      sentenceSetId:text(currentTrainObj.sentenceSetId || begin.sentenceSetId),
      cycleKey:text(currentTrainObj.cycleKey),
      sentence:text(currentTrainObj.text),
      originalSentence:text(currentTrainObj.text),
      standardPronunciation:text(currentTrainObj.pron),
      recognizedText:analysis && analysis.recognizedText || '',
      aiSource:'',
      aiComment:'',
      analysisText:'',
      driveUploads:uploadResult.driveUploads || [],
      mimeType:mime,
      fileSize:lastRecordedBlob.size || 0
    };

    /*
     * 화면은 기다리지 않는다.
     * payload를 먼저 localStorage에 보존한 뒤 백그라운드에서 finalize를 수행한다.
     * 새로고침/페이지 종료 후에도 다음 로드에서 resumeVocalCompletionPending7355068()가 재접수한다.
     */
    submitVocalCompletionBackground7355068(
      completionPayload7355068,
      date,
      begin.recordId
    );

    const pendingUpload = {
      ok:true,
      status:'upload_received',
      processing:true,
      fileUrl:'',
      audioUrl:'',
      fileId:'',
      folderId:'',
      archiveCopies:[]
    };
    const intelligencePayload = {
      recordId:begin.recordId,
      taskType:'vocal_training',
      practiceDate:date,
      sentenceId:text(currentTrainObj.id),
      sentence:text(currentTrainObj.text),
      standardPronunciation:text(currentTrainObj.pron),
      fileUrl:'',
      fileId:'',
      folderId:'',
      archiveRequestId:'',
      mimeType:mime,
      fileSize:lastRecordedBlob.size || 0,
      consentStatus:text(consent && consent.status),
      analysis:analysis ? {
        features:analysis.features,
        recognizedText:analysis.recognizedText,
        provider:analysis.analysisProvider,
        model:analysis.model
      } : null
    };
    call('completePracticeIntelligence7355042', intelligencePayload)
      .catch(function(){ queueIntelligenceRetry7355042(intelligencePayload); });

    updateLocalCompletion(date, currentTrainObj, pendingUpload, analysis, begin.recordId);
    hardHideVocalLoading7355068();
    currentResultRecordId = text(begin.recordId);
    currentResultDate = text(date);
    try {
      if (typeof global.ulimOpenStudentPracticeRecord7355073 === 'function') {
        global.ulimOpenStudentPracticeRecord7355073(date,begin.recordId,'',{
          analysisFallback:analysis || null,
          completionNow:true,
          refresh:false
        });
      }
    } catch (_ignoreCompletionPopup7355073) {}

    const recStatus = document.getElementById('recStatus');
    if (recStatus) recStatus.textContent = '연습 완료 · 기록 반영 중';

    const calendar = document.getElementById('calendarDisplayArea');
    if (calendar) calendar.style.display = 'block';
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (_ignore4) {}
    if (btnComplete) btnComplete.style.display = 'none';

    ensurePushToken({ prompt:false }).catch(function(){});
    return { ok:true, accepted:true, processing:true, deferred:true, recordId:begin.recordId };
  }

  function practiceKey(log) { return [text(log && log.practiceDate), text(log && (log.sentenceId || log.vocalId)), text(log && log.recordType)].join('|'); }
  function isVocal(log) {
    const raw = [log && log.taskType, log && log.recordType, log && log.vocalId].map(text).join(' ');
    return !/past_question|기출|PAST_|standard_pronunciation|표준발음|PRON_/i.test(raw);
  }
  function setPracticeMap(logs, year, monthIndex) {
    const map = new Map();
    (logs || []).forEach(function (log) {
      const date = text(log && log.practiceDate);
      if (!date) return;
      if (!map.has(date)) map.set(date, []);
      map.get(date).push(log);
    });
    try { studentVocalPracticeLogMap = map; } catch (_ignore) { global.studentVocalPracticeLogMap = map; }
    try { studentVocalPracticeLoadedKey = monthKey(year, monthIndex); } catch (_ignore2) { global.studentVocalPracticeLoadedKey = monthKey(year, monthIndex); }
    return map;
  }
  async function loadMonth(year, monthIndex, force) {
    const month = Number(monthIndex) + 1;
    let firebaseData;
    try { firebaseData = await call('listStudentPracticeLogs7355041', { year:Number(year), month:month }); }
    catch (error) { throw new Error(callableError(error, '발성훈련 기록을 불러오지 못했습니다.')); }
    const firebaseLogs = Array.isArray(firebaseData.logs) ? firebaseData.logs : [];
    const logs = firebaseLogs.map(function(log){ return Object.assign({}, log, { sourceAuthority:'firestore' }); });
    setPracticeMap(logs, Number(year), Number(monthIndex));
    try { if (typeof global.ulimRefreshPracticeUnread606 === 'function') global.ulimRefreshPracticeUnread606(); } catch (_ignore) {}
    return { status:'success', ok:true, logs:logs, count:logs.length, firestoreCount:firebaseLogs.length, legacyCount:0, force:!!force, sourceAuthority:'firestore' };
  }

  function openPracticePushUrl7355070(url) {
    const target = text(url);
    if (!target) return;
    try {
      const parsed = new URL(target,global.location.href);
      if (parsed.origin !== global.location.origin) return;
      global.location.href = parsed.href;
    } catch (_ignore7355070) {}
  }
  function showForegroundPracticeNotification7355070(data) {
    try {
      if (!data || Notification.permission !== 'granted' || !text(data.url)) return;
      const note = new Notification(text(data.title) || '울림 알림',{
        body:text(data.body), icon:'/ulimvoice/appdata/logo.png', badge:'/ulimvoice/appdata/logo.png',
        tag:text(data.kind) + ':' + text(data.recordId), data:data
      });
      note.onclick = function(){ try { note.close(); } catch (_ignore) {} openPracticePushUrl7355070(data.url); };
    } catch (_ignore7355070) {}
  }
  function installPracticeServiceWorkerMessage7355070() {
    if (!navigator.serviceWorker || global.__ULIM_PRACTICE_SW_MESSAGE_7355070__) return;
    global.__ULIM_PRACTICE_SW_MESSAGE_7355070__ = true;
    navigator.serviceWorker.addEventListener('message',function(event){
      const message = event && event.data || {};
      if (message.type !== 'ULIM_PUSH_DEEP_LINK') return;
      const data = message.data || {};
      openPracticePushUrl7355070(message.url || data.url);
    });
  }

  async function ensurePushToken(option) {
    option = option || {};
    if (!('Notification' in global) || !navigator.serviceWorker) return { ok:false, reason:'unsupported' };
    let permission = Notification.permission;
    if (permission === 'default' && option.prompt === true) permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok:false, reason:permission };
    const [{ initializeApp, getApps }, { getMessaging, getToken, onMessage }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js')
    ]);
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    const registration = await navigator.serviceWorker.register('/ulimvoice/firebase-messaging-sw.js', { updateViaCache:'none' });
    await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(app), { vapidKey:VAPID_KEY, serviceWorkerRegistration:registration });
    if (!token) return { ok:false, reason:'token-empty' };
    await call('savePracticePushToken7355042', { token:token, deviceInfo:navigator.userAgent.slice(0,500) });
    try { localStorage.setItem('fcmToken', token); } catch (_ignore) {}
    if (!messagingStarted) {
      messagingStarted = true;
      onMessage(getMessaging(app), function(payload){
        const data = payload && payload.data || {};
        try {
          if (data.kind === 'practice_upload' && typeof global.adminLoadVocalPracticeLogs === 'function') global.adminLoadVocalPracticeLogs(false);
          if (data.kind === 'practice_feedback') {
            if (currentResultRecordId && (!data.recordId || data.recordId === currentResultRecordId)) {
              refreshTeacherComments(currentResultRecordId,currentResultDate,text(data.evaluationId),text(data.evaluatorKey)).catch(function(){});
            }
            const now = new Date(); loadMonth(now.getFullYear(),now.getMonth(),true).catch(function(){});
          }
          showForegroundPracticeNotification7355070(data);
        } catch (_ignore2) {}
      });
    }
    installPracticeServiceWorkerMessage7355070();
    return { ok:true };
  }
  async function promptPushToken() { return ensurePushToken({ prompt:true }); }
  global.ulimPracticeEnableNotifications7355042 = function(){ promptPushToken().then(function(r){ if(r && r.ok) alert('알림 등록이 완료되었습니다.'); else if(r && r.reason === 'denied') alert('브라우저 알림 권한이 차단되어 있습니다.'); }).catch(function(){ alert('알림 등록을 완료하지 못했습니다.'); }); };

  if (!global.__ULIM_PRACTICE_STAFF_PUSH_AUTO_7355070__) {
    global.__ULIM_PRACTICE_STAFF_PUSH_AUTO_7355070__ = true;
    global.addEventListener('ulim-firebase-auth-ready',function(event){
      const detail = event && event.detail || {};
      const role = text(detail.role).toLowerCase();
      if (['teacher','admin','superadmin'].indexOf(role) < 0) return;
      const shouldPrompt = text(detail.reason) === 'staff-login';
      setTimeout(function(){ ensurePushToken({ prompt:shouldPrompt }).catch(function(){}); },60);
    });
    installPracticeServiceWorkerMessage7355070();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded',function(){
        if (Notification.permission === 'granted') setTimeout(function(){ ensurePushToken({prompt:false}).catch(function(){}); },800);
      },{once:true});
    } else if (Notification.permission === 'granted') {
      setTimeout(function(){ ensurePushToken({prompt:false}).catch(function(){}); },800);
    }
  }


  function readPracticeFeedbackDeepLink() {
    try {
      const url = new URL(global.location.href);
      if (url.searchParams.get('open') !== 'practice-feedback') return null;
      return {
        recordId:text(url.searchParams.get('recordId')),
        date:text(url.searchParams.get('date')),
        evaluationId:text(url.searchParams.get('evaluationId')),
        evaluatorKey:text(url.searchParams.get('evaluatorKey')),
        teacherUid:text(url.searchParams.get('teacherUid'))
      };
    } catch (_ignore) { return null; }
  }
  function clearPracticeFeedbackDeepLink() {
    try {
      const url = new URL(global.location.href);
      ['open','recordId','date','evaluationId','evaluatorKey','teacherUid'].forEach(function(key){ url.searchParams.delete(key); });
      history.replaceState(history.state,'',url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (_ignore) {}
  }
  async function consumePracticeFeedbackDeepLink() {
    const link = readPracticeFeedbackDeepLink();
    if (!link || !link.recordId) return false;
    let signedIn = false;
    try { const rt = await runtime(); signedIn = !!(rt && rt.auth && rt.auth.currentUser); } catch (_ignore) {}
    if (!signedIn) return false;
    try {
      preferredTeacherEvaluationId7355070 = text(link.evaluationId);
      preferredTeacherEvaluatorKey7355070 = text(link.evaluatorKey || link.teacherUid);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(link.date) ? link.date : kstDateKey();
      const d = new Date(date + 'T12:00:00+09:00');
      const loaded = await loadMonth(d.getFullYear(),d.getMonth(),true);
      const log = (loaded && Array.isArray(loaded.logs) ? loaded.logs : []).find(function(item){ return text(item && item.recordId) === link.recordId; }) || {};
      if (!text(log.recordId)) return false;
      const evaluatorKey = text(link.evaluatorKey || link.teacherUid);
      const taskType = text(log.taskType || log.category);
      if (typeof global.activateTabById === 'function') {
        global.activateTabById(taskType === 'past_question' ? 'tab4' : taskType === 'standard_pronunciation' ? 'tabPronunciation' : 'tab3');
      }
      if (typeof global.ulimOpenStudentPracticeRecord7355072 !== 'function') return false;
      await global.ulimOpenStudentPracticeRecord7355072(date,link.recordId,evaluatorKey,{
        evaluationId:text(link.evaluationId),
        taskType:taskType,
        completionNow:false,
        refresh:false
      });
      clearPracticeFeedbackDeepLink();
      return true;
    } catch (_ignore2) { return false; }
  }
  function bootPracticeFeedbackDeepLink(attempt) {
    if (!readPracticeFeedbackDeepLink()) return;
    consumePracticeFeedbackDeepLink().then(function(done){
      if (!done && Number(attempt || 0) < 20) setTimeout(function(){ bootPracticeFeedbackDeepLink(Number(attempt || 0) + 1); }, 500);
    }).catch(function(){});
  }

  async function listStaffPracticeRecords(range, instructor, keyword) {
    range = range || {};
    return call('listPracticeRecordsForStaff7355042', {
      date:text(range.date || range.dateFrom), dateFrom:text(range.dateFrom), dateTo:text(range.dateTo), scope:text(range.scope || 'day'),
      instructor:text(instructor), keyword:text(keyword)
    });
  }
  async function saveTeacherEvaluation(input) {
    input = input || {};
    return call('savePracticeTeacherEvaluation7355042', {
      recordId:text(input.recordId), taskType:text(input.taskType), scoreJson:JSON.stringify(input.scores || {}), comment:text(input.comment), finalize:input.finalize === true
    });
  }

  function normalizeArchiveTaskType7355054(value) {
    const raw = text(value).toLowerCase().replace(/[\s-]+/g, '_');
    if (['standard_pronunciation','standard','pronunciation','pron','표준발음'].indexOf(raw) >= 0) return 'standard_pronunciation';
    if (['past_question','past','pastquestion','기출','기출문제'].indexOf(raw) >= 0) return 'past_question';
    throw new Error('지원하지 않는 연습기록 종류입니다.');
  }

  async function analyzePracticeBlob7355054(input) {
    input = input || {};
    const blob = input.blob;
    if (!blob || !Number(blob.size || 0)) throw new Error('분석할 녹음 파일이 없습니다.');
    const sentence = text(input.sentence || input.originalSentence);
    let local = null;
    try { local = await analyzeForUpload(blob, sentence); } catch (_ignore) { local = null; }
    let scored = null;
    if (input.serverScore !== false && typeof blobToBase64 === 'function') {
      try {
        const base64 = await blobToBase64(blob);
        scored = await requestPronunciationAnalysis7355043(
          text(input.recordId),
          base64,
          text(blob.type || input.mimeType || 'audio/mp4').split(';')[0],
          sentence,
          text(input.standardPronunciation)
        );
      } catch (_ignore2) { scored = null; }
    }
    return mergePronunciationSummary7355043(local, scored);
  }

  const PRACTICE_ARCHIVE_FINALIZE_RETRY_PREFIX_7355081 = 'ulimPracticeArchiveFinalizeRetry7355081::';

  function practiceArchiveFinalizeStorageKey7355081(recordId) {
    return PRACTICE_ARCHIVE_FINALIZE_RETRY_PREFIX_7355081 + text(recordId);
  }
  function transientPracticeArchiveError7355081(error) {
    const code = text(error && error.code).toLowerCase();
    const message = text(error && error.message);
    return /unavailable|deadline-exceeded|internal|unknown/.test(code) || /timeout|network|지연|temporar/i.test(message);
  }
  function queuePracticeArchiveFinalizeRetry7355081(payload) {
    const recordId = text(payload && payload.recordId);
    if (!recordId) return;
    const key = practiceArchiveFinalizeStorageKey7355081(recordId);
    try { localStorage.setItem(key, JSON.stringify({ payload:payload, savedAt:Date.now() })); } catch (_ignore) {}
    let attempts = 0;
    function retry() {
      attempts += 1;
      callWithTimeout7355065('finalizeStudentPracticeArchive7355054', payload, 9000).then(function(result){
        if (result && (result.accepted === true || result.ok === true)) {
          try { localStorage.removeItem(key); } catch (_ignore2) {}
          return;
        }
        if (attempts < 6) setTimeout(retry, Math.min(15000, 1400 * attempts));
      }).catch(function(error){
        if (!transientPracticeArchiveError7355081(error)) {
          try { localStorage.removeItem(key); } catch (_ignore3) {}
          return;
        }
        if (attempts < 6) setTimeout(retry, Math.min(15000, 1400 * attempts));
      });
    }
    setTimeout(retry, 700);
  }
  function practiceArchiveIntelligencePayload7355081(begin, common, blob, finalize, analysis) {
    return {
      recordId:text(begin && begin.recordId),
      taskType:text(common && common.taskType),
      practiceDate:text(common && common.date),
      sentenceId:text(common && common.sentenceId),
      sentence:text(common && common.sentence),
      standardPronunciation:text(common && common.standardPronunciation),
      fileUrl:text(finalize && (finalize.fileUrl || finalize.audioUrl)),
      fileId:text(finalize && finalize.fileId),
      folderId:text(finalize && finalize.folderId),
      archiveRequestId:'',
      mimeType:text(common && common.mimeType),
      fileSize:Number(blob && blob.size || 0),
      analysis:analysis ? {
        features:analysis.features || {},
        recognizedText:text(analysis.recognizedText),
        provider:text(analysis.analysisProvider),
        model:text(analysis.model)
      } : null
    };
  }
  function completePracticeIntelligenceNonBlocking7355081(payload) {
    call('completePracticeIntelligence7355042', payload)
      .catch(function(){ queueIntelligenceRetry7355042(payload); });
  }

  async function archivePracticeBlob7355054(input) {
    input = input || {};
    const blob = input.blob;
    if (!blob || !Number(blob.size || 0)) throw new Error('업로드할 녹음 파일이 없습니다.');
    if (Number(blob.size || 0) > 30 * 1024 * 1024) throw new Error('녹음 파일은 30MB 이하만 보관할 수 있습니다.');
    const taskType = normalizeArchiveTaskType7355054(input.taskType || input.recordCategory || input.category);
    const mimeType = text(blob.type || input.mimeType || 'audio/mp4').split(';')[0] || 'audio/mp4';
    const date = text(input.practiceDate || input.date) || kstDateKey();
    const sentenceId = text(input.sentenceId || input.vocalId || input.scriptId || input.questionId);
    const common = {
      taskType:taskType, date:date, practiceDate:date, recordId:text(input.recordId),
      sentenceId:sentenceId, vocalId:text(input.vocalId || sentenceId),
      scriptId:text(input.scriptId || sentenceId), questionId:text(input.questionId || sentenceId),
      sentence:text(input.sentence || input.originalSentence),
      originalSentence:text(input.originalSentence || input.sentence),
      standardPronunciation:text(input.standardPronunciation),
      scriptSource:text(input.scriptSource || input.source),
      scriptFileId:text(input.scriptFileId), scriptFileName:text(input.scriptFileName),
      gender:text(input.gender), analysisMode:text(input.analysisMode),
      mimeType:mimeType, fileSize:Number(blob.size || 0)
    };

    let begin=null, upload=null, finalize=null, finalizePayload=null;
    const suppliedAnalysis = input.analysis && typeof input.analysis === 'object' ? input.analysis : null;

    try {
      begin = await callWithTimeout7355065('beginStudentPracticeArchive7355054', common, 18000);
      upload = await uploadVocalDriveResumable7355047(begin, blob);

      // Drive 전송 완료 이후에는 UI를 절대 blocking하지 않습니다.
      hardHideVocalLoading7355068();

      finalizePayload = Object.assign({}, common, {
        recordId:text(begin.recordId),
        driveUploads:upload.driveUploads || [],
        recognizedText:text(input.recognizedText || input.localWhisperText || (suppliedAnalysis && suppliedAnalysis.recognizedText)),
        localWhisperText:text(input.localWhisperText || input.recognizedText || (suppliedAnalysis && suppliedAnalysis.recognizedText)),
        aiSource:text(input.aiSource || (suppliedAnalysis && (suppliedAnalysis.analysisProvider || suppliedAnalysis.model))),
        aiComment:text(input.aiComment || input.analysisText),
        analysisText:text(input.analysisText || input.aiComment),
        analysis:suppliedAnalysis || {}
      });

      try {
        finalize = await callWithTimeout7355065('finalizeStudentPracticeArchive7355054', finalizePayload, 9000);
      } catch (error) {
        if (!transientPracticeArchiveError7355081(error)) throw error;
        queuePracticeArchiveFinalizeRetry7355081(finalizePayload);
        finalize = {
          ok:true, accepted:true, processing:true,
          state:'processing_archive', archiveState:'finalize_retry_client',
          recordId:text(begin.recordId), taskType:taskType
        };
      }

      if (suppliedAnalysis) {
        completePracticeIntelligenceNonBlocking7355081(
          practiceArchiveIntelligencePayload7355081(begin, common, blob, finalize, suppliedAnalysis)
        );
      } else if (input.analyze === true) {
        // 기출문제는 업로드 성공을 먼저 반환합니다.
        // 학습용 local feature는 백그라운드에서 최대 4.5초만 기다린 뒤 Push/record 저장을 진행합니다.
        setTimeout(function(){
          const deferredPromise = analyzePracticeBlob7355054(Object.assign({}, input, {
            blob:blob, recordId:text(begin && begin.recordId),
            serverScore:input.serverScore === true
          })).catch(function(){ return null; });
          Promise.race([
            deferredPromise,
            new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 4500); })
          ]).then(function(deferredAnalysis){
            completePracticeIntelligenceNonBlocking7355081(
              practiceArchiveIntelligencePayload7355081(begin, common, blob, finalize, deferredAnalysis)
            );
          }).catch(function(){
            completePracticeIntelligenceNonBlocking7355081(
              practiceArchiveIntelligencePayload7355081(begin, common, blob, finalize, null)
            );
          });
        },0);
      } else {
        completePracticeIntelligenceNonBlocking7355081(
          practiceArchiveIntelligencePayload7355081(begin, common, blob, finalize, null)
        );
      }

      return Object.assign({},finalize||{},{
        ok:true, accepted:true, recordId:text(begin&&begin.recordId), taskType:taskType,
        processing:finalize&&typeof finalize.processing==='boolean'?finalize.processing:true,
        uploadErrors:upload&&upload.uploadErrors||[]
      });
    } finally {
      hardHideVocalLoading7355068();
    }
  }

  async function getRandomPastQuestion7355063(input) {
    input = input || {};
    return call('getRandomPastQuestionFirestore7355063', { gender:text(input.gender) || 'male' });
  }
  async function getPracticeContentAdminStatus7355063() {
    return call('getPracticeContentAdminStatus7355063', {});
  }
  async function refreshVocalSentenceSetAdmin7355063() {
    return call('refreshVocalSentenceSetAdmin7355063', {});
  }
  async function savePastQuestionDriveLinkAdmin7355063(driveFolderUrl) {
    return call('savePastQuestionDriveLinkAdmin7355063', { driveFolderUrl:text(driveFolderUrl) });
  }
  async function syncPastQuestionCatalogAdmin7355063() {
    return call('syncPastQuestionCatalogAdmin7355063', {});
  }

  async function markPracticeLogsViewed7355054(recordIds) {
    const ids = Array.from(new Set((Array.isArray(recordIds) ? recordIds : []).map(text).filter(Boolean))).slice(0,100);
    if (!ids.length) return { ok:true, updated:0 };
    return call('markStudentPracticeLogsViewed7355054', { recordIds:ids });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){
      bootPracticeFeedbackDeepLink(0);
      resumeVocalCompletionPending7355068();
    }, 0);
  }, { once:true });
  else setTimeout(function(){
    bootPracticeFeedbackDeepLink(0);
    resumeVocalCompletionPending7355068();
  }, 0);
  global.addEventListener('pageshow', function(){
    setTimeout(function(){
      bootPracticeFeedbackDeepLink(0);
      resumeVocalCompletionPending7355068();
    }, 0);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event){
      const data = event && event.data || {};
      if (data.type === 'ULIM_NOTIFICATION_OPEN' && data.url) global.location.assign(String(data.url));
    });
  }

  const api = Object.freeze({
    version:VERSION, cutoverDate:CUTOVER_DATE, getToday:getToday, getTrainingSentence:getTrainingSentence, startTrainingFromPage:startTrainingFromPage,
    checkToday:checkToday, beginCompletion:beginCompletion, completeTrainingFromPage:completeTrainingFromPage, loadMonth:loadMonth,
    authSnapshot:authSnapshot, ensureResearchConsent:ensureResearchConsent, prewarmPronunciationEngine:prewarmPronunciationEngine, ensurePushToken:ensurePushToken, promptPushToken:promptPushToken,
    listStaffPracticeRecords:listStaffPracticeRecords, saveTeacherEvaluation:saveTeacherEvaluation, refreshTeacherComments:refreshTeacherComments,
    archivePracticeBlob:archivePracticeBlob7355054, analyzePracticeBlob:analyzePracticeBlob7355054, markPracticeLogsViewed:markPracticeLogsViewed7355054,
    getRandomPastQuestion:getRandomPastQuestion7355063, getPracticeContentAdminStatus:getPracticeContentAdminStatus7355063, refreshVocalSentenceSetAdmin:refreshVocalSentenceSetAdmin7355063,
    savePastQuestionDriveLinkAdmin:savePastQuestionDriveLinkAdmin7355063, syncPastQuestionCatalogAdmin:syncPastQuestionCatalogAdmin7355063,
    showResultTabs:showResultTabs, hideResultTabs:hideResultTabs, consumePracticeFeedbackDeepLink:consumePracticeFeedbackDeepLink
  });
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_API_7355041__ = api;
  global.__ULIM_PRACTICE_INTELLIGENCE_API_7355042__ = api;
  global.__ULIM_PRACTICE_INTELLIGENCE_API_7355043__ = api;
})(typeof window !== 'undefined' ? window : globalThis);
