export {
  exchangeLegacySessionCallable as exchangeLegacySession
} from "./auth/exchangeLegacySessionCallable.js";
export {
  migrateCurrentStaffPasswordCredential,
  STAFF_FIREBASE_PRIMARY_AUTH_VERSION
} from "./auth/staffFirebasePrimaryAuth.js";
export {
  syncClassroomRealtimeSnapshot,
  syncRoomRealtimeSnapshot
} from "./realtime/roomClassroomRealtimeCallable.js";
export {
  beginClassroomSheetCanonicalMutation,
  finalizeClassroomSheetCanonicalMutation,
  abortClassroomSheetCanonicalMutation
} from "./realtime/classroomSheetCanonicalOptimisticCallable.js";
export {
  listPendingClassroomSheetSyncJobs,
  completeClassroomSheetSyncJob,
  noteClassroomSheetSyncFailure
} from "./realtime/classroomFirestoreFirstCallable.js";
export {
  getClassroomUsageDayFirestorePrimary7355058,
  commitClassroomUsageFirestorePrimary7355057,
  releaseClassroomUsageFirestorePrimary7355057,
  updateClassroomUsageSlotFirestorePrimary7355057,
  auditClassroomUsageFirestorePrimary7355057,
  CLASSROOM_FIRESTORE_PRIMARY_7355057_VERSION
} from "./realtime/classroomFirestorePrimary7355057.js";

export {
  saveStaffAttendanceOperational,
  saveStaffDailyEvaluationsOperational,
  getStaffAttendanceOperationalSnapshot,
  getStaffClassListOperationalSnapshot,
  getStaffDailyEvaluationOperationalSnapshot
} from "./operational/staffOperationalFirestore.js";

export {
  UID_V2_POST_CUTOVER_SMOKE_UID_FIELD_HOTFIX_VERSION,
  UID_V2_POST_CUTOVER_SMOKE_RELEASE_PHASE4C31_VERSION,
  runUidV2PostCutoverSmokePhase4c31a,
  releaseUidV2MaintenancePhase4c31b,
  inspectUidV2PostCutoverReleasePhase4c31
} from "./migration/uidV2PostCutoverSmokeReleasePhase4c31Callable.js";

export {
  listStaffAccountsAdmin,
  createStaffAccountAdmin,
  updateStaffAccountAdmin,
  resetStaffPasswordAdmin,
  deleteStaffAccountAdmin,
  STAFF_ACCOUNT_MANAGEMENT_VERSION
} from "./admin/staffAccountManagement.js";

export {
  listStudentsAdmin7342,
  updateStudentMetadataAdmin7342,
  updateStudentsMetadataBatchAdmin7343,
  MASTER_DIRECTORY_SYNC_VERSION
} from "./admin/masterDirectorySync.js";

export {
  issueTabletKioskToken,
  getTabletOperationalSnapshot
} from "./operational/staffOperationalFirestore.js";



// ULIM 7.35.5.0.11: app notice, course-login notice, tablet ads
export {
  getOperationalContentAdmin7355011,
  saveOperationalContentAdmin7355011,
  createStudentCourseNoticeAdmin7355011,
  getStudentLoginContent7355011,
  ackStudentLoginNotices7355011,
  getTabletOperationalContent7355011,
  OPERATIONAL_CONTENT_7355011_VERSION
} from "./admin/operationalContent7355011.js";

// ULIM 7.35.5.0.14: canonical Firestore operational surface.
// Attendance/tablet/student operations do not export legacy operational Sheets import/sync functions.
export {
  saveAttendanceRowsAdmin73550,
  listAttendanceStudentCandidatesAdmin73550,
  addAttendanceSessionStudentsAdmin73550,
  removeAttendanceSessionStudentsAdmin73550,
  addTemporaryAttendanceAdmin7355014,
  removeAttendanceStudentAdmin7355014,
  getOperationalStudentDetailAdmin73550,
  sendOperationalAlimtalkAdmin73550,
  changeClassSessionAdmin73550,
  listStaffPrivateNotesAdmin73550,
  saveStaffPrivateNoteAdmin73550,
  savePaymentAdmin73550,
  getDailyEvaluationTemplateAdmin73550,
  saveDailyEvaluationTemplateAdmin73550,
  getAttendanceRevisionAdmin73550,
  onStudentRosterRevision73550,
  onEnrollmentRosterRevision73550,
  onAttendanceRevision73550,
  onAttendanceOverrideRevision73550,
  onClassScheduleRevision73550,
  FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION,
  getMonthlyWeekdaySessionPlanAdmin7355034,
  setMonthlyWeekdaySessionsAdmin7355034
} from "./operational/firestorePrimaryOperations73550.js";

// Current student-management surface used by student-master-admin.
// Sheet import/export reconciliation callables are intentionally not re-exported.
export {
  saveClassCatalogAdmin7354,
  retireClassCatalogAdmin7354,
  getStudentClassCatalogAdmin7352,
  listStudentManagementAdmin7352,
  createStudentAdmin7352,
  updateStudentAdmin7352,
  updateStudentsBatchAdmin7352,
  retryStudentOperationAdmin7352,
  resetStudentPracticeDailyLimitsAdmin7355051,
  retireStudentAdmin7352,
  processStudentOperationJob7352,
  sweepStudentOperationJobs7352,
  STUDENT_MANAGEMENT_OPERATIONS_7352_VERSION,
  saveCourseApplicationWindowAdmin7352,
  getStudentCourseApplicationConfig7352,
  submitStudentCourseApplication7352,
  getStudentHomeBootstrap7355031,
  getCourseApplicationAdminDashboard7355031,
  getAudienceSegmentationAdmin7355034,
  saveClassAudienceAdmin7355034,
  saveStudentAudienceAdmin7355034,
  saveAudienceNotificationPolicyAdmin7355034,
  getPublicNewStudentRegistration73550937,
  getNewStudentRegistrationAdmin73550937,
  saveNewStudentRegistrationSettingsAdmin73550937,
  submitNewStudentRegistration73550937,
  uploadNewStudentRegistrationImageStorage73550956,
  deleteNewStudentRegistrationImageStorage73550956
} from "./admin/studentManagementOperations7352.js";

// Firestore -> Sheets backup only: administrator-triggered and every day at 06:00 KST.
export {
  runFirestoreBackupAdmin735414,
  exportFirestoreBackupsDaily0615Admin735414,
  DATA_AUTHORITY_MIGRATION_735414_VERSION
} from "./admin/dataAuthorityMigration735414.js";



export {
  getAttendanceRosterAdmin73550,
  listCourseApplicationsAdmin73550,
  decideCourseApplicationsAdmin73550,
  runSpecialAttendanceNotificationsAdmin735505,
  processSpecialAttendanceNotificationsDaily735505,
  rebuildTodayTabletRosterHourly73550
} from "./operational/firestorePrimaryOperations73550.js";

export {
  getPracticeRoomMonth7355033,
  createPracticeRoomReservation7355033,
  cancelPracticeRoomReservation7355033,
  listPracticeRoomReservationsAdmin7355033 as listRoomReservationsAdmin73550,
  decidePracticeRoomReservationAdmin7355033,
  savePracticeRoomAdminPushToken7355033,
  notifyPracticeRoomReservationAdmin7355033,
  sweepPracticeRoomDecisionNotificationJobs7355036,
  deliverPracticeRoomDecisionNotificationJob7355037
} from "./operational/practiceRoomFirestorePrimary7355033.js";

export {
  saveTabletAttendanceOperational,
  processTabletAttendanceNotification,
  sweepTabletAttendanceNotifications
} from "./operational/staffOperationalFirestore.js";

export {
  resolveStudentFirebaseLogin7355030,
  getStudentFirebaseProfile7355030,
  confirmStudentFirebasePasswordChanged7355030,
  provisionStudentsFirebaseDirectAuthAdmin7355030,
  resetStudentFirebasePasswordAdmin7355030
} from "./auth/studentFirebaseDirectAuth7355030.js";

// Temporary Firebase-only UIDv2/direct-auth recovery. Remove after successful cutover recovery.
export {
  firebaseDirectAuthRecovery7355056,
  FIREBASE_DIRECT_AUTH_RECOVERY_7355056_VERSION
} from "./auth/firebaseDirectAuthRecovery7355056.js";

export {
  getStudentVocalPracticeToday7355041,
  beginStudentVocalPracticeCompletion7355041,
  uploadStudentPracticeDriveChunk7355066,
  finalizeStudentVocalPractice7355041,
  getStudentVocalPracticeCompletionStatus7355052,
  attachStudentVocalPracticeArchive7355041,
  listStudentPracticeLogs7355041,
  beginStudentPracticeArchive7355054,
  finalizeStudentPracticeArchive7355054,
  markStudentPracticeLogsViewed7355054,
  finalizeStudentPracticeDriveUpload7355063,
  sweepStudentPracticeDriveFinalize7355063
} from "./operational/studentVocalPracticeFirestorePrimary7355041.js";

export {
  getPracticeResearchConsent7355042,
  setPracticeResearchConsent7355042,
  warmPracticePronunciation7355043,
  analyzePracticePronunciation7355043,
  beginPracticeIntelligence7355042,
  completePracticeIntelligence7355042,
  attachPracticeArchive7355042,
  listPracticeRecordsForStaff7355042,
  savePracticeTeacherEvaluation7355042,
  savePracticePushToken7355042,
  deliverPracticeNotificationJob7355042,
  backupUlimPracticeIntelligenceToSheets7355042,
  getPracticeBackupStatusAdmin7355042
} from "./operational/studentPracticeIntelligence7355042.js";

// ULIM 7.35.5.0.63: Firestore-owned practice content and asynchronous Drive finalize.
export {
  getPracticeContentAdminStatus7355063,
  refreshVocalSentenceSetAdmin7355063,
  savePastQuestionDriveLinkAdmin7355063,
  syncPastQuestionCatalogAdmin7355063,
  getRandomPastQuestionFirestore7355063,
  maintainVocalSentenceSetDaily7355063,
  syncPastQuestionCatalogMonthly7355063,
  PRACTICE_CONTENT_FIRESTORE_PRIMARY_7355063_VERSION
} from "./operational/practiceContentFirestorePrimary7355063.js";

export {
  finalizeStaffPracticeDriveUpload7355070
} from "./operational/studentVocalPracticeFirestorePrimary7355041.js";

// Firestore -> Sheets backup only. Sheets never mutate Firestore.

// Firestore -> Sheets backup only. Sheets never mutate Firestore.
export {
  OPERATIONAL_SHEET_MIRROR_7355080_VERSION,
  exportAttendanceClassroomToSheetsDaily06007355080,
  runAttendanceClassroomSheetBackupAdmin7355080
} from "./operational/operationalSheetMirror7355080.js";
export {
  exportFirestoreFullSnapshotDaily06257355087,
  runFirestoreFullSnapshotAdmin7355087
} from "./operational/firestoreFullSnapshotBackup7355087.js";

// ULIM 7.35.5.0.90: admin-only Alimtalk/SOLAPI delivery history.
export {
  listMessageDeliveriesAdmin7355090,
  refreshMessageDeliveryStatusesAdmin7355090,
  MESSAGE_DELIVERY_ADMIN_7355090_VERSION
} from "./admin/messageDeliveryAdmin7355090.js";
