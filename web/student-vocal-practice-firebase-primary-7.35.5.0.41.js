(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_R21A_7355042__) return;
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_R21A_7355042__ = true;
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_7355041__ = true;

  const VERSION = '2026-08-12.735.05.0.43-r21a-replacement-ctc-gop-vocal';
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
  function legacyToken() {
    try { if (typeof getStudentSessionToken_ === 'function') return String(getStudentSessionToken_() || ''); } catch (_ignore) {}
    try { return localStorage.getItem('studentSessionToken') || ''; } catch (_ignore2) { return ''; }
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
    if (!raw || /internal|deadline-exceeded|unavailable/i.test(text(error && error.code))) return fallback || '연습정보 연결이 지연되었습니다. 잠시 후 다시 시도해주세요.';
    return raw;
  }
  async function runtime() {
    const room = roomApi();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('학생 Firebase 기능을 준비하지 못했습니다.');
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
  async function authSnapshot() {
    const rt = await runtime();
    return { firebaseUid: rt.auth.currentUser.uid, studentUid: rt.auth.currentUser.uid, authenticated: true };
  }
  function localSentenceList() {
    try { if (typeof vocalData !== 'undefined' && Array.isArray(vocalData)) return vocalData; } catch (_ignore) {}
    try { if (typeof trainDataList !== 'undefined' && Array.isArray(trainDataList)) return trainDataList; } catch (_ignore2) {}
    return [];
  }
  function sentenceById(id) {
    const wanted = text(id);
    return localSentenceList().find(function (item) { return text(item && item.id) === wanted; }) || null;
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
    try { return await call('getStudentVocalPracticeToday7355041', { date: options.date || kstDateKey() }); }
    catch (error) { throw new Error(callableError(error, '오늘의 발성훈련 정보를 불러오지 못했습니다.')); }
  }
  async function getTrainingSentence(options) {
    options = options || {};
    const state = await getToday({ date: options.date || kstDateKey() });
    if (state.completed) return { ok:true, status:'completed', completed:true, message:'오늘은 연습을 완료했습니다.', date:state.date, dailyLimit:state.dailyLimit };
    const raw = sentenceById(state.sentenceId);
    if (!raw) throw new Error('오늘 배정된 발성훈련 문장을 100문장 데이터에서 찾지 못했습니다.');
    return Object.assign({}, raw, {
      ok:true, status:'success', id:text(raw.id || state.sentenceId), cycleKey:'cycle-' + String(state.cycle || 1),
      firebasePracticeDate:state.date, firebaseDailyLimit:state.dailyLimit, firebaseCompletedCount:state.completedCount || 0,
      source:'firestore-primary'
    });
  }
  async function startTrainingFromPage() {
    const calendar = document.getElementById('calendarDisplayArea');
    if (calendar) calendar.style.display = 'none';
    try { if (typeof showLoading === 'function') showLoading('오늘의 발성훈련 문장을 불러오는 중입니다...'); } catch (_ignore) {}
    try {
      const item = await getTrainingSentence({ forceRefresh:true });
      if (item.status === 'completed') { alert(item.message || '오늘은 연습을 완료했습니다.'); return null; }
      if (typeof buildTrainingObjectFromSentence_ !== 'function') throw new Error('발성훈련 화면을 준비하지 못했습니다.');
      currentTrainObj = buildTrainingObjectFromSentence_(item);
      currentTrainObj.cycleKey = item.cycleKey || '';
      currentTrainObj.firebasePracticeDate = item.firebasePracticeDate || kstDateKey();
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
  setTimeout(drainDeferredPracticeWork7355042, 900);
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
  async function beginCompletion(train) {
    return call('beginStudentVocalPracticeCompletion7355041', { date:text(train && train.firebasePracticeDate) || kstDateKey(), sentenceId:text(train && train.id) });
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
    if (!recordId || !base64Data) return null;
    try {
      return await call('analyzePracticePronunciation7355043', {
        recordId:text(recordId),
        audioBase64:String(base64Data || ''),
        mimeType:text(mimeType || 'audio/mp4'),
        sentence:text(sentence),
        standardPronunciation:text(standardPronunciation)
      });
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
    const box = document.getElementById('resultBox');
    const analysisSection = document.getElementById('aiSection');
    const tabs = document.getElementById('practiceResultTabs7355042');
    const pane = document.getElementById('practiceAnalysisPane7355042');
    const aBtn = document.getElementById('practiceAnalysisTabBtn7355042');
    if (box) box.style.display = 'block';
    if (analysisSection) analysisSection.style.display = 'block';
    if (tabs) tabs.style.display = 'block';
    const accepted = !!consent && text(consent.status) === 'accepted';
    if (aBtn) aBtn.style.display = accepted ? '' : 'none';
    if (pane) {
      if (accepted && analysis) {
        const f = analysis.features || {};
        const pronunciationScore = f.ctcPronunciationScore != null && Number(f.ctcPronunciationScore) > 0 ? f.ctcPronunciationScore : f.pronunciationMatchScore;
        const weak = Array.isArray(f.weakPhonemes) ? f.weakPhonemes.filter(Boolean).slice(0, 5) : [];
        pane.innerHTML = '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:4px 14px;background:#fff;">'
          + scoreRow('발음 정확도', pronunciationScore, '점')
          + scoreRow('한 호흡 유지', f.breathContinuityScore, '점')
          + scoreRow('소리 유지', f.soundSustainScore, '점')
          + scoreRow('문장 말미 유지', f.sentenceEndingSustainScore, '점')
          + (weak.length ? '<div style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#475569;font-size:13px;"><b>다시 확인할 발음</b> ' + escapeHtml(weak.join(' · ')) + '</div>' : '')
          + '<div style="padding:10px 0;color:#64748b;font-size:12px;">발화시간 ' + escapeHtml(Number(f.durationSec || 0).toFixed(1)) + '초 · 무음비율 ' + escapeHtml(Math.round(Number(f.silenceRatio || 0) * 100)) + '% · 휴지 ' + escapeHtml(f.pauseCount || 0) + '회</div>'
          + '</div>';
      } else {
        pane.innerHTML = '';
      }
    }
    switchResultTab(accepted ? 'analysis' : 'teacher');
    refreshTeacherComments(recordId, date).catch(function(){});
  }
  function hideResultTabs() {
    const tabs = document.getElementById('practiceResultTabs7355042');
    const section = document.getElementById('aiSection');
    if (tabs) tabs.style.display = 'none';
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
    if (isTeacher && currentResultRecordId) refreshTeacherComments(currentResultRecordId, currentResultDate).catch(function(){});
  }
  global.ulimPracticeResultTab7355042 = switchResultTab;

  function teacherEvaluationHtml(log) {
    const evaluations = Array.isArray(log && log.teacherEvaluations) ? log.teacherEvaluations : [];
    const final = evaluations.filter(function(ev){ return ev && (text(ev.comment) || text(ev.scoreJson)); });
    if (!final.length) return '<div style="padding:16px;border-radius:14px;background:#f8fafc;color:#64748b;">아직 등록된 강사코멘트가 없습니다.</div>';
    const defs = [
      ['pronunciationAccuracy','발음 정확성'],['breathStability','호흡 안정성'],['soundSustain','소리 유지'],
      ['sentenceEndingSustain','문장 말미 유지'],['sentenceConnection','문장 연결'],['overall','종합']
    ];
    return final.map(function(ev){
      let scores = {};
      try { scores = typeof ev.scoreJson === 'string' ? JSON.parse(ev.scoreJson || '{}') : (ev.scores || ev.scoreJson || {}); } catch (_ignore) {}
      const rows = defs.filter(function(d){ return scores[d[0]] != null; }).map(function(d){ return scoreRow(d[1], Number(scores[d[0]]) * 20, ''); }).join('');
      return '<div style="border:1px solid #e2e8f0;border-radius:16px;padding:14px;margin-bottom:10px;">'
        + '<div style="font-weight:900;margin-bottom:8px;">' + escapeHtml(ev.teacherName || '선생님') + ' 선생님</div>'
        + rows
        + (text(ev.comment) ? '<div style="margin-top:12px;padding:12px;border-radius:12px;background:#fffbeb;line-height:1.65;white-space:pre-wrap;">' + escapeHtml(ev.comment) + '</div>' : '')
        + '</div>';
    }).join('');
  }
  async function refreshTeacherComments(recordId, date) {
    const pane = document.getElementById('practiceTeacherPane7355042');
    if (!pane) return;
    const d = new Date((date || kstDateKey()) + 'T12:00:00+09:00');
    const data = await call('listStudentPracticeLogs7355041', { year:d.getFullYear(), month:d.getMonth() + 1 });
    const log = (Array.isArray(data.logs) ? data.logs : []).find(function(item){ return text(item.recordId) === text(recordId); });
    pane.innerHTML = teacherEvaluationHtml(log || {});
  }

  function updateLocalCompletion(date, train, uploadResult) {
    try {
      if (typeof getSavedVocalIds === 'function') {
        const ids = getSavedVocalIds(); ids.add(train.id); localStorage.setItem('savedVocalIds', JSON.stringify(Array.from(ids)));
      }
      if (typeof getVocalRecords === 'function') {
        const records = getVocalRecords();
        records.set(date, { id:train.id, text:String(train.text || '').substring(0,30) + '...', completed:true, aiComment:'', fileUrl:uploadResult && uploadResult.fileUrl || '' });
        localStorage.setItem('vocalRecords', JSON.stringify(Array.from(records.entries())));
      }
      if (typeof clearVocalTrainingClientCache_ === 'function') clearVocalTrainingClientCache_();
    } catch (_ignore) {}
  }

  function globalValue(name, fallback) {
    try {
      if (name === 'studentName' && typeof studentName !== 'undefined') return studentName;
      if (name === 'studentNo' && typeof studentNo !== 'undefined') return studentNo;
      if (name === 'phoneLast4' && typeof phoneLast4 !== 'undefined') return phoneLast4;
      if (name === 'currentFilenameBase' && typeof currentFilenameBase !== 'undefined') return currentFilenameBase;
      if (name === 'instructorName' && typeof instructorName !== 'undefined') return instructorName;
      if (name === 'GOOGLE_APP_SCRIPT_URL' && typeof GOOGLE_APP_SCRIPT_URL !== 'undefined') return GOOGLE_APP_SCRIPT_URL;
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
  async function checkArchiveResult7355042(requestId, timeoutMs) {
    if (!requestId || typeof pronJsonpRequest !== 'function') return null;
    const started = Date.now();
    while (Date.now() - started < Math.max(0, Number(timeoutMs || 0))) {
      try {
        const result = await pronJsonpRequest({ action:'getVocalTrainingUploadResult', requestId:requestId, _:Date.now() }, 1800);
        if (result && result.status && result.status !== 'pending') return result;
      } catch (_ignore) {}
      await new Promise(function(resolve){ setTimeout(resolve, 650); });
    }
    return null;
  }
  async function uploadVocalDriveFast7355042(vocalId, sentenceText, base64Data, mimeType, extraMeta) {
    extraMeta = extraMeta || {};
    const uploadUrl = text(globalValue('GOOGLE_APP_SCRIPT_URL',''));
    if (!uploadUrl || uploadUrl.indexOf('script.google.com/macros/s/') < 0) throw new Error('서비스 연결이 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    const safeMime = text(mimeType || 'audio/mp4').split(';')[0] || 'audio/mp4';
    const mediaKind = safeMime.indexOf('video/') === 0 ? 'video' : 'audio';
    const requestId = createArchiveRequestId7355042();
    const payload = {
      action:'uploadVocalTrainingMedia', requestId:requestId, uploadRequestId:requestId, uploadAction:'녹음 파일 업로드 및 링크 기록',
      name:text(globalValue('studentName',currentStudentName())), studentName:text(globalValue('studentName',currentStudentName())),
      studentNo:text(globalValue('studentNo','')), phoneLast4:text(globalValue('phoneLast4','')), vocalId:text(vocalId), sentenceId:text(vocalId), sentence:text(sentenceText),
      audioData:base64Data, mimeType:safeMime, fileSize:Number(extraMeta.fileSize || 0), fileNameBase:text(globalValue('currentFilenameBase','')),
      instructor:text(globalValue('instructorName','')), mediaKind:mediaKind, analysisText:'', originalSentence:text(extraMeta.originalSentence || sentenceText),
      localWhisperText:'', aiSource:'', aiComment:'', preferredExtension:preferredArchiveExtension7355042(safeMime,mediaKind),
      contentCategory:'vocal_training', recordCategory:'vocal_training', category:'vocal_training', clientTime:new Date().toISOString(),
      studentSessionToken:legacyToken(), standardPronunciation:text(extraMeta.standardPronunciation), recognizedText:'', audioFeatureJson:'', aiAnalysisJson:'',
      firebasePracticeRecordId:text(extraMeta.recordId), firebasePracticeDate:text(extraMeta.practiceDate), researchConsent:text(extraMeta.consentStatus), dataVersion:'7355043-r21a-replacement'
    };
    await fetch(uploadUrl, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload) });
    const quick = await checkArchiveResult7355042(requestId, 2600);
    if (quick && quick.ok && quick.status === 'success' && quick.fileId) return Object.assign({}, quick, { archiveRequestId:requestId });
    if (quick && quick.status && quick.status !== 'pending' && quick.ok === false) throw new Error(quick.message || '녹음 파일 보관에 실패했습니다.');
    return { ok:true, status:'submitted', requestId:requestId, archiveRequestId:requestId, fileUrl:'', message:'보관 요청이 접수되었습니다.' };
  }
  function pendingArchiveKey7355042(recordId) { return 'ulimPracticeArchivePending7355042:' + text(recordId); }
  function savePendingArchive7355042(recordId, requestId) {
    if (!recordId || !requestId) return;
    try { localStorage.setItem(pendingArchiveKey7355042(recordId), JSON.stringify({recordId:text(recordId),requestId:text(requestId),savedAt:Date.now()})); } catch (_ignore) {}
  }
  function clearPendingArchive7355042(recordId) { try { localStorage.removeItem(pendingArchiveKey7355042(recordId)); } catch (_ignore) {} }
  async function attachResolvedArchive7355042(recordId, requestId, result) {
    if (!recordId || !result || !result.fileUrl) return false;
    const payload={ recordId:text(recordId), fileUrl:text(result.fileUrl || result.audioUrl), fileId:text(result.fileId), folderId:text(result.folderId), archiveRequestId:text(requestId) };
    const attempts=[];
    attempts.push(call('attachStudentVocalPracticeArchive7355041', { recordId:payload.recordId, fileUrl:payload.fileUrl, archiveState:'complete' }));
    attempts.push(call('attachPracticeArchive7355042', payload));
    await Promise.allSettled(attempts);
    clearPendingArchive7355042(recordId);
    return true;
  }
  async function reconcileArchive7355042(recordId, requestId, timeoutMs) {
    const result = await checkArchiveResult7355042(requestId, timeoutMs || 18000);
    if (result && result.ok && result.status === 'success' && result.fileUrl) return attachResolvedArchive7355042(recordId, requestId, result);
    return false;
  }
  function queueIntelligenceRetry7355042(payload) {
    try { localStorage.setItem('ulimPracticeIntelligenceRetry7355042', JSON.stringify({payload:payload,savedAt:Date.now()})); } catch (_ignore) {}
    setTimeout(function(){
      call('completePracticeIntelligence7355042', payload).then(function(){ try { localStorage.removeItem('ulimPracticeIntelligenceRetry7355042'); } catch (_ignore2) {} }).catch(function(){});
    }, 1200);
  }
  function drainDeferredPracticeWork7355042() {
    try {
      const raw = localStorage.getItem('ulimPracticeIntelligenceRetry7355042');
      if (raw) {
        const saved = JSON.parse(raw); const payload = saved && saved.payload;
        if (payload && payload.recordId) call('completePracticeIntelligence7355042', payload).then(function(){ localStorage.removeItem('ulimPracticeIntelligenceRetry7355042'); }).catch(function(){});
      }
      const keys=[]; for(let i=0;i<localStorage.length;i+=1){ const key=localStorage.key(i); if(key && key.indexOf('ulimPracticeArchivePending7355042:')===0) keys.push(key); }
      keys.slice(0,6).forEach(function(key){ try { const item=JSON.parse(localStorage.getItem(key)||'{}'); if(item.recordId&&item.requestId) reconcileArchive7355042(item.recordId,item.requestId,1600).catch(function(){}); } catch (_ignore3) {} });
    } catch (_ignore4) {}
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
    try { consent = await ensureResearchConsent(); }
    catch (error) { return alert(error && error.message ? error.message : String(error)); }

    let begin;
    try { begin = await beginCompletion(currentTrainObj); }
    catch (error) { return alert(callableError(error, '업로드 준비에 실패했습니다.')); }

    const intelligenceBegin = call('beginPracticeIntelligence7355042', {
      recordId:begin.recordId, taskType:'vocal_training', practiceDate:date,
      sentenceId:text(currentTrainObj.id), sentence:text(currentTrainObj.text), standardPronunciation:text(currentTrainObj.pron)
    }).catch(function(){ return null; });

    const accepted = text(consent && consent.status) === 'accepted';
    const localAnalysisPromise = accepted ? analyzeForUpload(lastRecordedBlob, text(currentTrainObj.text)).catch(function(){ return null; }) : Promise.resolve(null);

    let base64Data = '';
    try {
      if (typeof showLoading === 'function') showLoading('녹음 파일을 준비하는 중입니다...');
      if (typeof blobToBase64 !== 'function') throw new Error('녹음 파일 변환 기능을 준비하지 못했습니다.');
      base64Data = await blobToBase64(lastRecordedBlob);
    } catch (error) {
      try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore2) {}
      return alert(error && error.message ? error.message : String(error));
    }

    await intelligenceBegin;
    const mime = lastRecordedBlob.type || 'audio/mp4';
    const serverScorePromise = accepted ? requestPronunciationAnalysis7355043(
      begin.recordId, base64Data, mime, text(currentTrainObj.text), text(currentTrainObj.pron)
    ) : Promise.resolve(null);

    const uploadPromise = uploadVocalDriveFast7355042(
      currentTrainObj.id,
      String(currentTrainObj.text || '').substring(0,30) + '...',
      base64Data,
      mime,
      {
        fileSize:lastRecordedBlob.size || 0, originalSentence:currentTrainObj.text || '', standardPronunciation:text(currentTrainObj.pron),
        recordId:begin.recordId || '', practiceDate:date, consentStatus:text(consent && consent.status)
      }
    );

    let uploadResult = null;
    try {
      if (typeof showLoading === 'function') showLoading('녹음 파일을 보관하는 중입니다...');
      uploadResult = await uploadPromise;
    } catch (_uploadError) {
      try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore3) {}
      return alert('녹음 파일 보관이 확인되지 않았습니다.\n\n잠시 후 다시 시도해주세요.');
    }

    let analysis = await localAnalysisPromise;
    let serverScore = null;
    if (accepted) {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(250, 4700 - elapsed);
      serverScore = await Promise.race([
        serverScorePromise,
        new Promise(function(resolve){ setTimeout(function(){ resolve({ ok:false, state:'processing' }); }, remaining); })
      ]).catch(function(){ return null; });
      analysis = mergePronunciationSummary7355043(analysis, serverScore);
      if (!serverScore || serverScore.ok !== true) {
        serverScorePromise.then(function(done){
          if (!done || done.ok !== true) return;
          if (currentResultRecordId === text(begin.recordId)) {
            const merged = mergePronunciationSummary7355043(analysis, done);
            showResultTabs(begin.recordId, date, merged, consent);
          }
        }).catch(function(){});
      }
    }

    const archiveRequestId = text(uploadResult && (uploadResult.archiveRequestId || uploadResult.requestId));
    const intelligencePayload = {
      recordId:begin.recordId, taskType:'vocal_training', practiceDate:date, sentenceId:text(currentTrainObj.id),
      sentence:text(currentTrainObj.text), standardPronunciation:text(currentTrainObj.pron),
      fileUrl:uploadResult && (uploadResult.fileUrl || uploadResult.audioUrl) || '', fileId:text(uploadResult && uploadResult.fileId), folderId:text(uploadResult && uploadResult.folderId),
      archiveRequestId:archiveRequestId, mimeType:mime, fileSize:lastRecordedBlob.size || 0,
      consentStatus:text(consent && consent.status), analysis:analysis ? { features:analysis.features, recognizedText:analysis.recognizedText, provider:analysis.analysisProvider, model:analysis.model } : null
    };
    try {
      if (typeof showLoading === 'function') showLoading('연습 기록을 저장하는 중입니다...');
      const corePromise = call('finalizeStudentVocalPractice7355041', {
        recordId:begin.recordId, date:date, sentenceId:text(currentTrainObj.id), cycleKey:text(currentTrainObj.cycleKey),
        sentence:text(currentTrainObj.text), originalSentence:text(currentTrainObj.text), standardPronunciation:text(currentTrainObj.pron),
        recognizedText:analysis && analysis.recognizedText || '', aiSource:'', aiComment:'', analysisText:'',
        fileUrl:uploadResult && (uploadResult.fileUrl || uploadResult.audioUrl) || '',
        archiveState:uploadResult && uploadResult.status === 'submitted' ? 'submitted' : 'complete', legacyUploadStatus:uploadResult && uploadResult.status || '',
        mimeType:mime, fileSize:lastRecordedBlob.size || 0
      });
      const intelligencePromise = call('completePracticeIntelligence7355042', intelligencePayload);
      const settled = await Promise.allSettled([corePromise,intelligencePromise]);
      if (settled[0].status !== 'fulfilled') throw settled[0].reason;
      if (settled[1].status !== 'fulfilled') queueIntelligenceRetry7355042(intelligencePayload);
    } catch (error) {
      try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore4) {}
      return alert(callableError(error, '녹음은 보관됐지만 연습 기록 저장을 완료하지 못했습니다. 다시 시도해주세요.'));
    }
    if (archiveRequestId && !(uploadResult && uploadResult.fileUrl)) {
      savePendingArchive7355042(begin.recordId, archiveRequestId);
      setTimeout(function(){ reconcileArchive7355042(begin.recordId,archiveRequestId,18000).catch(function(){}); }, 400);
    }

    updateLocalCompletion(date, currentTrainObj, uploadResult);
    try { await loadMonth(new Date(date + 'T12:00:00+09:00').getFullYear(), new Date(date + 'T12:00:00+09:00').getMonth(), true); } catch (_ignore5) {}
    try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore6) {}
    showResultTabs(begin.recordId, date, analysis, consent);
    const recStatus = document.getElementById('recStatus');
    if (recStatus) recStatus.textContent = '업로드 완료';
    const calendar = document.getElementById('calendarDisplayArea');
    if (calendar) calendar.style.display = 'block';
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (_ignore7) {}
    if (btnComplete) btnComplete.style.display = 'none';
    ensurePushToken({ prompt:false }).catch(function(){});
    return { ok:true, recordId:begin.recordId };
  }

  function practiceKey(log) { return [text(log && log.practiceDate), text(log && (log.sentenceId || log.vocalId)), text(log && log.recordType)].join('|'); }
  function isVocal(log) {
    const raw = [log && log.taskType, log && log.recordType, log && log.vocalId].map(text).join(' ');
    return !/past_question|기출|PAST_|standard_pronunciation|표준발음|PRON_/i.test(raw);
  }
  async function fetchLegacyMonth(year, monthIndex) {
    const token = legacyToken();
    if (!token || typeof GET_API_URL === 'undefined' || !GET_API_URL) return [];
    try {
      const query = new URLSearchParams();
      query.set('action','getStudentVocalPracticeLogs'); query.set('studentSessionToken',token); query.set('year',String(year)); query.set('month',String(Number(monthIndex)+1)); query.set('_',Date.now());
      const response = await fetch(GET_API_URL + '?' + query.toString(), { cache:'no-store' });
      const data = await response.json();
      return data && data.status === 'success' && Array.isArray(data.logs) ? data.logs.filter(isVocal) : [];
    } catch (_ignore) { return []; }
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
    const legacyLogs = await fetchLegacyMonth(Number(year), Number(monthIndex));
    const merged = new Map();
    legacyLogs.forEach(function (log) { merged.set(practiceKey(log), Object.assign({}, log)); });
    firebaseLogs.forEach(function (log) {
      const key = practiceKey(log); const legacy = merged.get(key) || {};
      merged.set(key, Object.assign({}, legacy, log, {
        sourceAuthority:'firestore', teacherEvaluations:Array.isArray(log.teacherEvaluations) ? log.teacherEvaluations : legacy.teacherEvaluations,
        teacherComment:text(log.teacherComment) || text(legacy.teacherComment), fileUrl:text(log.fileUrl || log.audioUrl) || text(legacy.fileUrl || legacy.audioUrl || legacy.uploadUrl)
      }));
    });
    const logs = Array.from(merged.values());
    setPracticeMap(logs, Number(year), Number(monthIndex));
    try { if (typeof global.ulimRefreshPracticeUnread606 === 'function') global.ulimRefreshPracticeUnread606(); } catch (_ignore) {}
    return { status:'success', ok:true, logs:logs, count:logs.length, firestoreCount:firebaseLogs.length, legacyCount:legacyLogs.length, force:!!force };
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
            if (currentResultRecordId && (!data.recordId || data.recordId === currentResultRecordId)) refreshTeacherComments(currentResultRecordId, currentResultDate).catch(function(){});
            const now = new Date(); loadMonth(now.getFullYear(), now.getMonth(), true).catch(function(){});
          }
        } catch (_ignore2) {}
      });
    }
    return { ok:true };
  }
  async function promptPushToken() { return ensurePushToken({ prompt:true }); }
  global.ulimPracticeEnableNotifications7355042 = function(){ promptPushToken().then(function(r){ if(r && r.ok) alert('알림 등록이 완료되었습니다.'); else if(r && r.reason === 'denied') alert('브라우저 알림 권한이 차단되어 있습니다.'); }).catch(function(){ alert('알림 등록을 완료하지 못했습니다.'); }); };


  function readPracticeFeedbackDeepLink() {
    try {
      const url = new URL(global.location.href);
      if (url.searchParams.get('open') !== 'practice-feedback') return null;
      return { recordId:text(url.searchParams.get('recordId')), date:text(url.searchParams.get('date')) };
    } catch (_ignore) { return null; }
  }
  function clearPracticeFeedbackDeepLink() {
    try {
      const url = new URL(global.location.href);
      url.searchParams.delete('open'); url.searchParams.delete('recordId'); url.searchParams.delete('date');
      history.replaceState(history.state, '', url.pathname + (url.search ? url.search : '') + url.hash);
    } catch (_ignore) {}
  }
  async function consumePracticeFeedbackDeepLink() {
    const link = readPracticeFeedbackDeepLink();
    if (!link || !link.recordId) return false;
    let signedIn = false;
    try { const rt = await runtime(); signedIn = !!(rt && rt.auth && rt.auth.currentUser); } catch (_ignore) {}
    if (!signedIn) return false;
    try {
      if (typeof global.activateTabById === 'function') global.activateTabById('tab3');
      else {
        const tab = document.querySelector('.tab[data-tab="tab3"]');
        if (tab && typeof tab.click === 'function') tab.click();
      }
      const date = /^\d{4}-\d{2}-\d{2}$/.test(link.date) ? link.date : kstDateKey();
      const d = new Date(date + 'T12:00:00+09:00');
      const loaded = await loadMonth(d.getFullYear(), d.getMonth(), true);
      const log = (loaded && Array.isArray(loaded.logs) ? loaded.logs : []).find(function(item){ return text(item && item.recordId) === link.recordId; }) || {};
      const summary = log && log.analysisSummary && typeof log.analysisSummary === 'object' ? log.analysisSummary : null;
      const analysis = summary ? { features:Object.assign({}, summary) } : null;
      showResultTabs(link.recordId, date, analysis, { status:summary ? 'accepted' : 'declined' });
      switchResultTab('teacher');
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(function(){ bootPracticeFeedbackDeepLink(0); }, 0); }, { once:true });
  else setTimeout(function(){ bootPracticeFeedbackDeepLink(0); }, 0);
  global.addEventListener('pageshow', function(){ setTimeout(function(){ bootPracticeFeedbackDeepLink(0); }, 0); });

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
    showResultTabs:showResultTabs, hideResultTabs:hideResultTabs, consumePracticeFeedbackDeepLink:consumePracticeFeedbackDeepLink
  });
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_API_7355041__ = api;
  global.__ULIM_PRACTICE_INTELLIGENCE_API_7355042__ = api;
  global.__ULIM_PRACTICE_INTELLIGENCE_API_7355043__ = api;
})(typeof window !== 'undefined' ? window : globalThis);
