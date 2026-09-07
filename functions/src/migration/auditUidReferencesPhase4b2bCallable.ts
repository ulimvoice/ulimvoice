import { createHash } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import {
  CollectionReference,
  DocumentData,
  DocumentReference,
  FieldPath,
  Firestore,
  getFirestore
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

export const UID_REFERENCE_AUDIT_PHASE4B2B_VERSION =
  "2026-07-16.716.08-firestore-uid-reference-audit-read-only";

const REGION = "asia-northeast3";
const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_MAX_DOCUMENTS = 5000;
const DEFAULT_DETAIL_LIMIT = 100;
const MAX_DETAIL_LIMIT = 200;
const MAX_SCAN_DOCUMENTS = 10000;
const MAX_RECURSION_DEPTH = 4;

const ALLOWED_ROOT_COLLECTIONS = Object.freeze([
  "users",
  "legacyAccounts",
  "students",
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
  | "embedded_string";

type ValueFormat =
  | "legacy_student_uid"
  | "legacy_principal_uid"
  | "student_uid_v2"
  | "principal_uid_v2"
  | "safe_legacy_firebase_uid"
  | "firebase_uid_or_other"
  | "embedded_legacy_uid";

interface AuditFinding {
  readonly rootCollection: string;
  readonly documentPath: string;
  readonly location: ReferenceLocation;
  readonly fieldPath?: string;
  readonly fieldName?: string;
  readonly valueFormat: ValueFormat;
  readonly value: string;
}

interface AuditInput {
  readonly collections?: string[];
  readonly maxDocuments?: number;
  readonly pageSize?: number;
  readonly detailOffset?: number;
  readonly detailLimit?: number;
  readonly expectedPlanDigest?: string;
}

interface ScanState {
  readonly findings: AuditFinding[];
  readonly documentsByRoot: Map<string, number>;
  readonly documentsByCollectionPath: Map<string, number>;
  readonly visitedCollections: Set<string>;
  documentsRead: number;
  truncated: boolean;
}

const LEGACY_STUDENT_UID =
  /\bSTU-\d{8}-[0-9A-F]{8}\b/giu;

const LEGACY_PRINCIPAL_UID =
  /\bADM-\d{8}-[0-9A-F]{8}\b/giu;

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
  /(?:^|\.)(?:uid|legacyUid|studentUid|teacherUid|instructorUid|adminUid|principalUid|accountUid|ownerUid|userUid|createdByUid|updatedByUid|instructorUids|uidAliases|legacyUids)$/iu;

function adminApp() {
  const defaultApp =
    getApps().find(
      (app) =>
        app.name === "[DEFAULT]"
    );

  return defaultApp
    ? getApp()
    : initializeApp();
}

function text(value: unknown): string {
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

function isSuperAdmin(
  token: Record<string, unknown>
): boolean {
  const roles = stringArray(
    token.roles
  );

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

function uniqueStrings(
  values: readonly string[]
): string[] {
  return [
    ...new Set(
      values.filter(Boolean)
    )
  ].sort();
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

function embeddedLegacyUids(
  value: string
): string[] {
  return uniqueStrings([
    ...(value.match(
      LEGACY_STUDENT_UID
    ) || []),
    ...(value.match(
      LEGACY_PRINCIPAL_UID
    ) || [])
  ].map(
    (uid) => uid.toUpperCase()
  ));
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

function pushFinding(
  state: ScanState,
  finding: AuditFinding
): void {
  state.findings.push(
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

  const embedded =
    embeddedLegacyUids(trimmed);

  for (const uid of embedded) {
    pushFinding(
      state,
      {
        rootCollection,
        documentPath,
        location:
          trimmed.toUpperCase() === uid
            ? "field_value"
            : "embedded_string",
        fieldPath,
        fieldName:
          lastFieldName(fieldPath),
        valueFormat:
          trimmed.toUpperCase() === uid
            ? classifyExactValue(uid)
            : "embedded_legacy_uid",
        value: uid
      }
    );
  }

  if (
    UID_FIELD_NAME.test(fieldPath) &&
    embedded.length === 0
  ) {
    pushFinding(
      state,
      {
        rootCollection,
        documentPath,
        location: "field_value",
        fieldPath,
        fieldName:
          lastFieldName(fieldPath),
        valueFormat:
          classifyExactValue(
            trimmed
          ),
        value:
          trimmed.slice(0, 256)
      }
    );
  }
}

function inspectValue(
  rootCollection: string,
  documentPath: string,
  fieldPath: string,
  value: unknown,
  state: ScanState
): void {
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
          state
        );
      }
    );

    return;
  }

  if (
    value &&
    typeof value === "object"
  ) {
    for (
      const [
        key,
        nested
      ] of Object.entries(
        value as Record<
          string,
          unknown
        >
      )
    ) {
      inspectValue(
        rootCollection,
        documentPath,
        fieldPath
          ? `${fieldPath}.${key}`
          : key,
        nested,
        state
      );
    }
  }
}

function inspectDocumentPath(
  rootCollection: string,
  documentPath: string,
  state: ScanState
): void {
  const rawLegacyUids =
    embeddedLegacyUids(
      documentPath
    );

  for (
    const uid of rawLegacyUids
  ) {
    pushFinding(
      state,
      {
        rootCollection,
        documentPath,
        location:
          "document_path",
        valueFormat:
          classifyExactValue(uid),
        value:
          uid
      }
    );
  }

  const segments =
    documentPath.split("/");

  for (
    const segment of segments
  ) {
    if (
      EXACT_SAFE_LEGACY_FIREBASE_UID
        .test(segment)
    ) {
      pushFinding(
        state,
        {
          rootCollection,
          documentPath,
          location:
            "document_path",
          valueFormat:
            "safe_legacy_firebase_uid",
          value:
            segment
        }
      );
    }
  }
}

async function scanDocument(
  db: Firestore,
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

  if (
    depth >=
    MAX_RECURSION_DEPTH
  ) {
    return;
  }

  const subcollections =
    await document.listCollections();

  for (
    const subcollection of subcollections
  ) {
    if (
      state.documentsRead >=
      options.maxDocuments
    ) {
      state.truncated = true;
      return;
    }

    await scanCollection(
      db,
      rootCollection,
      subcollection,
      depth + 1,
      options,
      state
    );
  }
}

async function scanCollection(
  db: Firestore,
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

  let lastDocumentId = "";

  while (
    state.documentsRead <
    options.maxDocuments
  ) {
    let query = collection
      .orderBy(
        FieldPath.documentId()
      )
      .limit(
        options.pageSize
      );

    if (lastDocumentId) {
      query = query.startAfter(
        lastDocumentId
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
      const document of snapshot.docs
    ) {
      await scanDocument(
        db,
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

    lastDocumentId =
      snapshot.docs[
        snapshot.docs.length - 1
      ].id;
  }
}

function parseInput(
  value: unknown
): Required<
  Pick<
    AuditInput,
    | "maxDocuments"
    | "pageSize"
    | "detailOffset"
    | "detailLimit"
  >
> & {
  collections:
    AllowedRootCollection[];
  expectedPlanDigest?: string;
} {
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

  const collections =
    (
      requestedCollections.length > 0
        ? requestedCollections
        : [
            ...ALLOWED_ROOT_COLLECTIONS
          ]
    ) as AllowedRootCollection[];

  return {
    collections,
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
    expectedPlanDigest:
      text(
        input.expectedPlanDigest
      ) || undefined
  };
}

function countBy<T extends string>(
  values: readonly T[]
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

export async function handleUidReferenceAuditPhase4b2b(
  input: unknown,
  db: Firestore
) {
  const options =
    parseInput(input);

  const state: ScanState = {
    findings: [],
    documentsByRoot:
      new Map<string, number>(),
    documentsByCollectionPath:
      new Map<string, number>(),
    visitedCollections:
      new Set<string>(),
    documentsRead: 0,
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
      db,
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

  const uniqueValues =
    uniqueStrings(
      state.findings.map(
        (finding) =>
          finding.value
      )
    );

  const byValueFormat =
    countBy(
      state.findings.map(
        (finding) =>
          finding.valueFormat
      )
    );

  const byLocation =
    countBy(
      state.findings.map(
        (finding) =>
          finding.location
      )
    );

  const byFieldName =
    countBy(
      state.findings
        .map(
          (finding) =>
            finding.fieldName || ""
        )
        .filter(Boolean)
    );

  const canonicalSummary = {
    version:
      UID_REFERENCE_AUDIT_PHASE4B2B_VERSION,
    collections:
      options.collections,
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
    findingCount:
      state.findings.length,
    uniqueValueCount:
      uniqueValues.length,
    byValueFormat,
    byLocation,
    byFieldName,
    truncated:
      state.truncated
  };

  const detailStart =
    options.detailOffset;

  const detailEnd =
    detailStart +
    options.detailLimit;

  const detail =
    state.findings.slice(
      detailStart,
      detailEnd
    );

  return {
    ok: true,
    version:
      UID_REFERENCE_AUDIT_PHASE4B2B_VERSION,
    mode:
      "firestore_uid_reference_audit",
    generatedAt:
      new Date().toISOString(),
    writeOperations: 0,
    expectedPlanDigest:
      options.expectedPlanDigest ||
      null,
    auditDigest:
      digestResult(
        canonicalSummary
      ),
    summary:
      canonicalSummary,
    detail: {
      offset:
        detailStart,
      limit:
        options.detailLimit,
      returned:
        detail.length,
      total:
        state.findings.length,
      nextOffset:
        detailEnd <
        state.findings.length
          ? detailEnd
          : null,
      findings:
        detail
    },
    safety: {
      firestoreWrites: 0,
      authWrites: 0,
      sheetsWrites: 0,
      uidChanges: 0,
      uidDeletes: 0,
      sessionsChanged: 0
    },
    nextGate: {
      phase:
        "Phase 4C staged UID allocation",
      allocationCommitAllowed:
        false,
      reason:
        "Review the complete Firestore reference audit and prepare deterministic alias/allocation plans first."
    }
  };
}

export const auditUidReferencesPhase4b2bCallable =
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

      const db =
        getFirestore(
          adminApp()
        );

      return handleUidReferenceAuditPhase4b2b(
        request.data,
        db
      );
    }
  );

