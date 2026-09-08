import test from "node:test";
import assert from "node:assert/strict";
import { canReadClass, canReadClassMember, canReadStudentRecord, minimalCustomClaims } from "../src/common/roles.js";

test("student can read only own record", () => {
  assert.equal(canReadStudentRecord({ uid: "u1", role: "student", studentUid: "s1" }, { studentUid: "s1" }), true);
  assert.equal(canReadStudentRecord({ uid: "u1", role: "student", studentUid: "s1" }, { studentUid: "s2" }), false);
});

test("teacher class access requires assignment", () => {
  assert.equal(canReadClass({ uid: "u2", role: "teacher", teacherUid: "t1" }, "c1", { teacherClassIds: ["c1"] }), true);
  assert.equal(canReadClass({ uid: "u2", role: "teacher", teacherUid: "t1" }, "c2", { teacherClassIds: ["c1"] }), false);
});

test("admin scope is denied unless explicit assignment exists", () => {
  assert.equal(canReadClass({ uid: "u3", role: "admin" }, "c1", {}), false);
  assert.equal(canReadClass({ uid: "u3", role: "admin" }, "c1", { adminClassIds: ["c1"] }), true);
  assert.equal(canReadStudentRecord({ uid: "u3", role: "admin" }, { studentUid: "s1" }, { adminClassIds: ["c1"] }), false);
});

test("minimal custom claims exclude dynamic scope lists", () => {
  const claims = minimalCustomClaims({ uid: "u3", role: "admin" });
  assert.deepEqual(claims, { role: "admin" });
  assert.equal("adminScopeIds" in claims, false);
  assert.equal("studentUid" in claims, false);
  assert.equal("teacherUid" in claims, false);
});

test("class membership reads require active membership and assignment", () => {
  assert.equal(
    canReadClassMember(
      { uid: "teacher", role: "teacher", teacherUid: "t1" },
      { classId: "c1", studentUid: "s1", active: true },
      { teacherClassIds: ["c1"] }
    ),
    true
  );
  assert.equal(
    canReadClassMember(
      { uid: "teacher", role: "teacher", teacherUid: "t1" },
      { classId: "c1", studentUid: "s1", active: false },
      { teacherClassIds: ["c1"] }
    ),
    false
  );
  assert.equal(
    canReadClassMember({ uid: "student", role: "student", studentUid: "s1" }, { classId: "c9", studentUid: "s1", active: true }),
    true
  );
});
