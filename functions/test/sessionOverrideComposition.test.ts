import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';

// Execute the actual owners without importing Firebase or exposing any network capability.
const root = path.resolve(process.cwd(), '..');
const source = (file: string) => ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
const backend = source('functions/src/operational/firestorePrimaryOperations73550.ts');
const frontend = source('web/attendance-admin-integrated-7.35.4.34.js');
const dailyBackend = source('functions/src/operational/staffOperationalFirestore.ts');
const dailyFrontend = source('web/staff-firestore-operational-7.31.23.js');
function find(sf: ts.SourceFile, predicate: (n: ts.Node) => boolean): ts.Node {
  const matches: ts.Node[] = [];
  const visit = (n: ts.Node) => { if (predicate(n)) matches.push(n); ts.forEachChild(n, visit); };
  visit(sf); assert.equal(matches.length, 1, 'owner must exist exactly once'); return matches[0];
}
const fn = (sf: ts.SourceFile, name: string) => find(sf, n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(sf).replace(/^export /, '');
const variable = (sf: ts.SourceFile, name: string) => (find(sf, n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) as ts.VariableDeclaration).initializer!.getText(sf);
const A = '2026-09-07', B = '2026-09-08';
const item = { classId: 'CLS2_REGRESSION', className: 'Regression Class', instructorUid: 'X', instructorName: 'X', teacherScopeKey: 'base-scope', startTime: '10:00', endTime: '11:00', weekday: '월', dates: [A], active: true, raw: {} };
const helpers = ['object', 'text', 'normalize', 'safeDate', 'requireDate', 'safeTime', 'weekdayForDate', 'hashId', 'unique', 'canonicalAttendanceRecordId73550993', 'classScheduleOperation7355033', 'normalizeScheduleChange73551012', 'sessionMetadata73551012', 'effectiveClassesForDate', 'attendanceLedgerActionDate73550921', 'claimSpecialMessageJob735505', 'completeSpecialMessageJob735505', 'buildAttendanceRosterInternal7355014', 'dateOffset7355014', 'timeSortValue7355033'];
function harness() {
  const docs = new Map<string, any>(), versions = new Map<string, number>();
  const writes: string[] = [], notifications: any[] = [], jobs = new Set<string>();
  let conflicts = 0;
  const ref = (key: string) => ({ key, get: async () => snapshot(key), set: async (data: any, options?: any) => put(key, data, options) });
  const snapshot = (key: string) => ({ exists: docs.has(key), data: () => docs.has(key) ? structuredClone(docs.get(key)) : undefined });
  function put(key: string, data: any, options?: any) { docs.set(key, options?.merge ? { ...docs.get(key), ...structuredClone(data) } : structuredClone(data)); versions.set(key, (versions.get(key) || 0) + 1); writes.push(key); }
  const database = {
    collection: (name: string) => {
      const constraints: any[] = [];
      const query: any = { doc: (id: string) => ref(name + '/' + id), limit: () => query,
        where: (field: string,op: string,value: any) => { assert.equal(op,'=='); constraints.push([field,value]); return query; },
        get: async () => ({ docs: (name === 'students' ? [['students/student-1', { name:'Same Name', classUids:[item.classId], active:true }]] : [...docs].filter(([key]) => key.startsWith(name+'/')))
          .filter(([,data]: any) => constraints.every(([field,value]) => data[field] === value)).map(([key,data]: any) => ({ id:key.split('/').at(-1), data:() => data })) }) };
      return query;
    },
    batch: () => { const pending: any[] = []; return { set: (r: any, d: any, o: any) => pending.push([r, d, o]), commit: async () => pending.forEach(([r,d,o]) => put(r.key,d,o)) }; },
    runTransaction: async (body: any) => {
      for (let retry = 0; retry < 20; retry++) {
        const read = new Map<string, number>(), pending: any[] = [];
        const result = await body({ get: async (r: any) => { read.set(r.key, versions.get(r.key) || 0); const value = snapshot(r.key); await Promise.resolve(); return value; }, set: (r: any,d: any,o: any) => pending.push([r,d,o]) });
        if ([...read].some(([key,version]) => (versions.get(key) || 0) !== version)) { conflicts++; continue; }
        pending.forEach(([r,d,o]) => put(r.key,d,o)); return result;
      }
      throw Error('transaction retries exhausted');
    }
  };
  const changes = () => [...docs].filter(([key]) => key.startsWith('classScheduleChanges/')).map(([,value]) => value);
  const elements: Record<string, any> = { ulimLedgerScheduleReason735427: { value: 'test' }, ulimLedgerScheduleNotify735427: { checked: false }, ulimLedgerSubTeacher735427: { value: 'Y|Y' }, ulimLedgerMoveDate735427: { value: B }, ulimLedgerMoveStart735427: { value: '12:00' }, ulimLedgerMoveEnd735427: { value: '13:00' }, ulimLedgerScheduleModal735427: { style: {} } };
  const c: any = { Date, Map, Set, Array, String, Number, Math, Promise, createHash, randomUUID,
    MESSAGE_OPTIONS: {}, CALLABLE_OPTIONS: {}, ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS: {}, FULL_ADMIN_ROLES: new Set(['admin', 'superAdmin']), FIRESTORE_PRIMARY_OPERATIONS_73550_VERSION: 'test', WEEKDAY_KO: ['일','월','화','수','목','금','토'],
    onCall: (_options: any, handler: any) => handler, requireStaff: async () => ({ role: 'superAdmin', firebaseUid: 'test-admin' }), db: () => database,
    loadClassCatalog: async () => [item], loadScheduleChanges: async () => changes(), resolveClass: () => item, classVisibleToCaller: () => true,
    classAudience7355034: () => 'adult', audienceNotificationPolicy7355034: async () => ({}), audiencePolicyAllows7355034: () => true,
    touchAttendanceRevision: async () => {}, refreshTodayTabletSnapshot: async () => {}, FieldValue: { serverTimestamp: () => 'MOCK_TIME' },
    HttpsError: class extends Error { constructor(public code: string, message: string) { super(message); } },
    classScheduledOnDate: (cls: any,date: string) => cls.dates.includes(date), statusValue: (x: any) => x, canonicalSpecialStatus7355034: (x: any) => x || '',
    claimSpecialMessageJob735505: async (id: string) => { if (jobs.has(id)) return false; jobs.add(id); return true; }, completeSpecialMessageJob735505: async () => {},
    loadRecipients: async (uids: any) => uids, sendSolapiMessages: async (type: string,recipients: any,variables: any,_caller: any,dispatchKey: string) => { assert.ok(dispatchKey); notifications.push({ type, recipients, variables }); return { deliveryId: 'test-delivery' }; },
    global: {}, allClassesState735410: {}, document: { getElementById: (id: string) => elements[id] || null }, confirm: () => true, alert: (msg: string) => { throw Error(msg); }, requestId: () => randomUUID(), loadAllClassesData735410: async () => {},
    applyDueCourseApplications7355028: async () => {}, loadEnrollments: async () => [],
    CANONICAL_CURRENT_ROSTER_CUTOVER_7355015: '2026-08-01', REGISTRATION_SCHEDULE_CHANGE_LOOKBACK_DAYS_7355049: 90, MAX_STUDENTS: 5000, MAX_ATTENDANCE:6000, MAX_OVERRIDES:3000,
    studentOperational: () => true, studentAssignedToClass7355014: () => true, currentEnrollmentMetadata7355033: () => undefined,
    registrationEventDate7355048: () => '', canonicalRegistrationKind7355048: () => '', explicitSpecialAttendance7355014: () => false,
    resolveClassroom: async () => '', effectiveStudentData7355014: (student:any) => student,
    canonicalSessionSpecialStatus7355049: () => '', specialDisplayScope7355033: () => '', canonicalOutputRegistrationType7355049: () => '', updatedAtMs: () => 0,
    attendanceMatchesClass: (row:any,cls:any) => row.classId === cls.classId,
    teacherNameFor: () => 'X', classCoreKey: (x: any) => x,
    manualCurrentStatus: (x: any) => x || '', attendanceStatusOnly: (x: any) => x || '', specialStatusText: (x: any) => x || '',
    dateText: (x: any) => x, teacherScopeKey: () => 'base-scope', teacherScopeMatches: (a: any,b: any) => !b || a === b,
    recordVisibleToCaller: () => true, classMatchesFilter: () => true, backfillVisibleTeacherUid: async () => {}, readClassVideoLinkSetting7355024: async () => '',
    queryOperationalDocuments: async () => ({ docs: c.savedRows.map((data: any) => ({ data: () => data, ref: {} })), optimized: true }), savedRows: []
  };
  vm.createContext(c);
  const code = helpers.map(name => fn(backend,name)).join('\n') + '\nvar writer = ' + variable(backend, 'changeClassSessionAdmin73550') + ';\nvar attendanceWriter = ' + variable(backend, 'saveAttendanceRowsAdmin73550') + ';\n' +
    ['mapAttendanceDoc','mapDailyDoc','filters'].map(name => fn(dailyBackend,name)).join('\n') + '\nvar dailySnapshot = ' + variable(dailyBackend,'getStaffDailyEvaluationOperationalSnapshot') + ';\n' +
    ['dailyMatchKeys73116','dailySavedTime73116','preferDailySaved73116','dailyRosterRow','mergeDailyStrict'].map(name => fn(dailyFrontend,name)).join('\n') + '\n' +
    ['ledgerSessionAttendanceDate73550921','applyScheduleOperation735423'].map(name => fn(frontend,name)).join('\n') + '\n' +
    'function monthly(sortedDates, changes, item, previousStart, endDate) { const sessionMetaAll73550921 = ' + variable(backend,'sessionMetaAll73550921') + '; return ' + variable(backend,'sessionMeta') + '; }';
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, c, { timeout: 5000 });
  const op = (operation: string, extra: any = {}) => c.writer({ data: { operation, originalDate: A, classId: item.classId, targetDate: B, instructorUid: 'Y', instructorName: 'Y', startTime: '12:00', endTime: '13:00', sendNotification: false, requestId: randomUUID(), ...extra } });
  c.call = async (name: string,data: any) => { assert.equal(name, 'changeClassSessionAdmin73550'); return c.writer({ data }); };
  const ui = async (operation: string) => { c.allClassesState735410.scheduleContext = { group: item, session: c.sessionMetadata73551012(item,A,changes()) }; c.allClassesState735410.scheduleAction = operation; await c.applyScheduleOperation735423(); };
  return { c, docs, writes, changes, op, ui, notifications, conflicts: () => conflicts };
}
function expectState(h: ReturnType<typeof harness>, date: string, teacher: string) {
  const meta = h.c.sessionMetadata73551012(item,A,h.changes());
  assert.equal(h.c.attendanceLedgerActionDate73550921(meta), date);
  assert.equal(h.c.ledgerSessionAttendanceDate73550921(meta), date);
  assert.equal(meta.instructorUid, teacher);
  const classes = h.c.effectiveClassesForDate([item],date,h.changes()).classes;
  assert.equal(classes.length,1); assert.equal(classes[0].instructorUid,teacher);
  if (date !== A) assert.equal(h.c.effectiveClassesForDate([item],A,h.changes()).classes.length,0);
}
test('T1 base A/X', () => expectState(harness(),A,'X'));
test('T2 move B/X', async () => { const h=harness(); await h.op('move'); expectState(h,B,'X'); });
test('T3 substitute A/Y', async () => { const h=harness(); await h.op('substitute'); expectState(h,A,'Y'); });
test('T4 actual UI move then substitute B/Y and preserved time', async () => { const h=harness(); await h.ui('move'); await h.ui('substitute'); expectState(h,B,'Y'); assert.equal(h.changes()[0].startTime,'12:00'); });
test('T5 actual UI substitute then move B/Y', async () => { const h=harness(); await h.ui('substitute'); await h.ui('move'); expectState(h,B,'Y'); });
test('T6 replace substitute B/Z', async () => { const h=harness(); await h.op('move'); await h.op('substitute'); await h.op('substitute',{ instructorUid:'Z',instructorName:'Z' }); expectState(h,B,'Z'); });
test('T7 clear substitute preserves B', async () => { const h=harness(); await h.op('move'); await h.op('substitute'); await h.op('clear_substitute'); expectState(h,B,'X'); });
test('T8 clear move preserves Y', async () => { const h=harness(); await h.op('substitute'); await h.op('move'); await h.op('clear_move'); expectState(h,A,'Y'); });
test('T9 serialized reload preserves independent fields', async () => { const h=harness(); await h.op('move'); await h.op('substitute'); const reloaded=JSON.parse(JSON.stringify(h.changes())); const meta=h.c.sessionMetadata73551012(item,A,reloaded); assert.equal(meta.effectiveDate,B); assert.equal(meta.instructorName,'Y'); assert.equal(meta.isMoved,true); assert.equal(meta.isSubstitute,true); });
test('T10 actual attendance owner keeps canonical B identity and Y', async () => { const h=harness(); await h.op('move'); await h.op('substitute'); await h.c.attendanceWriter({ data:{ rows:[{ date:B,classId:item.classId,studentUid:'student-1',status:'출석' }] } }); const id='ATT_'+createHash('sha256').update([B,item.classId,'student-1'].join('\u001f')).digest('hex').slice(0,40); const row=h.docs.get('attendance/'+id); assert.ok(row); assert.equal(row.date,B); assert.equal(row.instructorUid,'Y'); });
test('T11 actual daily snapshot and UI preserve effective teacher and saved content', async () => {
  const h=harness(); await h.op('move'); await h.op('substitute');
  await h.c.attendanceWriter({data:{rows:[{date:B,classId:item.classId,studentUid:'student-1',status:'출석'}]}});
  const content={ lessonContent:'content',lessonAttitude:'attitude',teacherComment:'comment',videoLink:'video',evaluation:'evaluation' };
  h.c.savedRows=[{ date:B,sessionDate:B,classId:item.classId,className:item.className,teacherScopeKey:'base-scope',teacherUid:'X',instructor:'X',studentUid:'student-1',studentName:'Same Name',attendanceStatus:'결석',...content }];
  const snap=await h.c.dailySnapshot({data:{date:B,classId:item.classId,teacherScopeKey:'base-scope'}});
  assert.equal(snap.roster[0].teacherUid,'Y'); assert.equal(snap.roster[0].instructorName,'Y'); assert.equal(snap.rows[0].attendanceStatus,'출석');
  const merged=h.c.mergeDailyStrict(snap.roster,snap.rows,{date:B,classId:item.classId,className:item.className,teacherScopeKey:'base-scope'});
  assert.equal(merged[0].teacherUid,'Y'); assert.equal(merged[0].instructor,'Y'); assert.equal(merged[0].attendanceStatus,'출석');
  for(const [key,value] of Object.entries(content)) assert.equal(merged[0][key],value);
});
test('T12 notification variables use B/Y without real delivery', async () => { const h=harness(); await h.op('move'); await h.op('substitute',{sendNotification:true}); assert.equal(h.notifications.length,1); const n=h.notifications[0]; assert.equal(n.variables['수업일'],B); assert.equal(n.variables.instructorName,'Y'); assert.equal(n.recipients[0],'student-1'); });
test('T13 cancellation clear preserves B/Y', async () => { const h=harness(); await h.op('move'); await h.op('substitute'); await h.op('cancel'); assert.equal(h.changes()[0].isCancelled,true); assert.equal(h.c.effectiveClassesForDate([item],B,h.changes()).classes.length,0); await h.op('clear_cancel'); expectState(h,B,'Y'); });
test('T14 same request including older retry never rewrites or re-notifies', async () => { const h=harness(); await h.op('move',{requestId:'fixed',sendNotification:true}); const writes=h.writes.length; await h.op('move',{requestId:'fixed',sendNotification:true}); assert.equal(h.writes.length,writes); assert.equal(h.notifications.length,1); await h.op('substitute'); const later=h.writes.length; await h.op('move',{requestId:'fixed',sendNotification:true}); assert.equal(h.writes.length,later); expectState(h,B,'Y'); });
test('T15 optimistic transaction conflict retries compose both dimensions', async () => { const h=harness(); await Promise.all([h.op('move'),h.op('substitute')]); assert.ok(h.conflicts()>0); expectState(h,B,'Y'); assert.equal(h.changes().length,1); });
test('T16 monthly moved-in single occurrence with immutable original date', async () => { const h=harness(); await h.op('move',{targetDate:'2026-10-01'}); await h.op('substitute'); const both=h.c.monthly([A,'2026-10-01'],h.changes(),item,'2026-09-01','2026-10-31'); assert.equal(both.length,1); assert.equal(both[0].effectiveDate,'2026-10-01'); assert.equal(both[0].instructorName,'Y'); const incoming=h.c.monthly(['2026-10-01'],h.changes(),item,'2026-10-01','2026-11-30'); assert.equal(incoming.length,1); assert.equal(incoming[0].state,'moved_in'); assert.equal(incoming[0].originalDate,A); });
test('T17 legacy move/substitute/cancel and physically lost date', () => { const h=harness(); const legacy=(operation:string,extra:any={}) => h.c.normalizeScheduleChange73551012({originalDate:A,classId:item.classId,operation,targetDate:A,...extra},item); assert.equal(legacy('move',{targetDate:B}).effectiveDate,B); assert.equal(legacy('substitute',{instructorUid:'Y',instructorName:'Y'}).instructorUid,'Y'); assert.equal(legacy('cancel').isCancelled,true); assert.equal(legacy('substitute',{instructorUid:'Y'}).effectiveDate,A); });

test('T18 daily UID/scope isolation never matches names or merges evaluators', () => {
  const h=harness(),ctx={date:B,classId:item.classId,className:item.className,teacherScopeKey:'base-scope'};
  const row={...ctx,studentUid:'student-1',studentName:'Same Name',teacherUid:'Y',instructor:'Y'};
  const wrongStudent={...row,studentUid:'student-2',lessonContent:'other student'};
  const wrongScope={...row,teacherScopeKey:'other-scope',lessonContent:'other evaluator'};
  const result=h.c.mergeDailyStrict([row],[wrongStudent,wrongScope],ctx);
  assert.equal(result[0].lessonContent,'');
  assert.throws(()=>h.c.mergeDailyStrict([row],[{...row,teacherUid:'X'},{...row,teacherUid:'Y'}],ctx),/서로 다른 강사/);
});
test('T19 attendance cannot resurrect moved/cancelled occurrence', async () => {
  const h=harness(); await h.op('move');
  const save=(date:string)=>h.c.attendanceWriter({data:{rows:[{date,classId:item.classId,studentUid:'student-1',status:'출석'}]}});
  await assert.rejects(save(A)); await h.op('cancel'); await assert.rejects(save(B));
});
test('T20 pending notification resumes through actual durable job owner', async () => {
  const h=harness(); const refresh=h.c.refreshTodayTabletSnapshot;
  h.c.refreshTodayTabletSnapshot=async()=>{throw Error('simulated interruption before job');};
  await assert.rejects(h.op('move',{requestId:'resume',sendNotification:true}));
  const sessionWrites=()=>h.writes.filter(key=>key.startsWith('classScheduleChanges/')).length;
  assert.equal(sessionWrites(),1);
  h.c.refreshTodayTabletSnapshot=refresh;
  await h.op('move',{requestId:'resume',sendNotification:true});
  assert.equal(h.notifications.length,1); assert.equal(h.changes()[0].notificationState,'complete');
  const completed=sessionWrites(); await h.op('move',{requestId:'resume',sendNotification:true});
  assert.equal(sessionWrites(),completed); assert.equal(h.notifications.length,1);
});
test('T21 uncertain delivery is terminal and never automatically resent', async () => {
  const h=harness(); let attempts=0;
  h.c.sendSolapiMessages=async()=>{ attempts++; const error:any=Error('uncertain external response');error.ulimNoAutoRetry=true;throw error; };
  await h.op('move',{requestId:'uncertain',sendNotification:true});
  assert.equal(h.changes()[0].notificationState,'delivery_unknown');
  await h.op('move',{requestId:'uncertain',sendNotification:true}); assert.equal(attempts,1);
});
test('T22 independent time is preserved when only date is requested', async () => {
  const h=harness(); await h.op('move'); await h.op('move',{targetDate:'2026-09-09',startTime:undefined,endTime:undefined});
  assert.equal(h.changes()[0].startTime,'12:00'); assert.equal(h.changes()[0].endTime,'13:00');
});
test('T23 actual roster uses B/Y and cancellation notification retains recipients', async () => {
  const h=harness(); await h.op('move');await h.op('substitute');
  const a=await h.c.buildAttendanceRosterInternal7355014(null,{date:A,classId:item.classId});
  const b=await h.c.buildAttendanceRosterInternal7355014(null,{date:B,classId:item.classId});
  assert.equal(a.rows.length,0);assert.equal(b.rows.length,1);assert.equal(b.rows[0].teacherUid,'Y');assert.equal(b.rows[0].date,B);
  await h.op('cancel',{sendNotification:true});assert.equal(h.notifications[0].variables.date,B);assert.equal(h.notifications[0].variables.instructorName,'Y');assert.equal(h.notifications[0].recipients[0],'student-1');
});

test('T24 actual monthly header renders move, substitute and cancellation together', async () => {
  const h=harness(); await h.op('move');await h.op('substitute');await h.op('cancel');
  Object.assign(h.c,{isFullAdmin:()=>false,ledgerStudentsForMonth735429:()=>[],escapeHtml:(x:any)=>String(x),monthTitle7355033:(x:any)=>x,dateLabel7355033:(x:any)=>x,ledgerSessionWeekday73550921:()=> '화'});
  vm.runInContext(fn(frontend,'ledgerMonthBlockHtml735427'),h.c);
  const html=h.c.ledgerMonthBlockHtml735427(item,'2026-09',[h.c.sessionMetadata73551012(item,A,h.changes())],'current',false);
  assert.match(html,/<span>휴강<\/span>/);assert.match(html,/<span>수업일 변경<\/span>/);assert.match(html,/<span>대강 · YT<\/span>/);assert.ok(html.includes(B));
});
