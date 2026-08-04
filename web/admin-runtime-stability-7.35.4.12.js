(function (global) {
  'use strict';
  if (global.__ULIM_ADMIN_RUNTIME_STABILITY_735410__) return;
  global.__ULIM_ADMIN_RUNTIME_STABILITY_735410__ = true;
  global.ULIM_ADMIN_RUNTIME_STABILITY_VERSION = '2026-08-04.735.04.12';
  global.__ULIM_VERSION_CHECK_MODE__ = 'MANUAL_ONLY_STABLE_BUILD_735410';
  global.__ULIM_ALL_CLASSES_LAYOUT_735412__ = true;
  global.__ULIM_ALL_CLASSES_SEARCH_PICKER_735412__ = true;

  var scheduled = 0;
  var observer = null;
  var allClassesObserver735412 = null;
  var allClassesSchedule735412 = 0;
  var searchOutsideBound735412 = false;
  var observedBoard735412 = null;
  var allClassesBoardObserver735412 = null;

  function text(value) { return String(value == null ? '' : value).trim(); }

  function removeLegacyAttendanceControls735410() {
    document.querySelectorAll('.ulim-attendance-admin-control-735452').forEach(function (node) { node.remove(); });
    var oldModal = document.getElementById('ulimAllClassesAttendanceModal73549');
    if (oldModal) oldModal.remove();
  }

  function applyStableRuntime735410() {
    var attendanceApi = global.ULIM_ATTENDANCE_ADMIN_API_735410;
    var firestoreApi = global.ULIM_FIRESTORE_ONLY_ADMIN_API_735410;
    if (attendanceApi && typeof attendanceApi.install === 'function') attendanceApi.install();
    if (firestoreApi && typeof firestoreApi.install === 'function') firestoreApi.install();
    removeLegacyAttendanceControls735410();
    if (attendanceApi && typeof attendanceApi.decorate === 'function') attendanceApi.decorate();
    global.__ULIM_STABLE_RUNTIME_READY_735410__ = Boolean(attendanceApi && firestoreApi);
    scheduleAllClassesEnhancement735412(20);
  }

  function scheduleStableRuntime735410(delay) {
    clearTimeout(scheduled);
    scheduled = setTimeout(applyStableRuntime735410, Number(delay) || 0);
  }

  function bindPanelEvents735410() {
    if (global.__ULIM_STABLE_PANEL_EVENTS_735410__) return;
    global.__ULIM_STABLE_PANEL_EVENTS_735410__ = true;
    document.addEventListener('click', function (event) {
      var node = event.target && event.target.closest ? event.target.closest('.admin-subtab,[data-admin-panel]') : null;
      if (!node) return;
      var panel = text(node.getAttribute && node.getAttribute('data-admin-panel'));
      if (panel === 'adminPanelAttendance' || panel === 'adminPanelDailyEval' || panel === 'adminPanelStudentManagement7352') {
        scheduleStableRuntime735410(20);
      }
    }, true);
  }

  function bindDashboardObserver735410() {
    if (observer || typeof MutationObserver !== 'function') return;
    var root = document.getElementById('adminDashboard') || document.body;
    if (!root) return;
    observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        if (mutations[i].type === 'childList') {
          scheduleStableRuntime735410(60);
          break;
        }
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function ensureAllClassesStyles735412() {
    if (document.getElementById('ulimAllClassesTeacherLayoutStyle735412')) return;
    var style = document.createElement('style');
    style.id = 'ulimAllClassesTeacherLayoutStyle735412';
    style.textContent = [
      '#ulimAllClassesBoard735410{display:grid!important;grid-template-columns:none!important;grid-auto-flow:column!important;grid-auto-columns:minmax(340px,390px)!important;align-items:start!important;align-content:start!important;gap:14px!important;overflow:auto!important;padding:14px!important}',
      '#ulimAllClassesBoard735410>.ulim-all-teacher-column735412{min-width:340px;max-width:390px;width:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:16px;background:#eef2f7;overflow:hidden}',
      '#ulimAllClassesBoard735410 .ulim-all-teacher-header735412{position:sticky;top:0;z-index:5;padding:12px 14px;background:#1e3a8a;color:#fff;font-size:16px;font-weight:950;letter-spacing:-.2px;border-bottom:1px solid #1e40af}',
      '#ulimAllClassesBoard735410 .ulim-all-teacher-classes735412{display:flex!important;flex-direction:column!important;gap:12px;padding:10px;min-width:0}',
      '#ulimAllClassesBoard735410 .ulim-all-teacher-classes735412>section[data-all-class-drop]{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;overflow:hidden!important}',
      '#ulimAllClassesBoard735410 section[data-all-class-drop]>header{white-space:normal!important;overflow-wrap:anywhere!important;word-break:keep-all!important;line-height:1.45!important;padding:11px 12px!important}',
      '#ulimAllClassesBoard735410 section[data-all-class-drop]>header span{float:none!important;display:inline-flex!important;margin-left:8px;white-space:nowrap;vertical-align:top}',
      '#ulimAllClassesBoard735410 section[data-all-class-drop] [data-all-student]{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important;box-sizing:border-box!important;white-space:normal!important;overflow:visible!important;overflow-wrap:anywhere!important;word-break:keep-all!important;line-height:1.45!important}',
      '#ulimAllClassesBoard735410 section[data-all-class-drop] [data-all-student] b{display:block!important;max-width:100%!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:keep-all!important;font-size:14px!important}',
      '#ulimAllClassesSearchSuggest735412{display:none;position:absolute;left:0;right:0;top:100%;z-index:30;margin-top:4px;max-height:280px;overflow:auto;border:1px solid #94a3b8;border-radius:10px;background:#fff;box-shadow:0 14px 34px rgba(15,23,42,.22);padding:5px}',
      '#ulimAllClassesSearchSuggest735412.open{display:block}',
      '#ulimAllClassesSearchSuggest735412 button{display:block;width:100%;box-sizing:border-box;border:0;border-radius:8px;background:#fff;padding:9px 10px;text-align:left;cursor:pointer;font-size:13px;line-height:1.4;color:#0f172a}',
      '#ulimAllClassesSearchSuggest735412 button:hover,#ulimAllClassesSearchSuggest735412 button:focus{background:#eff6ff;outline:none}',
      '#ulimAllClassesSearchSuggest735412 .ulim-search-empty735412{padding:10px;color:#64748b;font-size:12px;text-align:center}',
      '#ulimAllClassesSearchChoice735412{display:none;margin-top:5px;padding:6px 9px;border-radius:8px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:850}',
      '#ulimAllClassesSearchChoice735412.show{display:block}',
      '@media(max-width:760px){#ulimAllClassesBoard735410{grid-auto-columns:minmax(300px,90vw)!important}#ulimAllClassesBoard735410>.ulim-all-teacher-column735412{min-width:300px;max-width:90vw}.ulim-all-search-grid735412{grid-template-columns:1fr!important}.ulim-all-search-grid735412>label,.ulim-all-search-grid735412>button{width:100%!important;box-sizing:border-box!important}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function headerOwnText735412(header) {
    if (!header) return '';
    var saved = text(header.getAttribute('data-ulim-original-class-title'));
    if (saved) return saved;
    var own = '';
    Array.prototype.forEach.call(header.childNodes || [], function (node) {
      if (node && node.nodeType === 3) own += ' ' + text(node.nodeValue);
    });
    own = text(own);
    if (!own) own = text(header.textContent).replace(/\s+\d+명\s*$/, '');
    header.setAttribute('data-ulim-original-class-title', own);
    return own;
  }

  function parseClassMeta735412(section) {
    var header = section && section.querySelector ? section.querySelector(':scope > header') : null;
    var title = headerOwnText735412(header);
    var matched = title.match(/^\s*\[([^\]]+)\]\s*-\s*(.+)$/);
    var teacher = matched ? text(matched[1]) : '담당강사 미지정';
    var classLabel = matched ? text(matched[2]) : title;
    var teacherSort = teacher.replace(/\s*T\s*$/i, '').trim();
    var timeMatch = classLabel.match(/(\d{1,2})\s*:\s*(\d{2})\s*[~～〜\-–—]\s*(\d{1,2})\s*:\s*(\d{2})/);
    var startMinutes = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : 99999;
    var endMinutes = timeMatch ? Number(timeMatch[3]) * 60 + Number(timeMatch[4]) : 99999;
    if (header) {
      var firstText = null;
      Array.prototype.some.call(header.childNodes || [], function (node) {
        if (node && node.nodeType === 3) { firstText = node; return true; }
        return false;
      });
      if (firstText) firstText.nodeValue = classLabel + ' ';
      else header.insertBefore(document.createTextNode(classLabel + ' '), header.firstChild || null);
      header.title = title;
    }
    return {
      section: section,
      teacher: teacher,
      teacherSort: teacherSort,
      classLabel: classLabel,
      startMinutes: startMinutes,
      endMinutes: endMinutes
    };
  }

  function sortKorean735412(left, right) {
    return text(left).localeCompare(text(right), 'ko', { sensitivity: 'base', numeric: true });
  }

  function groupAllClassesByTeacher735412() {
    var board = document.getElementById('ulimAllClassesBoard735410');
    if (!board) return;
    var directSections = Array.prototype.filter.call(board.children || [], function (node) {
      return node && node.matches && node.matches('section[data-all-class-drop]');
    });
    if (!directSections.length) return;

    var groups = new Map();
    directSections.map(parseClassMeta735412).forEach(function (meta) {
      var key = meta.teacher || '담당강사 미지정';
      if (!groups.has(key)) groups.set(key, { teacher: key, teacherSort: meta.teacherSort, classes: [] });
      groups.get(key).classes.push(meta);
    });

    var orderedGroups = Array.from(groups.values()).sort(function (a, b) {
      var aUnknown = a.teacher === '담당강사 미지정' ? 1 : 0;
      var bUnknown = b.teacher === '담당강사 미지정' ? 1 : 0;
      return aUnknown - bUnknown || sortKorean735412(a.teacherSort, b.teacherSort);
    });

    board.replaceChildren();
    orderedGroups.forEach(function (group) {
      group.classes.sort(function (a, b) {
        return a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || sortKorean735412(a.classLabel, b.classLabel);
      });
      var column = document.createElement('div');
      column.className = 'ulim-all-teacher-column735412';
      column.setAttribute('data-ulim-teacher', group.teacher);
      var teacherHeader = document.createElement('div');
      teacherHeader.className = 'ulim-all-teacher-header735412';
      teacherHeader.textContent = group.teacher;
      var classList = document.createElement('div');
      classList.className = 'ulim-all-teacher-classes735412';
      group.classes.forEach(function (meta) { classList.appendChild(meta.section); });
      column.appendChild(teacherHeader);
      column.appendChild(classList);
      board.appendChild(column);
    });
    board.setAttribute('data-ulim-grouped-by-teacher', '735412');
  }

  function optionName735412(optionText) {
    var value = text(optionText);
    var split = value.split(/\s+\/\s+/);
    return text(split[0] || value);
  }

  function closeSearchSuggestions735412() {
    var suggest = document.getElementById('ulimAllClassesSearchSuggest735412');
    if (suggest) suggest.classList.remove('open');
  }

  function renderSearchSuggestions735412() {
    var search = document.getElementById('ulimAllClassesStudentSearch735410');
    var select = document.getElementById('ulimAllClassesStudentSelect735410');
    var suggest = document.getElementById('ulimAllClassesSearchSuggest735412');
    if (!search || !select || !suggest) return;
    var query = text(search.value);
    if (!query) {
      suggest.innerHTML = '';
      suggest.classList.remove('open');
      return;
    }
    var options = Array.prototype.filter.call(select.options || [], function (option) {
      return option && text(option.value);
    }).slice(0, 40);
    if (!options.length) {
      suggest.innerHTML = '<div class="ulim-search-empty735412">검색 결과가 없습니다.</div>';
      suggest.classList.add('open');
      return;
    }
    suggest.innerHTML = options.map(function (option) {
      return '<button type="button" data-ulim-student-option="' + String(option.value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '"><b>'
        + optionName735412(option.textContent).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        + '</b><div style="font-size:11px;color:#64748b;margin-top:2px">'
        + text(option.textContent).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        + '</div></button>';
    }).join('');
    suggest.classList.add('open');
  }

  function bindAllClassesSearchPicker735412() {
    var search = document.getElementById('ulimAllClassesStudentSearch735410');
    var select = document.getElementById('ulimAllClassesStudentSelect735410');
    if (!search || !select || search.getAttribute('data-ulim-search-picker') === '735412') return;
    search.setAttribute('data-ulim-search-picker', '735412');
    search.setAttribute('autocomplete', 'off');
    search.placeholder = '학생명을 입력해 검색 후 선택';

    var grid = search.parentElement && search.parentElement.parentElement;
    if (grid) {
      grid.classList.add('ulim-all-search-grid735412');
      grid.style.gridTemplateColumns = '150px minmax(320px,1fr) auto';
    }
    var searchLabel = search.parentElement;
    if (searchLabel) searchLabel.style.position = 'relative';
    var selectLabel = select.closest ? select.closest('label') : select.parentElement;
    if (selectLabel) selectLabel.style.display = 'none';

    var suggest = document.createElement('div');
    suggest.id = 'ulimAllClassesSearchSuggest735412';
    suggest.setAttribute('role', 'listbox');
    var choice = document.createElement('div');
    choice.id = 'ulimAllClassesSearchChoice735412';
    if (searchLabel) {
      searchLabel.appendChild(suggest);
      searchLabel.appendChild(choice);
    }

    var selectObserver = new MutationObserver(function () {
      setTimeout(renderSearchSuggestions735412, 0);
    });
    selectObserver.observe(select, { childList: true, subtree: true });

    search.addEventListener('input', function () {
      if (text(search.getAttribute('data-ulim-selected-name')) !== text(search.value)) {
        select.value = '';
        search.removeAttribute('data-ulim-selected-name');
        choice.textContent = '';
        choice.classList.remove('show');
      }
      setTimeout(renderSearchSuggestions735412, 0);
    });
    search.addEventListener('focus', function () { setTimeout(renderSearchSuggestions735412, 0); });

    suggest.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-ulim-student-option]') : null;
      if (!button) return;
      var uid = text(button.getAttribute('data-ulim-student-option'));
      var option = Array.prototype.find.call(select.options || [], function (item) { return text(item.value) === uid; });
      if (!option) return;
      var name = optionName735412(option.textContent);
      select.value = uid;
      search.value = name;
      search.setAttribute('data-ulim-selected-name', name);
      choice.textContent = name + ' 학생 선택됨';
      choice.classList.add('show');
      closeSearchSuggestions735412();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    var pendingButton = document.getElementById('ulimAllClassesCreatePending735410');
    if (pendingButton && pendingButton.getAttribute('data-ulim-search-clear') !== '735412') {
      pendingButton.setAttribute('data-ulim-search-clear', '735412');
      pendingButton.addEventListener('click', function () {
        setTimeout(function () {
          if (!document.getElementById('ulimAllClassesPendingCard735410')) return;
          search.value = '';
          select.value = '';
          search.removeAttribute('data-ulim-selected-name');
          choice.textContent = '';
          choice.classList.remove('show');
          closeSearchSuggestions735412();
        }, 0);
      });
    }

    if (!searchOutsideBound735412) {
      searchOutsideBound735412 = true;
      document.addEventListener('click', function (event) {
        var target = event.target;
        if (target && target.closest && target.closest('#ulimAllClassesStudentSearch735410,#ulimAllClassesSearchSuggest735412')) return;
        closeSearchSuggestions735412();
      }, true);
    }
  }

  function bindAllClassesBoardObserver735412() {
    if (typeof MutationObserver !== 'function') return;
    var board = document.getElementById('ulimAllClassesBoard735410');
    if (board === observedBoard735412) return;
    if (allClassesBoardObserver735412) allClassesBoardObserver735412.disconnect();
    observedBoard735412 = board || null;
    allClassesBoardObserver735412 = null;
    if (!board) return;
    allClassesBoardObserver735412 = new MutationObserver(function () {
      scheduleAllClassesEnhancement735412(20);
    });
    allClassesBoardObserver735412.observe(board, { childList: true });
  }

  function applyAllClassesEnhancements735412() {
    ensureAllClassesStyles735412();
    bindAllClassesBoardObserver735412();
    bindAllClassesSearchPicker735412();
    groupAllClassesByTeacher735412();
  }

  function scheduleAllClassesEnhancement735412(delay) {
    clearTimeout(allClassesSchedule735412);
    allClassesSchedule735412 = setTimeout(applyAllClassesEnhancements735412, Number(delay) || 0);
  }

  function addedNodeContainsAllClasses735412(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.id === 'ulimAllClassesAttendanceModal735410' || node.id === 'ulimAllClassesBoard735410') return true;
    return !!(node.querySelector && node.querySelector('#ulimAllClassesAttendanceModal735410,#ulimAllClassesBoard735410'));
  }

  function bindAllClassesObserver735412() {
    if (allClassesObserver735412 || typeof MutationObserver !== 'function') return;
    var root = document.body || document.documentElement;
    if (!root) return;
    allClassesObserver735412 = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        if (mutation.target && mutation.target.id === 'ulimAllClassesBoard735410') {
          bindAllClassesBoardObserver735412();
          scheduleAllClassesEnhancement735412(20);
          return;
        }
        for (var j = 0; j < mutation.addedNodes.length; j += 1) {
          if (addedNodeContainsAllClasses735412(mutation.addedNodes[j])) {
            bindAllClassesBoardObserver735412();
            scheduleAllClassesEnhancement735412(20);
            return;
          }
        }
      }
    });
    allClassesObserver735412.observe(root, { childList: true, subtree: true });
    bindAllClassesBoardObserver735412();
  }

  function install735410() {
    bindPanelEvents735410();
    bindDashboardObserver735410();
    bindAllClassesObserver735412();
    applyStableRuntime735410();
    scheduleAllClassesEnhancement735412(30);
  }

  global.ULIM_ADMIN_RUNTIME_STABILITY_API_735410 = {
    install: install735410,
    apply: applyStableRuntime735410,
    enhanceAllClasses: applyAllClassesEnhancements735412
  };
  global.addEventListener('pageshow', function () { scheduleStableRuntime735410(30); scheduleAllClassesEnhancement735412(50); });
  global.addEventListener('ulim-firebase-auth-ready', function () { scheduleStableRuntime735410(50); scheduleAllClassesEnhancement735412(70); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install735410, { once: true });
  else install735410();
})(typeof window !== 'undefined' ? window : globalThis);
