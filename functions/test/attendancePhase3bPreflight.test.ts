import test from "node:test";
import assert from "node:assert/strict";
import type {
  StoredAttendanceMirrorDocument
} from "../src/mirror/attendanceMirrorPlan.js";
import {
  auditAttendancePhase3bScope,
  summarizeAttendancePhase3bAudits,
  type AttendancePhase3bAssignmentPresence,
  type AttendancePhase3bPreflightRepository
} from "../src/mirror/attendancePhase3bPreflight.js";
import {
  handleAttendancePhase3bPreflight,
  resolveAttendancePhase3bInstructorPrincipal,
  resolveAttendancePhase3bTeacherUid
} from "../src/mirror/auditAttendancePhase3bRolloutCallable.js";

class FakeRepository
implements AttendancePhase3bPreflightRepository {
  constructor(
    private readonly documents:
      StoredAttendanceMirrorDocument[] = [],
    private readonly presence:
      AttendancePhase3bAssignmentPresence = {
        admin: false,
        teacher: false,
        principal: {
          uid: "ADM-TEST-TEACHER",
          name: "테스트",
          accountRole: "teacher",
          source: "test"
        }
      }
  ) {}

  async loadScope() {
    return this.documents;
  }

  async assignmentPresence() {
    return this.presence;
  }
}

function row(
  overrides: Record<string, unknown> = {}
) {
  return {
    date: "2026-07-18",
    sessionDate: "2026-07-18",
    studentName: "테스트학생",
    studentUid: "STU-TEST-001",
    studentIdentityKey: "STU-TEST-001",
    instructor: "테스트T",
    teacherName: "테스트T",
    className: "토요일 테스트반",
    status: "O",
    attendanceStatus: "O",
    sourceSheet: "테스트T",
    sourceCell: "M7",
    sourceKey: "테스트T|M7",
    ...overrides
  };
}

test("new valid class is ready for initial controlled sync", async () => {
  const result = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "토요일 테스트반",
      requestedTeacher: "테스트T",
      records: [row()]
    },
    "admin",
    new FakeRepository()
  );

  assert.equal(
    result.status,
    "ready_initial_sync"
  );
  assert.equal(
    result.safeForControlledRollout,
    true
  );
  assert.match(
    result.canonicalClassId,
    /^legacy_[a-f0-9]{24}$/
  );
});

test("browser supplied classId is ignored and recomputed", async () => {
  const first = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "토요일 테스트반",
      records: [
        row({ classId: "browser_guess" })
      ]
    },
    "admin",
    new FakeRepository()
  );

  const second = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "토요일 테스트반",
      records: [row()]
    },
    "admin",
    new FakeRepository()
  );

  assert.equal(
    first.canonicalClassId,
    second.canonicalClassId
  );
  assert.notEqual(
    first.canonicalClassId,
    "browser_guess"
  );
});

test("mixed class identities are blocked", async () => {
  const result = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "토요일 테스트반",
      records: [
        row(),
        row({
          studentUid: "STU-TEST-002",
          sourceKey: "다른T|M8",
          sourceCell: "M8",
          className: "다른반",
          instructor: "다른T",
          teacherName: "다른T"
        })
      ]
    },
    "admin",
    new FakeRepository()
  );

  assert.equal(
    result.status,
    "blocked_ambiguous_class_identity"
  );
  assert.equal(
    result.safeForControlledRollout,
    false
  );
});

test("missing student UID is blocked by mirror validation", async () => {
  const result = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "토요일 테스트반",
      records: [row({ studentUid: "" })]
    },
    "admin",
    new FakeRepository()
  );

  assert.equal(
    result.status,
    "blocked_unsafe_records"
  );
  assert.equal(
    result.missingStudentUidCount,
    1
  );
});

test("empty class snapshot remains read-only review item", async () => {
  const result = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "빈 반",
      records: []
    },
    "admin",
    new FakeRepository()
  );

  assert.equal(result.status, "empty_source");
  assert.equal(
    result.safeForControlledRollout,
    false
  );
});

test("handler is superAdmin only and reports zero writes", async () => {
  await assert.rejects(
    () => handleAttendancePhase3bPreflight(
      {
        requestId:
          "phase3b-preflight-test-0001",
        scopes: [
          {
            date: "2026-07-18",
            requestedClassName:
              "토요일 테스트반",
            records: [row()]
          }
        ]
      },
      {
        uid: "teacher",
        role: "teacher"
      },
      new FakeRepository()
    ),
    /superAdmin/
  );

  const result =
    await handleAttendancePhase3bPreflight(
      {
        requestId:
          "phase3b-preflight-test-0002",
        scopes: [
          {
            date: "2026-07-18",
            requestedClassName:
              "토요일 테스트반",
            records: [row()]
          }
        ]
      },
      {
        uid: "admin",
        role: "superAdmin"
      },
      new FakeRepository(),
      new Date("2026-07-15T00:00:00.000Z")
    );

  assert.equal(result.writeOperations, 0);
  assert.equal(result.summary.ready, 1);
  assert.equal(
    result.instructorPrincipals.length,
    6
  );
  assert.equal(
    result.instructorPrincipals
      .find((item) => item.name === "이용우")
      ?.accountRole,
    "superAdmin"
  );
});

test("summary separates ready blocked and empty scopes", () => {
  const base = {
    date: "2026-07-18",
    requestedClassName: "x",
    requestedTeacher: "",
    canonicalClassName: "x",
    canonicalInstructor: "t",
    canonicalClassId: "legacy_x",
    matchedExistingPilotId: "",
    sourceCount: 1,
    acceptedCount: 1,
    rejectedCount: 0,
    missingStudentUidCount: 0,
    missingSourceKeyCount: 0,
    distinctIdentityCount: 1,
    existingActiveCount: 0,
    upsertCount: 1,
    unchangedCount: 0,
    staleCount: 0,
    missingIds: [],
    mismatchedIds: [],
    extraActiveIds: [],
    assignmentPresence: {
      admin: false,
      teacher: false,
      principal: {
        uid: "ADM-TEST-TEACHER",
        name: "테스트",
        accountRole: "teacher",
        source: "test"
      }
    },
    errors: [],
    warnings: []
  } as const;

  const summary = summarizeAttendancePhase3bAudits([
    {
      ...base,
      status: "ready_initial_sync",
      safeForControlledRollout: true
    },
    {
      ...base,
      status: "blocked_unsafe_records",
      safeForControlledRollout: false
    },
    {
      ...base,
      status: "empty_source",
      safeForControlledRollout: false
    }
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.ready, 1);
  assert.equal(summary.blocked, 1);
  assert.equal(summary.empty, 1);
});

test("verified UID replaces phone-derived legacy identity key", async () => {
  const result = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "토요일 테스트반",
      requestedTeacher: "테스트T",
      records: [
        row({
          studentUid: "STU-20260715-ABC12345",
          studentIdentityKey: "테스트학생|1234"
        })
      ]
    },
    "admin",
    new FakeRepository()
  );

  assert.equal(
    result.status,
    "ready_initial_sync"
  );
  assert.equal(
    result.safeForControlledRollout,
    true
  );
  assert.equal(
    result.rejectedCount,
    0
  );
  assert.equal(
    result.errors.length,
    0
  );
  assert.match(
    result.missingIds[0] || "",
    /uid_STU-20260715-ABC12345$/u
  );
});

test("existing safe identity key remains stable", async () => {
  const result = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "토요일 테스트반",
      requestedTeacher: "테스트T",
      records: [
        row({
          studentUid: "STU-TEST-SAFE-001",
          studentIdentityKey:
            "UID_existing_safe_key"
        })
      ]
    },
    "admin",
    new FakeRepository()
  );

  assert.equal(
    result.status,
    "ready_initial_sync"
  );
  assert.match(
    result.missingIds[0] || "",
    /UID_existing_safe_key$/u
  );
});

test("instructor principal map accepts teacher and administrator accounts", () => {
  assert.equal(
    resolveAttendancePhase3bTeacherUid(
      "김하은T"
    ),
    "ADM-20260610-0213CFC6"
  );

  assert.equal(
    resolveAttendancePhase3bTeacherUid(
      "박소연 강사"
    ),
    "ADM-20260610-2F79885A"
  );

  assert.equal(
    resolveAttendancePhase3bTeacherUid(
      "안수현"
    ),
    "ADM-20260617-2939B288"
  );

  assert.equal(
    resolveAttendancePhase3bTeacherUid(
      "박성광T"
    ),
    "ADM-20260623-4E3CFB75"
  );

  const yongwoo =
    resolveAttendancePhase3bInstructorPrincipal(
      "이용우T"
    );

  assert.equal(
    yongwoo?.uid,
    "ADM-20260604-90A754C4"
  );
  assert.equal(
    yongwoo?.accountRole,
    "superAdmin"
  );

  const yangseulgi =
    resolveAttendancePhase3bInstructorPrincipal(
      "양슬기 강사"
    );

  assert.equal(
    yangseulgi?.uid,
    "ADM-20260606-DAD09658"
  );
  assert.equal(
    yangseulgi?.accountRole,
    "superAdmin"
  );

  assert.equal(
    resolveAttendancePhase3bTeacherUid(
      "등록되지않은강사T"
    ),
    ""
  );
});

test("safe records are blocked when instructor principal UID is unresolved", async () => {
  const result = await auditAttendancePhase3bScope(
    {
      date: "2026-07-18",
      requestedClassName: "토요일 테스트반",
      requestedTeacher: "미등록강사T",
      records: [
        row({
          instructor: "미등록강사T",
          teacherName: "미등록강사T"
        })
      ]
    },
    "admin",
    new FakeRepository(
      [],
      {
        admin: false,
        teacher: false,
        principal: {
          uid: "",
          name: "미등록강사",
          accountRole: "unknown",
          source: ""
        }
      }
    )
  );

  assert.equal(
    result.status,
    "blocked_unresolved_instructor_principal"
  );
  assert.equal(
    result.safeForControlledRollout,
    false
  );
  assert.match(
    result.warnings.join("\\n"),
    /principal UID is unresolved/u
  );
});

