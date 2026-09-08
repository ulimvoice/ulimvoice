import { createHash } from "node:crypto";
import {
  App,
  getApp,
  getApps,
  initializeApp
} from "firebase-admin/app";
import {
  getAuth,
  UserRecord
} from "firebase-admin/auth";
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  FieldPath,
  Firestore,
  Query,
  QueryDocumentSnapshot,
  getFirestore
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall
} from "firebase-functions/v2/https";

export const UID_COMPLEMENTARY_AUDIT_PHASE4B2C_VERSION =
  "2026-07-24.716.10-firestore-auth-assignment-complementary-audit-read-only";

const REGION = "asia-northeast3";
const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_MAX_DOCUMENTS = 10000;
const DEFAULT_DETAIL_LIMIT = 500;
const DEFAULT_AUTH_DETAIL_LIMIT = 500;
const DEFAULT_ASSIGNMENT_DETAIL_LIMIT = 500;
const MAX_DETAIL_LIMIT = 1000;
const MAX_SCAN_DOCUMENTS = 20000;
const MAX_RECURSION_DEPTH = 5;
const MAX_VALUE_RECURSION_DEPTH = 12;

const ALLOWED_ROOT_COLLECTIONS = Object.freeze([
  "users",
  "legacyAccounts",
  "students",
  "studentPrivateContacts",
  "teachers",
  "classes",
  "classMembers",
  "attendance",
  "practiceLogs",
  "roomReservations",
  "teacherAssignments",
  "adminAssignments",
  "mirrorState",
  "syncOperations",
  "studentSessions",
  "adminSessions"
] as const);

type AllowedRootCollection =
  (typeof ALLOWED_ROOT_COLLECTIONS)[number];

type ReferenceLocation =
  | "document_path"
  | "field_value"
  | "embedded_string"
  | "auth_uid"
  | "auth_claim";

type ValueFormat =
  | "legacy_student_uid"
  | "legacy_principal_uid"
  | "student_uid_v2"
  | "principal_uid_v2"
  | "safe_legacy_firebase_uid"
  | "firebase_uid_or_other"
  | "embedded_legacy_uid";

type ScopeClassification =
  | "production_canonical"
  | "production_noncanonical"
  | "test_kim_cheolsu"
  | "known_production_auth"
  | "unclassified";

interface AuditFinding {
  readonly source:
    | "firestore"
    | "firebase_auth";
  readonly rootCollection: string;
  readonly documentPath: string;
  readonly location: ReferenceLocation;
  readonly fieldPath?: string;
  readonly fieldName?: string;
  readonly valueFormat: ValueFormat;
  readonly value: string;
  readonly classification: ScopeClassification;
}

interface AssignmentInventoryEntry {
  readonly path: string;
  readonly assignmentRoot:
    | "teacherAssignments"
    | "adminAssignments";
  readonly principalPathUid: string;
  readonly classId: string;
  readonly active:
    | boolean
    | null;
  readonly classification:
    ScopeClassification;
}

interface AuthInventoryEntry {
  readonly uid: string;
  readonly disabled: boolean;
  readonly role: string;
  readonly roles: string[];
  readonly studentUid: string;
  readonly teacherUid: string;
  readonly adminUid: string;
  readonly principalUid: string;
  readonly legacyUid: string;
  readonly accountUid: string;
  readonly classification:
    ScopeClassification;
}

interface AuditInput {
  readonly collections?: string[];
  readonly maxDocuments?: number;
  readonly pageSize?: number;
  readonly detailOffset?: number;
  readonly detailLimit?: number;
  readonly assignmentDetailOffset?: number;
  readonly assignmentDetailLimit?: number;
  readonly authDetailOffset?: number;
  readonly authDetailLimit?: number;
  readonly expectedPlanDigest?: string;
  readonly previousAuditDigest?: string;
}

interface ScanState {
  readonly findings:
    Map<string, AuditFinding>;
  readonly assignments:
    Map<string, AssignmentInventoryEntry>;
  readonly authUsers:
    AuthInventoryEntry[];
  readonly documentsByRoot:
    Map<string, number>;
  readonly documentsByCollectionPath:
    Map<string, number>;
  readonly visitedCollections:
    Set<string>;
  documentsRead: number;
  assignmentDocumentsRead: number;
  authUsersRead: number;
  truncated: boolean;
}

const LEGACY_UID_TOKEN =
  /(?<![A-Z0-9])((?:STU|ADM)-\d{8}-[0-9A-F]{8})(?![A-Z0-9])/giu;

const SAFE_LEGACY_FIREBASE_UID_TOKEN =
  /legacy:(?:student|teacher|admin|superAdmin):[0-9a-f]{48}/giu;

const EXACT_LEGACY_STUDENT_UID =
  /^STU-\d{8}-[0-9A-F]{8}$/iu;

const EXACT_LEGACY_PRINCIPAL_UID =
  /^ADM-\d{8}-[0-9A-F]{8}$/iu;

const EXACT_STUDENT_UID_V2 =
  /^STU2_[0-9A-HJKMNP-TV-Z]{20,32}$/u;

const EXACT_PRINCIPAL_UID_V2 =
  /^PRN2_[0-9A-HJKMNP-TV-Z]{20,32}$/u;

const EXACT_SAFE_LEGACY_FIREBASE_UID =
  /^legacy:(?:student|teacher|admin|superAdmin):[0-9a-f]{48}$/u;

const UID_FIELD_NAME =
  /(?:^|\.)(?:uid|legacyUid|studentUid|teacherUid|instructorUid|adminUid|principalUid|accountUid|ownerUid|userUid|createdByUid|updatedByUid|instructorUids|uidAliases|legacyUids|studentIdentityKey)$/iu;

const PRODUCTION_CANONICAL_CLASS_IDS =
  new Set<string>([
    "legacy_be6cdec2e74913ad6a592337",
    "legacy_b6fad49fff01b4faec699a11",
    "legacy_6fc7aa0bea97feab00ededac",
    "legacy_01cf1f6aaba3410040b7c0d6",
    "legacy_223bffbeb57408d77cb6d6bb",
    "legacy_b97e046750e878aec1555d4b",
    "legacy_c62b2b8cfff6d58f937329f9"
  ]);

const PRODUCTION_NONCANONICAL_CLASS_IDS =
  new Set<string>([
    "legacy_302dc8a8ac78c1763a18e942",
    "legacy_ecf208092a43ec818932c97f"
  ]);

const TEST_CLASS_IDS =
  new Set<string>([
    "legacy_25021edbeb6d197d73557206",
    "legacy_3c6af9d5d902fd5ed0de7ea2"
  ]);

const TEST_PRINCIPAL_UIDS =
  new Set<string>([
    "ADM-20260706-C094822C"
  ]);

const TEST_FIREBASE_UIDS =
  new Set<string>([
    "legacy:teacher:6723191b51b41d9683289408ef8f1119b36c138386048802"
  ]);

const KNOWN_PRODUCTION_FIREBASE_UIDS =
  new Set<string>([
    "legacy:superAdmin:4ab445c8458b4c48da06b780e5beb42fcdea343ab8a4bf0f"
  ]);

function defaultAdminApp(): App {
  const existingDefault =
    getApps().find(
      (app) =>
        app.name === "[DEFAULT]"
    );

  return existingDefault
    ? getApp()
    : initializeApp();
}

function text(
  value: unknown
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function integer(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      Math.trunc(parsed)
    )
  );
}

function stringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(text)
    .filter(Boolean);
}

function uniqueStrings(
  values: readonly string[]
): string[] {
  return [
    ...new Set(
      values.filter(Boolean)
    )
  ].sort();
}

function isSuperAdmin(
  token: Record<string, unknown>
): boolean {
  const roles =
    stringArray(token.roles);

  return (
    text(token.role) === "superAdmin" ||
    text(token.ulimRole) === "superAdmin" ||
    text(token.accountRole) === "superAdmin" ||
    roles.includes("superAdmin")
  );
}

function requireSuperAdmin(
  auth:
    | {
        token: Record<string, unknown>;
      }
    | undefined
): void {
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "Firebase authentication is required."
    );
  }

  if (!isSuperAdmin(auth.token)) {
    throw new HttpsError(
      "permission-denied",
      "superAdmin claim is required."
    );
  }
}

function classifyExactValue(
  value: string
): ValueFormat {
  if (
    EXACT_LEGACY_STUDENT_UID.test(value)
  ) {
    return "legacy_student_uid";
  }

  if (
    EXACT_LEGACY_PRINCIPAL_UID.test(
      value
    )
  ) {
    return "legacy_principal_uid";
  }

  if (
    EXACT_STUDENT_UID_V2.test(value)
  ) {
    return "student_uid_v2";
  }

  if (
    EXACT_PRINCIPAL_UID_V2.test(value)
  ) {
    return "principal_uid_v2";
  }

  if (
    EXACT_SAFE_LEGACY_FIREBASE_UID.test(
      value
    )
  ) {
    return "safe_legacy_firebase_uid";
  }

  return "firebase_uid_or_other";
}

function extractLegacyUids(
  value: string
): string[] {
  return uniqueStrings(
    [
      ...value.matchAll(
        LEGACY_UID_TOKEN
      )
    ].map(
      (match) =>
        String(
          match[1] || ""
        ).toUpperCase()
    )
  );
}

function extractSafeLegacyFirebaseUids(
  value: string
): string[] {
  return uniqueStrings(
    value.match(
      SAFE_LEGACY_FIREBASE_UID_TOKEN
    ) || []
  );
}

function classifyScope(
  ...values: readonly string[]
): ScopeClassification {
  const joined =
    values.join("|");

  for (
    const value of values
  ) {
    if (
      TEST_PRINCIPAL_UIDS.has(value) ||
      TEST_FIREBASE_UIDS.has(value)
    ) {
      return "test_kim_cheolsu";
    }

    if (
      KNOWN_PRODUCTION_FIREBASE_UIDS.has(
        value
      )
    ) {
      return "known_production_auth";
    }
  }

  for (
    const classId of
    TEST_CLASS_IDS
  ) {
    if (joined.includes(classId)) {
      return "test_kim_cheolsu";
    }
  }

  for (
    const classId of
    PRODUCTION_NONCANONICAL_CLASS_IDS
  ) {
    if (joined.includes(classId)) {
      return "production_noncanonical";
    }
  }

  for (
    const classId of
    PRODUCTION_CANONICAL_CLASS_IDS
  ) {
    if (joined.includes(classId)) {
      return "production_canonical";
    }
  }

  return "unclassified";
}

function lastFieldName(
  fieldPath: string
): string {
  const segments =
    fieldPath.split(".");

  return (
    segments[
      segments.length - 1
    ] || fieldPath
  );
}

function findingKey(
  finding: AuditFinding
): string {
  return [
    finding.source,
    finding.rootCollection,
    finding.documentPath,
    finding.location,
    finding.fieldPath || "",
    finding.value
  ].join("|");
}

function pushFinding(
  state: ScanState,
  finding: AuditFinding
): void {
  state.findings.set(
    findingKey(finding),
    finding
  );
}

function inspectString(
  rootCollection: string,
  documentPath: string,
  fieldPath: string,
  value: string,
  state: ScanState
): void {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return;
  }

  const rawLegacy =
    extractLegacyUids(trimmed);

  const safeLegacy =
    extractSafeLegacyFirebaseUids(
      trimmed
    );

  for (
    const uid of rawLegacy
  ) {
    const exact =
      trimmed.toUpperCase() === uid;

    pushFinding(
      state,
      {
        source: "firestore",
        rootCollection,
        documentPath,
        location:
          exact
            ? "field_value"
            : "embedded_string",
        fieldPath,
        fieldName:
          lastFieldName(fieldPath),
        valueFormat:
          exact
            ? classifyExactValue(uid)
            : "embedded_legacy_uid",
        value: uid,
        classification:
          classifyScope(
            documentPath,
            fieldPath,
            uid
          )
      }
    );
  }

  for (
    const uid of safeLegacy
  ) {
    const exact =
      trimmed === uid;

    pushFinding(
      state,
      {
        source: "firestore",
        rootCollection,
        documentPath,
        location:
          exact
            ? "field_value"
            : "embedded_string",
        fieldPath,
        fieldName:
          lastFieldName(fieldPath),
        valueFormat:
          "safe_legacy_firebase_uid",
        value: uid,
        classification:
          classifyScope(
            documentPath,
            fieldPath,
            uid
          )
      }
    );
  }

  if (
    UID_FIELD_NAME.test(fieldPath) &&
    rawLegacy.length === 0 &&
    safeLegacy.length === 0
  ) {
    pushFinding(
      state,
      {
        source: "firestore",
        rootCollection,
        documentPath,
        location: "field_value",
        fieldPath,
        fieldName:
          lastFieldName(fieldPath),
        valueFormat:
          classifyExactValue(trimmed),
        value:
          trimmed.slice(0, 256),
        classification:
          classifyScope(
            documentPath,
            fieldPath,
            trimmed
          )
      }
    );
  }
}

function isRecordLike(
  value: unknown
): value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value instanceof Date ||
    value instanceof Uint8Array
  ) {
    return false;
  }

  return true;
}

function inspectValue(
  rootCollection: string,
  documentPath: string,
  fieldPath: string,
  value: unknown,
  state: ScanState,
  depth = 0,
  seen = new WeakSet<object>()
): void {
  if (
    depth >
    MAX_VALUE_RECURSION_DEPTH
  ) {
    return;
  }

  if (
    typeof value === "string"
  ) {
    inspectString(
      rootCollection,
      documentPath,
      fieldPath,
      value,
      state
    );

    return;
  }

  if (Array.isArray(value)) {
    value.forEach(
      (entry, index) => {
        inspectValue(
          rootCollection,
          documentPath,
          `${fieldPath}[${index}]`,
          entry,
          state,
          depth + 1,
          seen
        );
      }
    );

    return;
  }

  if (!isRecordLike(value)) {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  for (
    const [
      key,
      nested
    ] of Object.entries(value)
  ) {
    inspectValue(
      rootCollection,
      documentPath,
      fieldPath
        ? `${fieldPath}.${key}`
        : key,
      nested,
      state,
      depth + 1,
      seen
    );
  }
}

function inspectDocumentPath(
  rootCollection: string,
  documentPath: string,
  state: ScanState
): void {
  for (
    const uid of
    extractLegacyUids(documentPath)
  ) {
    pushFinding(
      state,
      {
        source: "firestore",
        rootCollection,
        documentPath,
        location:
          "document_path",
        valueFormat:
          classifyExactValue(uid),
        value: uid,
        classification:
          classifyScope(
            documentPath,
            uid
          )
      }
    );
  }

  for (
    const uid of
    extractSafeLegacyFirebaseUids(
      documentPath
    )
  ) {
    pushFinding(
      state,
      {
        source: "firestore",
        rootCollection,
        documentPath,
        location:
          "document_path",
        valueFormat:
          "safe_legacy_firebase_uid",
        value: uid,
        classification:
          classifyScope(
            documentPath,
            uid
          )
      }
    );
  }
}

function parseAssignmentPath(
  documentPath: string,
  data: DocumentData
): AssignmentInventoryEntry | null {
  const segments =
    documentPath.split("/");

  if (
    segments.length !== 4 ||
    segments[2] !== "classes"
  ) {
    return null;
  }

  const assignmentRoot =
    segments[0];

  if (
    assignmentRoot !==
      "teacherAssignments" &&
    assignmentRoot !==
      "adminAssignments"
  ) {
    return null;
  }

  return {
    path: documentPath,
    assignmentRoot,
    principalPathUid:
      segments[1],
    classId:
      segments[3],
    active:
      typeof data.active === "boolean"
        ? data.active
        : null,
    classification:
      classifyScope(
        documentPath,
        segments[1],
        segments[3]
      )
  };
}

async function inspectDocument(
  rootCollection: string,
  document:
    DocumentReference<DocumentData>,
  data: DocumentData,
  state: ScanState
): Promise<void> {
  inspectDocumentPath(
    rootCollection,
    document.path,
    state
  );

  inspectValue(
    rootCollection,
    document.path,
    "",
    data,
    state
  );

  const assignment =
    parseAssignmentPath(
      document.path,
      data
    );

  if (assignment) {
    state.assignments.set(
      assignment.path,
      assignment
    );
  }
}

async function scanDocument(
  rootCollection: string,
  document:
    DocumentReference<DocumentData>,
  data: DocumentData,
  depth: number,
  options: {
    pageSize: number;
    maxDocuments: number;
  },
  state: ScanState
): Promise<void> {
  if (
    state.documentsRead >=
    options.maxDocuments
  ) {
    state.truncated = true;
    return;
  }

  state.documentsRead += 1;

  state.documentsByRoot.set(
    rootCollection,
    (
      state.documentsByRoot.get(
        rootCollection
      ) || 0
    ) + 1
  );

  await inspectDocument(
    rootCollection,
    document,
    data,
    state
  );

  if (
    depth >=
    MAX_RECURSION_DEPTH
  ) {
    return;
  }

  const subcollections =
    await document.listCollections();

  for (
    const subcollection of
    subcollections
  ) {
    if (
      state.documentsRead >=
      options.maxDocuments
    ) {
      state.truncated = true;
      return;
    }

    await scanCollection(
      rootCollection,
      subcollection,
      depth + 1,
      options,
      state
    );
  }
}

async function scanCollection(
  rootCollection: string,
  collection:
    CollectionReference<DocumentData>,
  depth: number,
  options: {
    pageSize: number;
    maxDocuments: number;
  },
  state: ScanState
): Promise<void> {
  if (
    state.visitedCollections.has(
      collection.path
    )
  ) {
    return;
  }

  state.visitedCollections.add(
    collection.path
  );

  let lastDocument:
    QueryDocumentSnapshot<DocumentData>
    | undefined;

  while (
    state.documentsRead <
    options.maxDocuments
  ) {
    let query:
      Query<DocumentData> =
      collection
        .orderBy(
          FieldPath.documentId()
        )
        .limit(
          options.pageSize
        );

    if (lastDocument) {
      query = query.startAfter(
        lastDocument
      );
    }

    const snapshot =
      await query.get();

    if (snapshot.empty) {
      break;
    }

    state.documentsByCollectionPath.set(
      collection.path,
      (
        state.documentsByCollectionPath
          .get(collection.path) || 0
      ) +
      snapshot.size
    );

    for (
      const document of
      snapshot.docs
    ) {
      await scanDocument(
        rootCollection,
        document.ref,
        document.data(),
        depth,
        options,
        state
      );

      if (
        state.documentsRead >=
        options.maxDocuments
      ) {
        state.truncated = true;
        break;
      }
    }

    if (
      snapshot.size <
      options.pageSize ||
      state.truncated
    ) {
      break;
    }

    lastDocument =
      snapshot.docs[
        snapshot.docs.length - 1
      ];
  }
}

async function scanAssignmentCollectionGroup(
  db: Firestore,
  options: {
    pageSize: number;
  },
  state: ScanState
): Promise<void> {
  let lastDocument:
    QueryDocumentSnapshot<DocumentData>
    | undefined;

  while (true) {
    let query:
      Query<DocumentData> =
      db
        .collectionGroup("classes")
        .orderBy(
          FieldPath.documentId()
        )
        .limit(
          options.pageSize
        );

    if (lastDocument) {
      query = query.startAfter(
        lastDocument
      );
    }

    const snapshot =
      await query.get();

    if (snapshot.empty) {
      break;
    }

    for (
      const document of
      snapshot.docs
    ) {
      const path =
        document.ref.path;

      if (
        !path.startsWith(
          "teacherAssignments/"
        ) &&
        !path.startsWith(
          "adminAssignments/"
        )
      ) {
        continue;
      }

      state.assignmentDocumentsRead += 1;

      const rootCollection =
        path.startsWith(
          "teacherAssignments/"
        )
          ? "teacherAssignments"
          : "adminAssignments";

      await inspectDocument(
        rootCollection,
        document.ref,
        document.data(),
        state
      );
    }

    if (
      snapshot.size <
      options.pageSize
    ) {
      break;
    }

    lastDocument =
      snapshot.docs[
        snapshot.docs.length - 1
      ];
  }
}

function authRoles(
  claims:
    | Record<string, unknown>
    | undefined
): string[] {
  if (!claims) {
    return [];
  }

  return uniqueStrings([
    text(claims.role),
    text(claims.ulimRole),
    text(claims.accountRole),
    ...stringArray(
      claims.roles
    )
  ]);
}

function authEntry(
  user: UserRecord
): AuthInventoryEntry {
  const claims =
    user.customClaims || {};

  const roles =
    authRoles(claims);

  const values = [
    user.uid,
    text(claims.studentUid),
    text(claims.teacherUid),
    text(claims.adminUid),
    text(claims.principalUid),
    text(claims.legacyUid),
    text(claims.accountUid)
  ];

  return {
    uid: user.uid,
    disabled:
      user.disabled,
    role:
      text(claims.role) ||
      text(claims.ulimRole) ||
      text(claims.accountRole),
    roles,
    studentUid:
      text(claims.studentUid),
    teacherUid:
      text(claims.teacherUid),
    adminUid:
      text(claims.adminUid),
    principalUid:
      text(claims.principalUid),
    legacyUid:
      text(claims.legacyUid),
    accountUid:
      text(claims.accountUid),
    classification:
      classifyScope(
        ...values
      )
  };
}

function inspectAuthValue(
  userUid: string,
  fieldPath: string,
  value: string,
  state: ScanState
): void {
  if (!value) {
    return;
  }

  const rawLegacy =
    extractLegacyUids(value);

  const safeLegacy =
    extractSafeLegacyFirebaseUids(
      value
    );

  for (
    const uid of rawLegacy
  ) {
    pushFinding(
      state,
      {
        source:
          "firebase_auth",
        rootCollection:
          "firebaseAuthUsers",
        documentPath:
          `firebaseAuthUsers/${userUid}`,
        location:
          fieldPath === "uid"
            ? "auth_uid"
            : "auth_claim",
        fieldPath,
        fieldName:
          fieldPath,
        valueFormat:
          classifyExactValue(uid),
        value: uid,
        classification:
          classifyScope(
            userUid,
            fieldPath,
            uid
          )
      }
    );
  }

  for (
    const uid of safeLegacy
  ) {
    pushFinding(
      state,
      {
        source:
          "firebase_auth",
        rootCollection:
          "firebaseAuthUsers",
        documentPath:
          `firebaseAuthUsers/${userUid}`,
        location:
          fieldPath === "uid"
            ? "auth_uid"
            : "auth_claim",
        fieldPath,
        fieldName:
          fieldPath,
        valueFormat:
          "safe_legacy_firebase_uid",
        value: uid,
        classification:
          classifyScope(
            userUid,
            fieldPath,
            uid
          )
      }
    );
  }
}

async function scanFirebaseAuth(
  app: App,
  state: ScanState
): Promise<void> {
  const auth =
    getAuth(app);

  let pageToken:
    string
    | undefined;

  do {
    const page =
      await auth.listUsers(
        1000,
        pageToken
      );

    for (
      const user of page.users
    ) {
      const entry =
        authEntry(user);

      state.authUsers.push(
        entry
      );

      state.authUsersRead += 1;

      inspectAuthValue(
        entry.uid,
        "uid",
        entry.uid,
        state
      );

      inspectAuthValue(
        entry.uid,
        "studentUid",
        entry.studentUid,
        state
      );

      inspectAuthValue(
        entry.uid,
        "teacherUid",
        entry.teacherUid,
        state
      );

      inspectAuthValue(
        entry.uid,
        "adminUid",
        entry.adminUid,
        state
      );

      inspectAuthValue(
        entry.uid,
        "principalUid",
        entry.principalUid,
        state
      );

      inspectAuthValue(
        entry.uid,
        "legacyUid",
        entry.legacyUid,
        state
      );

      inspectAuthValue(
        entry.uid,
        "accountUid",
        entry.accountUid,
        state
      );
    }

    pageToken =
      page.pageToken;
  } while (pageToken);
}

function countBy(
  values: readonly string[]
): Record<string, number> {
  const result:
    Record<string, number> = {};

  for (
    const value of values
  ) {
    result[value] =
      (
        result[value] || 0
      ) + 1;
  }

  return result;
}

function sortedRecord(
  map: Map<string, number>
): Record<string, number> {
  return Object.fromEntries(
    [...map.entries()]
      .sort(
        (
          [left],
          [right]
        ) =>
          left.localeCompare(
            right
          )
      )
  );
}

function digestResult(
  value: unknown
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(value),
      "utf8"
    )
    .digest("hex");
}

function parseInput(
  value: unknown
) {
  const input =
    value &&
    typeof value === "object"
      ? value as AuditInput
      : {};

  const requestedCollections =
    Array.isArray(
      input.collections
    )
      ? input.collections
          .map(text)
          .filter(Boolean)
      : [];

  const allowed =
    new Set<string>(
      ALLOWED_ROOT_COLLECTIONS
    );

  const invalid =
    requestedCollections.filter(
      (collection) =>
        !allowed.has(collection)
    );

  if (invalid.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      `Unsupported collections: ${invalid.join(", ")}`
    );
  }

  return {
    collections:
      (
        requestedCollections.length > 0
          ? requestedCollections
          : [
              ...ALLOWED_ROOT_COLLECTIONS
            ]
      ) as AllowedRootCollection[],
    maxDocuments:
      integer(
        input.maxDocuments,
        DEFAULT_MAX_DOCUMENTS,
        1,
        MAX_SCAN_DOCUMENTS
      ),
    pageSize:
      integer(
        input.pageSize,
        DEFAULT_PAGE_SIZE,
        10,
        500
      ),
    detailOffset:
      integer(
        input.detailOffset,
        0,
        0,
        100000
      ),
    detailLimit:
      integer(
        input.detailLimit,
        DEFAULT_DETAIL_LIMIT,
        0,
        MAX_DETAIL_LIMIT
      ),
    assignmentDetailOffset:
      integer(
        input.assignmentDetailOffset,
        0,
        0,
        100000
      ),
    assignmentDetailLimit:
      integer(
        input.assignmentDetailLimit,
        DEFAULT_ASSIGNMENT_DETAIL_LIMIT,
        0,
        MAX_DETAIL_LIMIT
      ),
    authDetailOffset:
      integer(
        input.authDetailOffset,
        0,
        0,
        100000
      ),
    authDetailLimit:
      integer(
        input.authDetailLimit,
        DEFAULT_AUTH_DETAIL_LIMIT,
        0,
        MAX_DETAIL_LIMIT
      ),
    expectedPlanDigest:
      text(
        input.expectedPlanDigest
      ) || null,
    previousAuditDigest:
      text(
        input.previousAuditDigest
      ) || null
  };
}

function pageSlice<T>(
  items: readonly T[],
  offset: number,
  limit: number
) {
  const end =
    offset + limit;

  return {
    offset,
    limit,
    returned:
      items.slice(
        offset,
        end
      ).length,
    total:
      items.length,
    nextOffset:
      end < items.length
        ? end
        : null,
    items:
      items.slice(
        offset,
        end
      )
  };
}

export async function handleUidComplementaryAuditPhase4b2c(
  input: unknown,
  db: Firestore,
  app: App
) {
  const options =
    parseInput(input);

  const state: ScanState = {
    findings:
      new Map<
        string,
        AuditFinding
      >(),
    assignments:
      new Map<
        string,
        AssignmentInventoryEntry
      >(),
    authUsers: [],
    documentsByRoot:
      new Map<string, number>(),
    documentsByCollectionPath:
      new Map<string, number>(),
    visitedCollections:
      new Set<string>(),
    documentsRead: 0,
    assignmentDocumentsRead: 0,
    authUsersRead: 0,
    truncated: false
  };

  for (
    const rootCollection of
    options.collections
  ) {
    if (
      state.documentsRead >=
      options.maxDocuments
    ) {
      state.truncated = true;
      break;
    }

    await scanCollection(
      rootCollection,
      db.collection(
        rootCollection
      ),
      0,
      {
        pageSize:
          options.pageSize,
        maxDocuments:
          options.maxDocuments
      },
      state
    );
  }

  await scanAssignmentCollectionGroup(
    db,
    {
      pageSize:
        options.pageSize
    },
    state
  );

  await scanFirebaseAuth(
    app,
    state
  );

  const findings =
    [...state.findings.values()]
      .sort(
        (left, right) =>
          findingKey(left).localeCompare(
            findingKey(right)
          )
      );

  const assignments =
    [...state.assignments.values()]
      .sort(
        (left, right) =>
          left.path.localeCompare(
            right.path
          )
      );

  const authUsers =
    [...state.authUsers]
      .sort(
        (left, right) =>
          left.uid.localeCompare(
            right.uid
          )
      );

  const legacyDocumentPathFindings =
    findings.filter(
      (finding) =>
        finding.source ===
          "firestore" &&
        finding.location ===
          "document_path" &&
        (
          finding.valueFormat ===
            "legacy_student_uid" ||
          finding.valueFormat ===
            "legacy_principal_uid"
        )
    );

  const canonicalSummary = {
    version:
      UID_COMPLEMENTARY_AUDIT_PHASE4B2C_VERSION,
    collections:
      options.collections,
    firestore: {
      documentsRead:
        state.documentsRead,
      documentsByRoot:
        sortedRecord(
          state.documentsByRoot
        ),
      documentsByCollectionPath:
        sortedRecord(
          state.documentsByCollectionPath
        ),
      truncated:
        state.truncated
    },
    assignments: {
      collectionGroupDocumentsRead:
        state.assignmentDocumentsRead,
      inventoryCount:
        assignments.length,
      byRoot:
        countBy(
          assignments.map(
            (entry) =>
              entry.assignmentRoot
          )
        ),
      byClassification:
        countBy(
          assignments.map(
            (entry) =>
              entry.classification
          )
        )
    },
    firebaseAuth: {
      usersRead:
        state.authUsersRead,
      disabledCount:
        authUsers.filter(
          (user) =>
            user.disabled
        ).length,
      byClassification:
        countBy(
          authUsers.map(
            (user) =>
              user.classification
          )
        )
    },
    references: {
      findingCount:
        findings.length,
      uniqueValueCount:
        uniqueStrings(
          findings.map(
            (finding) =>
              finding.value
          )
        ).length,
      rawLegacyUidInDocumentPathCount:
        legacyDocumentPathFindings.length,
      bySource:
        countBy(
          findings.map(
            (finding) =>
              finding.source
          )
        ),
      byValueFormat:
        countBy(
          findings.map(
            (finding) =>
              finding.valueFormat
          )
        ),
      byLocation:
        countBy(
          findings.map(
            (finding) =>
              finding.location
          )
        ),
      byFieldName:
        countBy(
          findings
            .map(
              (finding) =>
                finding.fieldName || ""
            )
            .filter(Boolean)
        ),
      byClassification:
        countBy(
          findings.map(
            (finding) =>
              finding.classification
          )
        )
    }
  };

  const findingPage =
    pageSlice(
      findings,
      options.detailOffset,
      options.detailLimit
    );

  const assignmentPage =
    pageSlice(
      assignments,
      options.assignmentDetailOffset,
      options.assignmentDetailLimit
    );

  const authPage =
    pageSlice(
      authUsers,
      options.authDetailOffset,
      options.authDetailLimit
    );

  return {
    ok: true,
    version:
      UID_COMPLEMENTARY_AUDIT_PHASE4B2C_VERSION,
    mode:
      "firestore_auth_assignment_complementary_audit",
    generatedAt:
      new Date().toISOString(),
    writeOperations: 0,
    expectedPlanDigest:
      options.expectedPlanDigest,
    previousAuditDigest:
      options.previousAuditDigest,
    auditDigest:
      digestResult(
        canonicalSummary
      ),
    summary:
      canonicalSummary,
    detail: {
      offset:
        findingPage.offset,
      limit:
        findingPage.limit,
      returned:
        findingPage.returned,
      total:
        findingPage.total,
      nextOffset:
        findingPage.nextOffset,
      findings:
        findingPage.items
    },
    assignmentDetail: {
      offset:
        assignmentPage.offset,
      limit:
        assignmentPage.limit,
      returned:
        assignmentPage.returned,
      total:
        assignmentPage.total,
      nextOffset:
        assignmentPage.nextOffset,
      assignments:
        assignmentPage.items
    },
    authDetail: {
      offset:
        authPage.offset,
      limit:
        authPage.limit,
      returned:
        authPage.returned,
      total:
        authPage.total,
      nextOffset:
        authPage.nextOffset,
      users:
        authPage.items
    },
    classificationPolicy: {
      productionCanonicalClassIds:
        [...PRODUCTION_CANONICAL_CLASS_IDS],
      productionNoncanonicalClassIds:
        [...PRODUCTION_NONCANONICAL_CLASS_IDS],
      testClassIds:
        [...TEST_CLASS_IDS],
      testPrincipalUids:
        [...TEST_PRINCIPAL_UIDS],
      testFirebaseUids:
        [...TEST_FIREBASE_UIDS],
      knownProductionFirebaseUids:
        [...KNOWN_PRODUCTION_FIREBASE_UIDS]
    },
    safety: {
      firestoreWrites: 0,
      authWrites: 0,
      sheetsWrites: 0,
      uidChanges: 0,
      uidDeletes: 0,
      sessionsChanged: 0,
      assignmentChanges: 0
    },
    nextGate: {
      phase:
        "Phase 4C deterministic staged UID allocation plan",
      allocationCommitAllowed:
        false,
      reason:
        "Review document-ID references, assignment collection-group inventory, and Firebase Auth claims before generating a stable UID allocation plan."
    }
  };
}

export const auditUidReferencesPhase4b2cCallable =
  onCall(
    {
      region:
        REGION,
      timeoutSeconds:
        540,
      memory:
        "1GiB",
      enforceAppCheck:
        false
    },
    async (request) => {
      requireSuperAdmin(
        request.auth as
          | {
              token:
                Record<
                  string,
                  unknown
                >;
            }
          | undefined
      );

      const app =
        defaultAdminApp();

      const db =
        getFirestore(app);

      return handleUidComplementaryAuditPhase4b2c(
        request.data,
        db,
        app
      );
    }
  );
