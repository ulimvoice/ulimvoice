(function (global) {
  'use strict';
  global.__ULIM_STUDENT_COURSE_APPLICATION_FIRESTORE_ONLY_73550__ = true;
  if (global.__ULIM_STUDENT_COURSE_APPLICATION_73550__) return;
  global.__ULIM_STUDENT_COURSE_APPLICATION_73550__ = true;

  const VERSION = '2026-08-06.735.05.0.2-firestore-only';
  const TAB_ID = 'tabCourseApplication7352';
  const TAB_BUTTON_ID = 'ulimCourseApplicationTabButton7352';
  const BANNER_ID = 'ulimCourseApplicationBanner7352';
  let config = null;
  let step = 1;

  function text(value) { return String(value == null ? '' : value).trim(); }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function unique(values) { return Array.from(new Set((Array.isArray(values) ? values : []).map(text).filter(Boolean))); }
  function requestId(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2); }
  function roomRealtime() { return global.ULIM_ROOM_CLASSROOM_REALTIME_728 || global.ULIM_ROOM_CLASSROOM_REALTIME_727 || global.ULIM_ROOM_CLASSROOM_REALTIME_721 || null; }
  async function runtime() {
    const room = roomRealtime();
    if (!room || typeof room.preloadRuntime !== 'function') throw new Error('수강신청 기능을 준비하지 못했습니다.');
    const rt = await room.preloadRuntime();
    if (!rt || !rt.auth || !rt.auth.currentUser || !rt.sdk || !rt.functions) throw new Error('학생 로그인이 필요합니다.');
    if (typeof room.getStableIdToken === 'function') await room.getStableIdToken(rt, false, 'student-course-application-7352');
    return rt;
  }
  async function call(name, payload) {
    const rt = await runtime();
    const fn = rt.sdk.httpsCallable(rt.functions, name);
    const response = await fn(payload || {});
    return response && response.data || {};
  }
  function loggedIn() {
    try { if (typeof global.ulimIsStudentLoggedIn_ === 'function') return global.ulimIsStudentLoggedIn_(); } catch (_ignore) {}
    return Boolean(localStorage.getItem('studentName') && localStorage.getItem('studentSessionToken'));
  }
  function currentMonth() { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit' }).format(new Date()).slice(0,7); }

  function injectStyles() {
    if (document.getElementById('ulimCourseApplicationStyle7352')) return;
    const style = document.createElement('style');
    style.id = 'ulimCourseApplicationStyle7352';
    style.textContent = `
      #${BANNER_ID}{display:none;margin:0 0 14px;padding:14px 16px;border:1px solid #86efac;border-radius:14px;background:#f0fdf4;color:#166534;align-items:center;justify-content:space-between;gap:12px;font-weight:800}
      #${BANNER_ID} button{border:0;border-radius:10px;background:#22c55e;color:#fff;font-weight:900;padding:10px 14px;cursor:pointer}
      #${TAB_ID} .ulim-course-card{max-width:780px;margin:0 auto;background:#fff;border-radius:18px;padding:22px;box-shadow:0 4px 18px rgba(0,0,0,.06)}
      #${TAB_ID} .ulim-course-steps{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:18px}
      #${TAB_ID} .ulim-course-step{padding:8px 4px;border-radius:999px;background:#e2e8f0;color:#64748b;text-align:center;font-size:11px;font-weight:900}
      #${TAB_ID} .ulim-course-step.active{background:#22c55e;color:#fff}
      #${TAB_ID} .ulim-course-page{display:none}#${TAB_ID} .ulim-course-page.active{display:block}
      #${TAB_ID} .ulim-course-field{margin:12px 0}#${TAB_ID} label{display:block;margin-bottom:6px;font-size:13px;font-weight:900;color:#334155}
      #${TAB_ID} select,#${TAB_ID} textarea,#${TAB_ID} input{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:11px;background:#fff;font-size:14px}
      #${TAB_ID} select[multiple]{min-height:180px}#${TAB_ID} textarea{min-height:130px;resize:vertical}
      #${TAB_ID} .ulim-course-info{padding:12px;border-radius:12px;background:#f8fafc;color:#334155;line-height:1.6}
      #${TAB_ID} .ulim-course-actions{display:flex;justify-content:space-between;gap:10px;margin-top:18px}#${TAB_ID} .ulim-course-actions button{border:0;border-radius:10px;padding:12px 18px;font-weight:900;cursor:pointer;background:#64748b;color:#fff}#${TAB_ID} .ulim-course-actions button.primary{background:#22c55e}
      @media(max-width:600px){#${TAB_ID} .ulim-course-card{padding:16px}#${TAB_ID} .ulim-course-step{font-size:9px}}
    `;
    document.head.appendChild(style);
  }

  function injectUi() {
    const tabs = document.querySelector('main.wrapper .tabs');
    const wrapper = document.querySelector('main.wrapper');
    if (!tabs || !wrapper) return false;
    if (!document.getElementById(BANNER_ID)) {
      const banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.innerHTML = '<span id="ulimCourseApplicationBannerText7352"></span><button type="button" onclick="ulimOpenCourseApplication7352()">신청서 열기</button>';
      tabs.insertAdjacentElement('afterend', banner);
    }
    if (!document.getElementById(TAB_BUTTON_ID)) {
      const button = document.createElement('div');
      button.id = TAB_BUTTON_ID;
      button.className = 'tab';
      button.dataset.tab = TAB_ID;
      button.textContent = '📝 수강신청';
      button.style.display = 'none';
      button.addEventListener('click', function () { activateTab(); });
      tabs.appendChild(button);
    }
    if (!document.getElementById(TAB_ID)) {
      const panel = document.createElement('div');
      panel.id = TAB_ID;
      panel.className = 'tab-content';
      panel.innerHTML = '<div class="section"><div class="ulim-course-card" id="ulimCourseApplicationCard7352"></div></div>';
      wrapper.appendChild(panel);
    }
    return true;
  }

  function classOptions() {
    return (config && Array.isArray(config.classes) ? config.classes : []).map(function (item) {
      return '<option value="' + escapeHtml(item.classId) + '">' + escapeHtml(item.className + (item.instructorName ? ' / ' + item.instructorName : '')) + '</option>';
    }).join('');
  }

  function currentClassesText() {
    const rows = config && Array.isArray(config.currentEnrollments) ? config.currentEnrollments : [];
    return rows.length ? rows.map(function (row) { return text(row.className); }).filter(Boolean).join(', ') : '현재 연결된 반 없음';
  }

  function render() {
    const card = document.getElementById('ulimCourseApplicationCard7352');
    if (!card || !config) return;
    const existing = config.existingApplication || {};
    const decision = text(existing.registrationDecision) || 'continue';
    const selected = new Set(unique(existing.requestedClassIds));
    card.innerHTML = `
      <h2 style="margin-top:0;color:#166534;">${escapeHtml(config.title || '수강신청')}</h2>
      <div class="ulim-course-info">${escapeHtml(config.notice || '수강 등록과 반 이동 신청 내용을 확인해주세요.').replace(/\n/g,'<br>')}</div>
      <div class="ulim-course-steps">${['신청자','수강선택','건의사항','약관','최종확인'].map(function(name,index){return '<div class="ulim-course-step'+(step===index+1?' active':'')+'">'+(index+1)+'. '+name+'</div>';}).join('')}</div>
      <div class="ulim-course-page${step===1?' active':''}" data-page="1"><div class="ulim-course-field"><label>학생</label><div class="ulim-course-info">${escapeHtml(localStorage.getItem('studentName') || '')}</div></div><div class="ulim-course-field"><label>현재 수강반</label><div class="ulim-course-info">${escapeHtml(currentClassesText())}</div></div></div>
      <div class="ulim-course-page${step===2?' active':''}" data-page="2"><div class="ulim-course-field"><label>다음 달 등록 상태</label><select id="ulimCourseDecision7352"><option value="continue"${decision==='continue'?' selected':''}>현재 반 계속 수강</option><option value="class_move"${decision==='class_move'?' selected':''}>반 이동 또는 수강반 변경</option><option value="leave"${decision==='leave'?' selected':''}>휴원</option><option value="withdrawn"${decision==='withdrawn'?' selected':''}>퇴원</option></select></div><div class="ulim-course-field"><label>신청반(복수 선택 가능)</label><select id="ulimCourseClasses7352" multiple>${classOptions()}</select><div style="font-size:12px;color:#64748b;margin-top:5px;">반 이동·변경을 선택한 경우에만 신청반을 선택합니다.</div></div></div>
      <div class="ulim-course-page${step===3?' active':''}" data-page="3"><div class="ulim-course-field"><label>상담 요청 및 건의사항</label><textarea id="ulimCourseMemo7352" placeholder="전달할 내용이 없으면 비워두세요.">${escapeHtml(existing.memo || '')}</textarea></div></div>
      <div class="ulim-course-page${step===4?' active':''}" data-page="4"><label style="display:flex;gap:8px;align-items:flex-start;"><input id="ulimCourseAgree7352" type="checkbox" style="width:auto;margin-top:3px;">입력한 수강신청 내용이 학원 운영과 출석부 반영에 사용되는 것에 동의합니다.</label></div>
      <div class="ulim-course-page${step===5?' active':''}" data-page="5"><div id="ulimCourseReview7352" class="ulim-course-info"></div></div>
      <div class="ulim-course-actions"><button type="button" onclick="ulimCourseApplicationPrev7352()"${step===1?' disabled':''}>이전</button>${step<5?'<button type="button" class="primary" onclick="ulimCourseApplicationNext7352()">다음</button>':'<button type="button" class="primary" onclick="ulimCourseApplicationSubmit7352()">신청 제출</button>'}</div>
    `;
    const select = document.getElementById('ulimCourseClasses7352');
    if (select) Array.from(select.options).forEach(function(option){ option.selected = selected.has(option.value); });
    if (step === 5) updateReview();
  }

  function readState() {
    const decision = text(document.getElementById('ulimCourseDecision7352') && document.getElementById('ulimCourseDecision7352').value) || text(config && config.existingApplication && config.existingApplication.registrationDecision) || 'continue';
    const classSelect = document.getElementById('ulimCourseClasses7352');
    const requestedClassIds = classSelect ? Array.from(classSelect.selectedOptions || []).map(function(option){return option.value;}) : unique(config && config.existingApplication && config.existingApplication.requestedClassIds);
    const memo = text(document.getElementById('ulimCourseMemo7352') && document.getElementById('ulimCourseMemo7352').value) || text(config && config.existingApplication && config.existingApplication.memo);
    return { decision: decision, requestedClassIds: requestedClassIds, memo: memo };
  }

  function persistPageState() {
    config.existingApplication = Object.assign({}, config.existingApplication || {}, { registrationDecision: readState().decision, requestedClassIds: readState().requestedClassIds, memo: readState().memo });
  }

  function updateReview() {
    const state = readState();
    const labels = {continue:'현재 반 계속 수강',class_move:'반 이동 또는 수강반 변경',leave:'휴원',withdrawn:'퇴원'};
    const classNames = (config.classes || []).filter(function(item){return state.requestedClassIds.indexOf(item.classId)>=0;}).map(function(item){return item.className;});
    const el = document.getElementById('ulimCourseReview7352');
    if (el) el.innerHTML = '<b>학생</b> ' + escapeHtml(localStorage.getItem('studentName') || '') + '<br><b>신청 상태</b> ' + escapeHtml(labels[state.decision] || state.decision) + '<br><b>신청반</b> ' + escapeHtml(classNames.join(', ') || '없음') + '<br><b>건의사항</b> ' + escapeHtml(state.memo || '없음');
  }

  function next() {
    if (step === 2) {
      const state = readState();
      if (state.decision === 'class_move' && !state.requestedClassIds.length) return alert('반 이동 또는 변경 시 신청반을 선택해주세요.');
    }
    if (step === 4) {
      const agree = document.getElementById('ulimCourseAgree7352');
      if (!agree || !agree.checked) return alert('신청 내용 사용에 동의해주세요.');
    }
    persistPageState();
    step = Math.min(5, step + 1);
    render();
  }
  function prev() { persistPageState(); step = Math.max(1, step - 1); render(); }

  async function submit() {
    const state = readState();
    if (!confirm('표시된 내용으로 수강신청을 제출할까요?')) return;
    try {
      if (typeof global.showLoading === 'function') global.showLoading('수강신청 제출 중...');
      const result = await call('submitStudentCourseApplication7352', { month: config.month, registrationDecision: state.decision, requestedClassIds: state.requestedClassIds, memo: state.memo, submissionId: requestId('course-application-7352'), idempotencyKey: config.month + '|' + (localStorage.getItem('studentName') || '') });
      alert(text(result.message) || '수강신청이 접수되었습니다.');
      await loadConfig(true);
    } catch (error) { alert(text(error && error.message) || '수강신청을 제출하지 못했습니다.'); }
    finally { if (typeof global.hideLoading === 'function') global.hideLoading(); }
  }

  function activateTab() {
    document.querySelectorAll('.tab').forEach(function(el){el.classList.remove('active');});
    document.querySelectorAll('.tab-content').forEach(function(el){el.classList.remove('active');});
    const button = document.getElementById(TAB_BUTTON_ID); if (button) button.classList.add('active');
    const panel = document.getElementById(TAB_ID); if (panel) panel.classList.add('active');
  }
  function openTab() { activateTab(); }

  async function loadConfig(force) {
    if (!injectUi() || !loggedIn()) return false;
    try {
      const result = await call('getStudentCourseApplicationConfig7352', { requestId: requestId('course-config-7352'), force: force === true });
      config = result;
      const tab = document.getElementById(TAB_BUTTON_ID);
      const banner = document.getElementById(BANNER_ID);
      if (tab) tab.style.display = result.active ? '' : 'none';
      if (banner) banner.style.display = result.active ? 'flex' : 'none';
      const bannerText = document.getElementById('ulimCourseApplicationBannerText7352');
      if (bannerText) bannerText.textContent = result.title + ' 신청 기간입니다.';
      if (result.active) {
        step = 1;
        render();
        const noticeKey = 'ulimCourseApplicationNotice7352:' + result.month;
        if (!sessionStorage.getItem(noticeKey)) {
          sessionStorage.setItem(noticeKey, '1');
          setTimeout(function(){ if (confirm(result.title + ' 신청 기간입니다.\n지금 신청서를 열까요?')) openTab(); }, 500);
        }
      }
      return result.active === true;
    } catch (_error) { return false; }
  }

  function install() {
    injectStyles();
    injectUi();
    global.ulimOpenCourseApplication7352 = openTab;
    global.ulimCourseApplicationNext7352 = next;
    global.ulimCourseApplicationPrev7352 = prev;
    global.ulimCourseApplicationSubmit7352 = submit;
    global.ulimCourseApplicationRefresh7352 = loadConfig;
    setTimeout(function(){ loadConfig(false); }, 1500);
    setInterval(function(){ if (loggedIn() && !config) loadConfig(false); }, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})(typeof window !== 'undefined' ? window : globalThis);
