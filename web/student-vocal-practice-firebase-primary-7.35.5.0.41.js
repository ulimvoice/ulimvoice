(function (global) {
  'use strict';
  if (global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_7355041__) return;
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_7355041__ = true;

  const VERSION = '2026-08-12.735.05.0.41-vocal-firestore-primary';
  const CUTOVER_DATE = '2026-08-12';
  const roomApi = function () {
    return global.ULIM_ROOM_CLASSROOM_REALTIME_72918 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_72917 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_72916 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_72915 ||
      global.ULIM_ROOM_CLASSROOM_REALTIME_729 || null;
  };

  function text(value) { return String(value == null ? '' : value).trim(); }
  function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))); }
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
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('학생 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-vocal-7355041');
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
    const list = localSentenceList();
    return list.find(function (item) { return text(item && item.id) === wanted; }) || null;
  }
  async function getToday(options) {
    options = options || {};
    try {
      return await call('getStudentVocalPracticeToday7355041', { date: options.date || kstDateKey() });
    } catch (error) {
      throw new Error(callableError(error, '오늘의 발성훈련 정보를 불러오지 못했습니다.'));
    }
  }
  async function getTrainingSentence(options) {
    options = options || {};
    const state = await getToday({ date: options.date || kstDateKey() });
    if (state.completed) return { ok:true, status:'completed', completed:true, message:'오늘은 연습을 완료했습니다.', date:state.date, dailyLimit:state.dailyLimit };
    const raw = sentenceById(state.sentenceId);
    if (!raw) throw new Error('오늘 배정된 발성훈련 문장을 로컬 100문장 데이터에서 찾지 못했습니다.');
    return Object.assign({}, raw, {
      ok: true,
      status: 'success',
      id: text(raw.id || state.sentenceId),
      cycleKey: 'cycle-' + String(state.cycle || 1),
      firebasePracticeDate: state.date,
      firebaseDailyLimit: state.dailyLimit,
      firebaseCompletedCount: state.completedCount || 0,
      source: 'firestore-primary'
    });
  }
  async function startTrainingFromPage() {
    const calendar = document.getElementById('calendarDisplayArea');
    if (calendar) calendar.style.display = 'none';
    try { if (typeof showLoading === 'function') showLoading('오늘의 발성훈련 문장을 불러오는 중입니다...'); } catch (_ignore) {}
    try {
      const item = await getTrainingSentence({ forceRefresh:true });
      if (item.status === 'completed') {
        alert(item.message || '오늘은 연습을 완료했습니다.');
        return null;
      }
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
      if (typeof renderTrain === 'function') renderTrain();
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
      return { completed: !!state.completed, source:'firestore', data:state, message: state.completed ? '오늘은 연습을 완료했습니다.' : '' };
    } catch (error) {
      return { completed:false, source:'firestore_error', error:callableError(error) };
    }
  }
  async function beginCompletion(train) {
    return call('beginStudentVocalPracticeCompletion7355041', {
      date: text(train && train.firebasePracticeDate) || kstDateKey(),
      sentenceId: text(train && train.id)
    });
  }
  function analysisSnapshot(train) {
    let analysisText = '';
    try { if (typeof buildTrainingAiAnalysisText_ === 'function') analysisText = String(buildTrainingAiAnalysisText_(typeof recognitionResult !== 'undefined' ? recognitionResult : '') || ''); } catch (_ignore) {}
    const result = global.trainingFinalAiResult || {};
    return {
      analysisText: analysisText,
      recognizedText: (typeof recognitionResult !== 'undefined' ? recognitionResult : '') || '',
      aiSource: result.source || result.status || result.badge || '일반 분석',
      aiComment: result.generalAnalysisText || result.comment || result.analysisText || analysisText || ''
    };
  }
  function updateLocalCompletion(date, train, uploadResult, analysis) {
    try {
      if (typeof getSavedVocalIds === 'function') {
        const ids = getSavedVocalIds(); ids.add(train.id); localStorage.setItem('savedVocalIds', JSON.stringify(Array.from(ids)));
      }
      if (typeof getVocalRecords === 'function') {
        const records = getVocalRecords();
        records.set(date, { id:train.id, text:String(train.text || '').substring(0,30) + '...', completed:true, aiComment:analysis.aiComment || '', fileUrl:uploadResult && uploadResult.fileUrl || '' });
        localStorage.setItem('vocalRecords', JSON.stringify(Array.from(records.entries())));
      }
      if (typeof clearVocalTrainingClientCache_ === 'function') clearVocalTrainingClientCache_();
    } catch (_ignore) {}
  }
  async function completeTrainingFromPage() {
    const btnComplete = document.getElementById('btnComplete');
    if (typeof step !== 'undefined' && (step !== 6 || !currentTrainObj)) return alert('최종녹음 단계에서 녹음을 완료해야 연습완료가 가능합니다.');
    if (!lastRecordedBlob) return alert('녹음 파일이 없습니다. 최종녹음 단계에서 녹음 후 다시 눌러주세요.');
    const date = text(currentTrainObj.firebasePracticeDate) || kstDateKey();
    const todayState = await checkToday({ date:date });
    if (todayState.completed) return alert('오늘은 연습을 완료했습니다.');
    if (todayState.source === 'firestore_error') return alert(todayState.error || '연습 완료 여부를 확인하지 못했습니다.');

    if (!global.trainingFinalAiResult || global.trainingFinalAiResult.requestSentence !== currentTrainObj.text) {
      try { if (typeof global.renderLocalOnlyFallback571_ === 'function') await global.renderLocalOnlyFallback571_('AI 분석 없이 연습완료'); } catch (_ignore) {}
    }
    const analysis = analysisSnapshot(currentTrainObj);
    let begin;
    try { begin = await beginCompletion(currentTrainObj); }
    catch (error) { return alert(callableError(error, '연습완료 준비에 실패했습니다.')); }

    let base64Data = '';
    try {
      if (typeof showLoading === 'function') showLoading('녹음 파일을 준비하는 중입니다...');
      if (typeof blobToBase64 !== 'function') throw new Error('녹음 파일 변환 기능을 준비하지 못했습니다.');
      base64Data = await blobToBase64(lastRecordedBlob);
    } catch (error) {
      try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore2) {}
      return alert(error && error.message ? error.message : String(error));
    }

    let uploadResult = null;
    try {
      if (typeof showLoading === 'function') showLoading('녹음 파일을 보관하는 중입니다...');
      if (typeof uploadAudioToDriveAndLog !== 'function') throw new Error('녹음 보관 기능을 준비하지 못했습니다.');
      const mime = lastRecordedBlob.type || 'audio/mp4';
      uploadResult = await uploadAudioToDriveAndLog(
        currentTrainObj.id,
        String(currentTrainObj.text || '').substring(0,30) + '...',
        base64Data,
        mime,
        '녹음 파일 업로드 및 링크 기록',
        {
          mediaKind: mime.indexOf('video/') === 0 ? 'video' : 'audio',
          fileSize: lastRecordedBlob.size || 0,
          analysisText: analysis.analysisText,
          originalSentence: currentTrainObj.text || '',
          localWhisperText: analysis.recognizedText,
          aiSource: analysis.aiSource,
          aiComment: analysis.aiComment,
          firebasePracticeRecordId: begin.recordId || '',
          firebasePracticeDate: date
        }
      );
    } catch (error) {
      try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore3) {}
      return alert('녹음 파일 보관이 확인되지 않았습니다.\n\n잠시 후 다시 시도해주세요.');
    }

    try {
      if (typeof showLoading === 'function') showLoading('연습 기록을 저장하는 중입니다...');
      await call('finalizeStudentVocalPractice7355041', {
        recordId: begin.recordId,
        date: date,
        sentenceId: text(currentTrainObj.id),
        cycleKey: text(currentTrainObj.cycleKey),
        sentence: text(currentTrainObj.text),
        originalSentence: text(currentTrainObj.text),
        standardPronunciation: text(currentTrainObj.pron),
        recognizedText: analysis.recognizedText,
        aiSource: analysis.aiSource,
        aiComment: analysis.aiComment,
        analysisText: analysis.analysisText,
        fileUrl: uploadResult && (uploadResult.fileUrl || uploadResult.audioUrl) || '',
        archiveState: uploadResult && uploadResult.status === 'submitted' ? 'submitted' : 'complete',
        legacyUploadStatus: uploadResult && uploadResult.status || '',
        mimeType: lastRecordedBlob.type || 'audio/mp4',
        fileSize: lastRecordedBlob.size || 0
      });
    } catch (error) {
      try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore4) {}
      return alert(callableError(error, '녹음은 보관됐지만 연습 기록 저장을 완료하지 못했습니다. 다시 시도해주세요.'));
    }

    updateLocalCompletion(date, currentTrainObj, uploadResult, analysis);
    try { await loadMonth(new Date(date + 'T12:00:00+09:00').getFullYear(), new Date(date + 'T12:00:00+09:00').getMonth(), true); } catch (_ignore5) {}
    try { if (typeof hideLoading === 'function') hideLoading(); } catch (_ignore6) {}
    alert(uploadResult && uploadResult.status === 'submitted' ? '연습 기록이 저장되었습니다. 녹음 파일 보관은 서버에서 계속 처리됩니다.' : '연습완료! 기록이 저장되었습니다.');
    const calendar = document.getElementById('calendarDisplayArea');
    if (calendar) calendar.style.display = 'block';
    try { if (typeof renderCalendar === 'function') renderCalendar(); } catch (_ignore7) {}
    if (btnComplete) btnComplete.style.display = 'none';
    return { ok:true, recordId:begin.recordId };
  }

  function practiceKey(log) {
    return [text(log && log.practiceDate), text(log && (log.sentenceId || log.vocalId)), text(log && log.recordType)].join('|');
  }
  function isVocal(log) {
    const raw = [log && log.taskType, log && log.recordType, log && log.vocalId].map(text).join(' ');
    return !/past_question|기출|PAST_|standard_pronunciation|표준발음|PRON_/i.test(raw);
  }
  async function fetchLegacyMonth(year, monthIndex) {
    const token = legacyToken();
    if (!token || typeof GET_API_URL === 'undefined' || !GET_API_URL) return [];
    try {
      const query = new URLSearchParams();
      query.set('action', 'getStudentVocalPracticeLogs');
      query.set('studentSessionToken', token);
      query.set('year', String(year));
      query.set('month', String(Number(monthIndex) + 1));
      query.set('_', String(Date.now()));
      const response = await fetch(String(GET_API_URL) + '?' + query.toString(), { method:'GET', cache:'no-store' });
      if (!response.ok) return [];
      const data = await response.json();
      return data && data.status === 'success' && Array.isArray(data.logs) ? data.logs : [];
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
      const key = practiceKey(log);
      const legacy = merged.get(key) || {};
      merged.set(key, Object.assign({}, legacy, log, {
        sourceAuthority: 'firestore',
        teacherEvaluations: Array.isArray(log.teacherEvaluations) ? log.teacherEvaluations : legacy.teacherEvaluations,
        teacherComment: text(log.teacherComment) || text(legacy.teacherComment),
        fileUrl: text(log.fileUrl || log.audioUrl) || text(legacy.fileUrl || legacy.audioUrl || legacy.uploadUrl)
      }));
    });
    const logs = Array.from(merged.values());
    setPracticeMap(logs, Number(year), Number(monthIndex));
    try { if (typeof global.ulimRefreshPracticeUnread606 === 'function') global.ulimRefreshPracticeUnread606(); } catch (_ignore) {}
    return { status:'success', ok:true, logs:logs, count:logs.length, firestoreCount:firebaseLogs.length, legacyCount:legacyLogs.length, force:!!force };
  }

  const api = Object.freeze({
    version: VERSION,
    cutoverDate: CUTOVER_DATE,
    authSnapshot: authSnapshot,
    getToday: getToday,
    getTrainingSentence: getTrainingSentence,
    startTrainingFromPage: startTrainingFromPage,
    checkToday: checkToday,
    beginCompletion: beginCompletion,
    completeTrainingFromPage: completeTrainingFromPage,
    loadMonth: loadMonth,
    isVocal: isVocal
  });
  global.__ULIM_STUDENT_VOCAL_FIREBASE_PRIMARY_API_7355041__ = api;
})(window);
