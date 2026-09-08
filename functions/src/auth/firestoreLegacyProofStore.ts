import type { Firestore, Timestamp as AdminTimestamp } from "firebase-admin/firestore";
import {
  hashLegacyIdentifier,
  LEGACY_AUTH_MAX_TTL_MS,
  type AtomicLegacyProofVerifier,
  type ConsumedLegacyProof,
  type LegacyProofValidationOptions,
  verifyLegacyAuthProof
} from "./legacySessionBridge.js";

interface TimestampCtor {
  fromMillis(milliseconds: number): AdminTimestamp;
}

export class FirestoreLegacyProofStore implements AtomicLegacyProofVerifier {
  constructor(
    private readonly db: Firestore,
    private readonly hmacSecret: string,
    private readonly timestamp: TimestampCtor
  ) {}

  async consumeValidProof(rawProof: string, options: LegacyProofValidationOptions): Promise<ConsumedLegacyProof> {
    const verified = verifyLegacyAuthProof(rawProof, this.hmacSecret, {
      ...options,
      maxTtlMs: Math.min(options.maxTtlMs, LEGACY_AUTH_MAX_TTL_MS)
    });
    const jti = verified.jti;
    if (!jti) throw new Error("legacy proof jti is required");

    const docRef = this.db.collection("legacyAuthProofs").doc(verified.nonceHash);
    await this.db.runTransaction(async (transaction) => {
      const existing = await transaction.get(docRef);
      if (existing.exists) throw new Error("legacy proof already consumed");
      transaction.create(docRef, {
        jtiHash: verified.nonceHash,
        audience: verified.aud,
        role: verified.role,
        legacyUidHash: hashLegacyIdentifier(verified.legacyUid),
        canonicalUidHash: verified.firebaseUid
          ? hashLegacyIdentifier(verified.firebaseUid)
          : null,
        proofVersion: verified.firebaseUid ? 2 : 1,
        consumedAt: this.timestamp.fromMillis(options.now),
        expiresAt: this.timestamp.fromMillis(verified.expiresAt)
      });
    });

    return {
      ...verified,
      consumedAt: options.now
    };
  }
}
