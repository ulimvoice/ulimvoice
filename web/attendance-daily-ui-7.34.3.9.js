(function (global) {
  'use strict';
  if (global.__ULIM_ATTENDANCE_DAILY_UI_73439__) return;
  global.__ULIM_ATTENDANCE_DAILY_UI_73439__ = true;

  const VERSION = '2026-08-01.734.039';
  const SPECIAL_WORDS = ['보강', '신규', '반이동', '휴원'];
  let attendanceDirty = false;
  let lastAttendanceSignature = '';
  let attendanceLoadPromise = null;
  let lastAttendanceAutoLoadAt = 0;
  let dailyObserver = null;
  let dailySanitizeQueued = false;

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function esc(value) {
    if (typeof global.ulimAdminEsc_ === 'function') return global.ulimAdminEsc_(value);
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanAttendance(value) {
    const raw = text(value);
    const key = raw.replace(/\s+/g, '').toUpperCase();
    if (!raw || raw === '-' || /^(미체크|미출결)$/.test(raw)) return '';
    if (/^(O|○|ㅇ|출|출석|TRUE|V|✓|✔)$/.test(key)) return '출석';
    if (/^(X|×|✕|결|결석|FALSE)$/.test(key)) return '결석';
    if (/^(지|지각|△|늦음)$/.test(key)) return '지각';
    return '';
  }

  function specialTokens(value) {
    const raw = text(value);
    if (!raw) return [];
    return SPECIAL_WORDS.filter(function (word) {
      return raw.indexOf(word) >= 0;
    });
  }

  function specialStatus(record) {
    const values = [
      record && record.specialStatus,
      record && record.specialType,
      record && record.special,
      record && record.colorStatus,
      record && record.enrollmentStatus,
      record && record.studentStatus
    ];
    const found = [];
    values.forEach(function (value) {
      specialTokens(value).forEach(function (token) {
        if (found.indexOf(token) < 0) found.push(token);
      });
    });
    return found.join(' / ');
  }

  function currentStatus(record) {
    const direct = text(
      record && (
        record.currentStatus ||
        record.remarkText ||
        record.sheetRemark ||
        record.currentState ||
        record.remark
      )
    );
    if (direct) return direct;

    // 이전 버전에서는 시트 비고값이 specialStatus에 들어갔습니다.
    const legacy = text(record && record.specialStatus);
    return specialTokens(legacy).length ? '' : legacy;
  }

  function memoValue(record) {
    return text(record && (record.memo ?? record.appMemo ?? record.manualMemo));
  }

  function attendanceRecords() {
    try {
      return Array.isArray(global.adminAttendanceRecords)
        ? global.adminAttendanceRecords
        : (typeof adminAttendanceRecords !== 'undefined' && Array.isArray(adminAttendanceRecords) ? adminAttendanceRecords : []);
    } catch (_ignore) {
      return [];
    }
  }

  function attendanceSignature(records) {
    return JSON.stringify((records || []).map(function (record) {
      return [
        text(record.studentUid || record.studentIdentityKey || record.studentNo || record.studentName),
        text(record.studentName || record.name),
        cleanAttendance(record.status || record.attendanceStatus),
        currentStatus(record),
        specialStatus(record),
        memoValue(record)
      ];
    }));
  }

  function attendanceOptions(status) {
    if (typeof global.adminAttendanceStatusOptions_ === 'function') {
      return global.adminAttendanceStatusOptions_(status || '미체크');
    }
    return ['미체크', '출석', '결석', '지각'].map(function (value) {
      const label = value === '출석' ? 'O 출석' : (value === '결석' ? 'X 결석' : value);
      return '<option value="' + esc(value) + '"' + ((status || '미체크') === value ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function selectedClass(status, target) {
    if (typeof global.adminAttendanceButtonSelectedClass_ === 'function') {
      return global.adminAttendanceButtonSelectedClass_(status, target);
    }
    return status === target ? ' selected' : '';
  }

  function renderAttendanceStable(force) {
    const wrap = document.getElementById('adminAttendanceTableWrap');
    if (!wrap) return false;
    const records = attendanceRecords();

    if (attendanceDirty && !force && wrap.querySelector('table')) return false;

    if (!records.length) {
      lastAttendanceSignature = '';
      wrap.innerHTML = '<div class="notice-empty">출석부 데이터를 불러오세요. 날짜와 반명을 선택한 뒤 출석체크를 진행하면 됩니다.</div>';
      return true;
    }

    const signature = attendanceSignature(records);
    if (!force && signature === lastAttendanceSignature && wrap.querySelector('table')) return false;
    lastAttendanceSignature = signature;

    const scrollTop = wrap.scrollTop;
    const scrollLeft = wrap.scrollLeft;
    const memoDrafts = {};
    const currentStatusDrafts = {};
    wrap.querySelectorAll('tr[data-att-index]').forEach(function (row) {
      const memoInput = row.querySelector('input[data-field="memo"]');
      if (memoInput && (memoInput.dataset.memoDirty === '1' || row.dataset.memoDirty === '1')) {
        memoDrafts[row.dataset.attIndex] = memoInput.value;
      }
      const currentInput = row.querySelector('input[data-field="currentStatus"]');
      if (currentInput && (currentInput.dataset.currentStatusDirty === '1' || row.dataset.currentStatusDirty === '1')) {
        currentStatusDrafts[row.dataset.attIndex] = currentInput.value;
      }
    });

    let html = '<table class="admin-table ulim-attendance-table-73438"><thead><tr>' +
      '<th><input type="checkbox" id="adminAttendSelectAll" onchange="adminToggleAttendanceAll(this.checked)" checked></th>' +
      '<th>학생명</th><th>출석체크</th><th>현재상태</th><th>특이사항</th><th>메모</th>' +
      '</tr></thead><tbody>';

    records.forEach(function (record, idx) {
      const status = cleanAttendance(record.status || record.attendanceStatus) || '미체크';
      const current = Object.prototype.hasOwnProperty.call(currentStatusDrafts, String(idx))
        ? currentStatusDrafts[String(idx)]
        : currentStatus(record);
      const special = specialStatus(record);
      const memo = Object.prototype.hasOwnProperty.call(memoDrafts, String(idx)) ? memoDrafts[String(idx)] : memoValue(record);
      const badgeClass = status === '출석' ? 'attendance-ok' : (status === '결석' ? 'attendance-no' : '');

      html += '<tr data-att-index="' + idx + '">' +
        '<td data-label="선택"><input type="checkbox" class="admin-att-check" checked></td>' +
        '<td data-label="학생명"><b>' + esc(record.studentName || record.name) + '</b></td>' +
        '<td data-label="출석체크"><div class="admin-att-action-wrap">' +
          '<button type="button" class="admin-att-mini ok' + selectedClass(status, '출석') + '" onclick="adminSetAttendanceRowStatus(' + idx + ', \'출석\')" title="출석 처리">O</button>' +
          '<button type="button" class="admin-att-mini no' + selectedClass(status, '결석') + '" onclick="adminSetAttendanceRowStatus(' + idx + ', \'결석\')" title="결석 처리">X</button>' +
          '<select class="admin-att-status-select" data-field="status" onchange="adminSyncAttendanceRowStatus(' + idx + ', this.value)">' + attendanceOptions(status) + '</select>' +
          '<span id="admin-att-save-state-' + idx + '" class="admin-att-save-state"></span>' +
        '</div></td>' +
        '<td data-label="현재상태"><input class="admin-small-input ulim-current-status-input-73439" data-field="currentStatus" maxlength="500" value="' + esc(current) + '" placeholder="현재 상태 입력"></td>' +
        '<td data-label="특이사항">' + (special ? '<span class="admin-status-badge">' + esc(special) + '</span>' : '-') + '</td>' +
        '<td data-label="메모"><input class="admin-small-input" data-field="memo" value="' + esc(memo) + '" placeholder="해당 출석칸 메모"></td>' +
      '</tr>';
    });

    html += '</tbody></table><div class="ulim-attendance-actions-559">' +
      '<button type="button" class="admin-btn" onclick="adminSaveAttendanceFromTable(false)">선택 출석부 저장</button>' +
      '<button type="button" class="admin-btn gray" onclick="adminLoadAttendanceSnapshot(true, true)">출석부 다시 불러오기</button>' +
      '</div>';

    wrap.innerHTML = html;
    wrap.scrollTop = scrollTop;
    wrap.scrollLeft = scrollLeft;
    if (typeof global.ulimAdminAfterRender_ === 'function') global.ulimAdminAfterRender_();
    return true;
  }

  global.adminRenderAttendanceTable = function () {
    return renderAttendanceStable(false);
  };
  try { adminRenderAttendanceTable = global.adminRenderAttendanceTable; } catch (_ignore) {}

  const priorAttendanceLoad = global.adminLoadAttendanceSnapshot;
  if (typeof priorAttendanceLoad === 'function') {
    global.adminLoadAttendanceSnapshot = function (showAlert, forceSheetSync) {
      const explicit = showAlert === true || forceSheetSync === true;
      const now = Date.now();
      if (!explicit && attendanceLoadPromise) return attendanceLoadPromise;
      if (!explicit && now - lastAttendanceAutoLoadAt < 1400) return Promise.resolve(false);
      lastAttendanceAutoLoadAt = now;
      const result = Promise.resolve(priorAttendanceLoad.apply(this, arguments));
      attendanceLoadPromise = result.finally(function () {
        attendanceLoadPromise = null;
        setTimeout(function () { renderAttendanceStable(false); }, 0);
      });
      return attendanceLoadPromise;
    };
    try { adminLoadAttendanceSnapshot = global.adminLoadAttendanceSnapshot; } catch (_ignore) {}
  }

  document.addEventListener('input', function (event) {
    const input = event.target;
    if (!input || !input.matches) return;

    if (input.matches('#adminAttendanceTableWrap input[data-field="currentStatus"]')) {
      attendanceDirty = true;
      const row = input.closest('tr[data-att-index]');
      if (row) {
        row.dataset.currentStatusDirty = '1';
        input.dataset.currentStatusDirty = '1';
        const check = row.querySelector('.admin-att-check');
        if (check) check.checked = true;
        const idx = Number(row.dataset.attIndex);
        const records = attendanceRecords();
        if (records[idx]) {
          const value = input.value || '';
          records[idx].currentStatus = value;
          records[idx].remarkText = value;
          records[idx].sheetRemark = value;
          records[idx].currentStatusDirty = true;
          records[idx].remarkDirty = true;
          records[idx].sheetRemarkDirty = true;
          records[idx].__currentStatusDirty73439 = true;
        }
      }
      return;
    }

    if (input.matches('#adminAttendanceTableWrap input[data-field="memo"]')) {
      attendanceDirty = true;
      const row = input.closest('tr[data-att-index]');
      if (row) {
        row.dataset.memoDirty = '1';
        input.dataset.memoDirty = '1';
        const check = row.querySelector('.admin-att-check');
        if (check) check.checked = true;
        const idx = Number(row.dataset.attIndex);
        const records = attendanceRecords();
        if (records[idx]) {
          records[idx].memo = input.value || '';
          records[idx].appMemo = input.value || '';
          records[idx].manualMemo = input.value || '';
          records[idx].memoDirty = true;
          records[idx].memoTouched = true;
          records[idx].__memoDirty712 = true;
        }
      }
    }
  }, true);

  const priorAttendanceSave = global.adminSaveAttendanceFromTable;
  if (typeof priorAttendanceSave === 'function') {
    global.adminSaveAttendanceFromTable = async function () {
      const result = await priorAttendanceSave.apply(this, arguments);
      if (result !== false) {
        attendanceDirty = false;
        lastAttendanceSignature = '';
      }
      return result;
    };
    try { adminSaveAttendanceFromTable = global.adminSaveAttendanceFromTable; } catch (_ignore) {}
  }

  function dailyRows() {
    try {
      return Array.isArray(global.adminDailyEvalRows)
        ? global.adminDailyEvalRows
        : (typeof adminDailyEvalRows !== 'undefined' && Array.isArray(adminDailyEvalRows) ? adminDailyEvalRows : []);
    } catch (_ignore) {
      return [];
    }
  }

  function cleanDailyRecord(record) {
    const copy = Object.assign({}, record || {});
    copy.attendanceStatus = cleanAttendance(copy.attendanceStatus || copy.status);
    copy.status = copy.attendanceStatus;
    copy.specialStatus = specialStatus(copy);
    return copy;
  }

  function dailyStatusText(record) {
    const values = [cleanAttendance(record && (record.attendanceStatus || record.status)), specialStatus(record || {})]
      .filter(Boolean)
      .filter(function (value, index, list) { return list.indexOf(value) === index; });
    return values.join(' / ') || '-';
  }

  function sanitizeDailyStatusCells() {
    const wrap = document.getElementById('adminDailyEvalTableWrap');
    if (!wrap) return;
    const table = wrap.querySelector('table');
    if (!table) return;
    const headers = Array.from(table.querySelectorAll('thead th'));
    const statusIndex = headers.findIndex(function (th) {
      return /출결\s*\/\s*특이사항|출결.*특이사항/.test(text(th.textContent));
    });
    if (statusIndex < 0) return;
    const rows = dailyRows();
    table.querySelectorAll('tbody tr[data-daily-index]').forEach(function (tr) {
      const idx = Number(tr.dataset.dailyIndex);
      const cells = tr.querySelectorAll('td');
      const cell = cells[statusIndex];
      if (!cell) return;
      const next = dailyStatusText(rows[idx] || {});
      if (text(cell.textContent) !== next) cell.textContent = next;
      cell.removeAttribute('title');
      cell.style.fontWeight = '';
      cell.style.color = '';
      cell.style.background = '';
    });
  }

  function queueDailySanitize() {
    if (dailySanitizeQueued) return;
    dailySanitizeQueued = true;
    setTimeout(function () {
      dailySanitizeQueued = false;
      sanitizeDailyStatusCells();
    }, 0);
  }

  const priorDailyRender = global.adminRenderDailyEvalRows;
  if (typeof priorDailyRender === 'function') {
    global.adminRenderDailyEvalRows = function () {
      const cleaned = dailyRows().map(cleanDailyRecord);
      try { global.adminDailyEvalRows = cleaned; } catch (_ignore) {}
      try { adminDailyEvalRows = cleaned; } catch (_ignore) {}
      const result = priorDailyRender.apply(this, arguments);
      sanitizeDailyStatusCells();
      setTimeout(sanitizeDailyStatusCells, 5);
      setTimeout(sanitizeDailyStatusCells, 100);
      return result;
    };
    try { adminRenderDailyEvalRows = global.adminRenderDailyEvalRows; } catch (_ignore) {}
  }

  function installDailyObserver() {
    const wrap = document.getElementById('adminDailyEvalTableWrap');
    if (!wrap || dailyObserver) return;
    dailyObserver = new MutationObserver(queueDailySanitize);
    dailyObserver.observe(wrap, { childList: true, subtree: true, characterData: true });
  }

  function hadExistingDailyContent(base) {
    return !!text([
      base && base.lessonContent,
      base && base.lessonAttitude,
      base && base.teacherComment,
      base && base.evaluation
    ].join(''));
  }

  global.adminGetSelectedDailyRows = function () {
    const date = text(document.getElementById('adminDailyEvalDate') && document.getElementById('adminDailyEvalDate').value);
    const selectedClass = text(document.getElementById('adminDailyEvalClass') && document.getElementById('adminDailyEvalClass').value);
    const rows = dailyRows();
    const commonLesson = text(document.getElementById('adminDailyCommonLesson') && document.getElementById('adminDailyCommonLesson').value);
    return Array.from(document.querySelectorAll('#adminDailyEvalTableWrap tr[data-daily-index]')).map(function (tr) {
      const checked = tr.querySelector('.admin-daily-check');
      if (checked && !checked.checked) return null;
      const idx = Number(tr.dataset.dailyIndex);
      const base = Object.assign({}, rows[idx] || {});
      const rowLesson = text(tr.querySelector('.admin-eval-lesson') && tr.querySelector('.admin-eval-lesson').value);
      const lesson = rowLesson || commonLesson;
      const attitude = text(tr.querySelector('.admin-eval-attitude') && tr.querySelector('.admin-eval-attitude').value);
      const comment = text(tr.querySelector('.admin-eval-comment') && tr.querySelector('.admin-eval-comment').value);
      const hasAny = !!(lesson || attitude || comment);
      const hadExisting = hadExistingDailyContent(base);
      if (!hasAny && !hadExisting) return null;

      base.date = date || base.date || '';
      base.className = selectedClass && selectedClass !== '전체반' ? selectedClass : (base.className || selectedClass || '');
      if (typeof global.adminCleanClassNameOnly_ === 'function') base.className = global.adminCleanClassNameOnly_(base.className);
      base.lessonContent = lesson;
      base.lessonAttitude = attitude;
      base.teacherComment = comment;
      base.attendanceStatus = cleanAttendance(base.attendanceStatus || base.status);
      base.status = base.attendanceStatus;
      base.specialStatus = specialStatus(base);
      base.clearEvaluation = !hasAny && hadExisting;
      if (base.clearEvaluation) {
        base.videoLink = '';
        base.evaluation = '';
      } else {
        if (!base.videoLink && typeof global.adminGetVideoLinkForClassName_ === 'function') {
          base.videoLink = global.adminGetVideoLinkForClassName_(base.className) || '';
        }
        base.evaluation = typeof global.adminBuildDailyEvalMessageFromParts === 'function'
          ? global.adminBuildDailyEvalMessageFromParts(base)
          : [lesson, attitude, comment].filter(Boolean).join('\n');
      }
      return base;
    }).filter(Boolean);
  };
  try { adminGetSelectedDailyRows = global.adminGetSelectedDailyRows; } catch (_ignore) {}

  const priorDailySave = global.adminSaveDailyEvaluations;
  if (typeof priorDailySave === 'function') {
    global.adminSaveDailyEvaluations = async function (sendSms) {
      const selected = global.adminGetSelectedDailyRows();
      if (sendSms && selected.some(function (row) { return row.clearEvaluation === true; })) {
        alert('내용을 지우는 작업은 평가 저장으로만 처리할 수 있습니다. 저장 후 발송은 사용할 수 없습니다.');
        return false;
      }
      return priorDailySave.apply(this, arguments);
    };
    try { adminSaveDailyEvaluations = global.adminSaveDailyEvaluations; } catch (_ignore) {}
  }

  document.addEventListener('input', function (event) {
    const target = event.target;
    if (!target || !target.matches) return;
    if (target.matches('#adminDailyEvalTableWrap .admin-eval-lesson, #adminDailyEvalTableWrap .admin-eval-attitude, #adminDailyEvalTableWrap .admin-eval-comment')) {
      const row = target.closest('tr[data-daily-index]');
      if (row) row.dataset.dailyTouched = '1';
    }
  }, true);

  const style = document.createElement('style');
  style.id = 'ulim-attendance-daily-ui-73439-style';
  style.textContent = [
    '#adminAttendanceTableWrap .ulim-attendance-table-73438{table-layout:fixed;width:100%;}',
    '#adminAttendanceTableWrap .ulim-attendance-table-73438 th:nth-child(1){width:42px;}',
    '#adminAttendanceTableWrap .ulim-attendance-table-73438 th:nth-child(2){width:120px;}',
    '#adminAttendanceTableWrap .ulim-attendance-table-73438 th:nth-child(3){width:250px;}',
    '#adminAttendanceTableWrap .ulim-current-status-input-73439{width:100%;min-width:150px;box-sizing:border-box;}',
    '#adminAttendanceTableWrap input[data-field="memo"]{min-width:140px;}'
  ].join('');
  document.head.appendChild(style);

  installDailyObserver();
  document.addEventListener('DOMContentLoaded', installDailyObserver, { once: true });
  setTimeout(installDailyObserver, 500);
  setTimeout(sanitizeDailyStatusCells, 700);

})(typeof window !== 'undefined' ? window : globalThis);
