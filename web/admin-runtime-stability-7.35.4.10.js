(function (global) {
  'use strict';
  if (global.__ULIM_ADMIN_RUNTIME_STABILITY_735410__) return;
  global.__ULIM_ADMIN_RUNTIME_STABILITY_735410__ = true;
  global.ULIM_ADMIN_RUNTIME_STABILITY_VERSION = '2026-08-04.735.04.10';
  global.__ULIM_VERSION_CHECK_MODE__ = 'MANUAL_ONLY_STABLE_BUILD_735410';

  var scheduled = 0;
  var observer = null;

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

  function install735410() {
    bindPanelEvents735410();
    bindDashboardObserver735410();
    applyStableRuntime735410();
  }

  global.ULIM_ADMIN_RUNTIME_STABILITY_API_735410 = { install: install735410, apply: applyStableRuntime735410 };
  global.addEventListener('pageshow', function () { scheduleStableRuntime735410(30); });
  global.addEventListener('ulim-firebase-auth-ready', function () { scheduleStableRuntime735410(50); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install735410, { once: true });
  else install735410();
})(typeof window !== 'undefined' ? window : globalThis);
