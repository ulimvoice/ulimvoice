import {createHash} from "node:crypto";
import {App,getApp,getApps,initializeApp} from "firebase-admin/app";
import {UserRecord,getAuth} from "firebase-admin/auth";
import {DocumentReference,Timestamp,getFirestore} from "firebase-admin/firestore";
import {HttpsError,onCall} from "firebase-functions/v2/https";

export const UID_V2_CUTOVER_APPROVAL_PHASE4C10_VERSION="2026-07-25.716.29-phase4c10-approval-auth-stable-state-source-recovery";
const REGION="asia-northeast3";
const REQUEST_ID="phase4c3-20260724142743-62e47ac1-8e06-4cf7-b379-25d2373fa42d";
const D={
 payload:"a3a7641e934772e39ea8241438517c1643435434c8636fbe00cbe415cc66ceae",fanout:"674e6d52c970711f2ad20bce7c5171289a30abd26c85c2f0143eefaeef2f8f47",c6:"88ae754641d3356f605ddd8593e7d3e3f6297286d2df294823833938df6e491e",
 preflight:"de241a819114f7541e7acc832adef80bdbd089b440b2c09676bb56c03afd49db",rollbackContract:"4adbc23d4312d0cededcee2ae5fb909256545c11ad5df840102fe2de83930983",
 rollbackSnapshot:"5f316b9695d04e8b156e2c9e24e7e03329a8e4365edd5e944d3d18aee279e457",sheetSnapshot:"e6eeb89912b8b96973be17e49e0710ede438691f335033e43349f07f4fc00a67",
 liveAudit:"ec11394a67544ca2fc6abb8b82fe37b4afa17201dbd31f4133f9787803650d7a",approval:"133bffe7ac4b93a2b828f6edb1a6d324157e82afdb2f78d527583e96f0e0bf19"
};
const COUNTS={"rollbackStudentRows":155,"rollbackPrincipalRows":12,"rollbackAttendanceDocuments":69,"rollbackAssignmentDocuments":14,"rollbackFirebaseAuthUsers":1,"inPlaceAttendancePlans":68} as const;
const TTL_SECONDS=600;
const CONFIRM="ARM_UID_V2_CUTOVER_APPROVAL_RECORD_ONLY";
type R=Record<string,unknown>;

function app():App{const x=getApps().find(a=>a.name==="[DEFAULT]");return x?getApp():initializeApp();}
function s(v:unknown):string{return typeof v==="string"?v.trim():"";}
function arr(v:unknown):string[]{return Array.isArray(v)?v.map(s).filter(Boolean):[];}
function superAdmin(auth:any):string{
 if(!auth)throw new HttpsError("unauthenticated","Authentication required.");
 const t=auth.token||{},ok=s(t.role)==="superAdmin"||s(t.ulimRole)==="superAdmin"||s(t.accountRole)==="superAdmin"||arr(t.roles).includes("superAdmin");
 if(!ok)throw new HttpsError("permission-denied","superAdmin required.");
 return auth.uid;
}
function canon(v:unknown):unknown{
 if(Array.isArray(v))return v.map(canon);
 if(v&&typeof v==="object"){const o:R={};for(const k of Object.keys(v as R).sort())o[k]=canon((v as R)[k]);return o;}
 return v;
}
function h(v:string):string{return createHash("sha256").update(v,"utf8").digest("hex");}
function ser(v:unknown):unknown{
 if(v instanceof Timestamp)return {__type:"Timestamp",seconds:v.seconds,nanoseconds:v.nanoseconds};
 if(v instanceof DocumentReference)return {__type:"DocumentReference",path:v.path};
 if(Buffer.isBuffer(v))return {__type:"Bytes",base64:v.toString("base64")};
 if(Array.isArray(v))return v.map(ser);
 if(v&&typeof v==="object"){const c=v as R;if(typeof c.latitude==="number"&&typeof c.longitude==="number")return {__type:"GeoPoint",latitude:c.latitude,longitude:c.longitude};const o:R={};for(const [k,n] of Object.entries(c))o[k]=ser(n);return o;}
 return v;
}
function digest(v:unknown):string{return h(JSON.stringify(canon(ser(v))));}
function authSnap(u:UserRecord):R{return {
 uid:u.uid,disabled:u.disabled,email:u.email||null,emailVerified:u.emailVerified,
 displayName:u.displayName||null,phoneNumber:u.phoneNumber||null,photoURL:u.photoURL||null,
 customClaims:u.customClaims||{},providerData:u.providerData.map(p=>({
  uid:p.uid,providerId:p.providerId,email:p.email||null,displayName:p.displayName||null,
  phoneNumber:p.phoneNumber||null,photoURL:p.photoURL||null
 })),
 metadata:{creationTime:u.metadata.creationTime,lastSignInTime:u.metadata.lastSignInTime||null,lastRefreshTime:u.metadata.lastRefreshTime||null},
 tokensValidAfterTime:u.tokensValidAfterTime,passwordMaterialIncluded:false,
 rollbackPolicy:"re_enable_existing_old_user_restore_claims_before_retiring_new_user"
};}
function stableAuth(v:unknown):R{
 const x=v&&typeof v==="object"&&!Array.isArray(v)?v as R:{};
 const m=x.metadata&&typeof x.metadata==="object"&&!Array.isArray(x.metadata)?x.metadata as R:{};
 const providers=Array.isArray(x.providerData)?x.providerData.map(item=>{
  const p=item&&typeof item==="object"&&!Array.isArray(item)?item as R:{};
  return {
   uid:s(p.uid),providerId:s(p.providerId),
   email:typeof p.email==="string"?p.email:null,
   displayName:typeof p.displayName==="string"?p.displayName:null,
   phoneNumber:typeof p.phoneNumber==="string"?p.phoneNumber:null,
   photoURL:typeof p.photoURL==="string"?p.photoURL:null
  };
 }).sort((a,b)=>(a.providerId+"|"+a.uid).localeCompare(b.providerId+"|"+b.uid)):[];
 const claims=x.customClaims&&typeof x.customClaims==="object"&&!Array.isArray(x.customClaims)?x.customClaims:{};
 return {
  uid:s(x.uid),disabled:x.disabled===true,
  email:typeof x.email==="string"?x.email:null,
  emailVerified:x.emailVerified===true,
  displayName:typeof x.displayName==="string"?x.displayName:null,
  phoneNumber:typeof x.phoneNumber==="string"?x.phoneNumber:null,
  photoURL:typeof x.photoURL==="string"?x.photoURL:null,
  customClaims:claims,providerData:providers,
  creationTime:typeof m.creationTime==="string"?m.creationTime:null,
  tokensValidAfterTime:typeof x.tokensValidAfterTime==="string"?x.tokensValidAfterTime:null,
  passwordMaterialIncluded:false
 };
}
async function authExists(uid:string):Promise<boolean>{
 try{await getAuth(app()).getUser(uid);return true;}catch(e:any){if(s(e?.code)==="auth/user-not-found")return false;throw e;}
}
async function audit(caller:string){
 const db=getFirestore(app()),auth=getAuth(app()),run=db.collection("uidV2StagingRuns").doc(REQUEST_ID);
 const [fm,rm,students,principals,att,assn,auths,plans,clones]=await Promise.all([
  run.collection("fanoutMeta").doc("allocation").get(),run.collection("rollbackMeta").doc("snapshot").get(),
  run.collection("rollbackStudentRows").get(),run.collection("rollbackPrincipalRows").get(),
  run.collection("rollbackAttendanceDocuments").get(),run.collection("rollbackAssignmentDocuments").get(),
  run.collection("rollbackFirebaseAuthUsers").get(),run.collection("inPlaceAttendancePlans").get(),
  run.collection("fanoutAttendanceMappings").get()
 ]);
 if(!fm.exists||!rm.exists)throw new HttpsError("not-found","Required staging metadata missing.");
 const f=fm.data()||{},r=rm.data()||{};
 const meta={
  caller:s(r.approvedByFirebaseUid)===caller,fanoutStatus:s(f.status)==="fanout_staged",
  rollbackStatus:s(r.status)==="rollback_snapshot_staged",payload:s(r.payloadDigest)===D.payload,
  fanout:s(r.fanoutDigest)===D.fanout,c6:s(r.phase4c6ContractDigest)===D.c6,
  preflight:s(r.preflightContractDigest)===D.preflight,rollbackContract:s(r.rollbackContractDigest)===D.rollbackContract,
  rollbackSnapshot:s(r.rollbackSnapshotDigest)===D.rollbackSnapshot,sheetSnapshot:s(r.sheetSnapshotDigest)===D.sheetSnapshot,
  blocked:r.actualUidCutoverAllowed===false
 };
 const cnt={
  rollbackStudentRows:students.size===COUNTS.rollbackStudentRows,
  rollbackPrincipalRows:principals.size===COUNTS.rollbackPrincipalRows,
  rollbackAttendanceDocuments:att.size===COUNTS.rollbackAttendanceDocuments,
  rollbackAssignmentDocuments:assn.size===COUNTS.rollbackAssignmentDocuments,
  rollbackFirebaseAuthUsers:auths.size===COUNTS.rollbackFirebaseAuthUsers,
  inPlaceAttendancePlans:plans.size===COUNTS.inPlaceAttendancePlans
 };
 const fa:string[]=[],fs:string[]=[],fp:string[]=[],fc:string[]=[],fu:string[]=[];
 for(const d of att.docs){const x=d.data(),src=await db.doc(s(x.sourcePath)).get();if(!src.exists||digest(src.data()||{})!==s(x.beforeDigest))fa.push(d.id);}
 for(const d of assn.docs){const x=d.data(),[src,tgt]=await Promise.all([db.doc(s(x.sourcePath)).get(),db.doc(s(x.targetPath)).get()]);if(!src.exists||tgt.exists||digest(src.data()||{})!==s(x.beforeDigest))fs.push(d.id);}
 for(const d of plans.docs){const x=d.data(),src=await db.doc(s(x.sourcePath)).get(),p=x.patch&&typeof x.patch==="object"?x.patch as R:{};if(!src.exists||digest(src.data()||{})!==s(x.beforeDigest)||!Object.keys(p).length||Number(x.changedFieldCount||0)<=0)fp.push(d.id);}
 for(const d of clones.docs){const x=d.data(),[src,tgt]=await Promise.all([db.doc(s(x.oldPath)).get(),db.doc(s(x.newPath)).get()]);if(!src.exists||tgt.exists)fc.push(d.id);}
 for(const d of auths.docs){const x=d.data(),u=await auth.getUser(s(x.sourceFirebaseUid)),b=x.beforeData&&typeof x.beforeData==="object"?x.beforeData as R:{};if(await authExists(s(x.targetFirebaseUid))||digest(stableAuth(authSnap(u)))!==digest(stableAuth(b))||b.passwordMaterialIncluded!==false)fu.push(d.id);}
 const failedMeta=Object.entries(meta).filter(([,v])=>!v).map(([k])=>k);
 const failedCounts=Object.entries(cnt).filter(([,v])=>!v).map(([k])=>k);
 const summary={
  metadataStable:!failedMeta.length,countsStable:!failedCounts.length,
  attendanceCount:att.size,attendanceStable:!fa.length,
  assignmentCount:assn.size,assignmentsStable:!fs.length,
  inPlaceAttendanceCount:plans.size,inPlaceAttendanceStable:!fp.length,
  attendanceCloneCount:clones.size,attendanceCloneStable:clones.size===1&&!fc.length,
  firebaseAuthCount:auths.size,firebaseAuthStable:auths.size===1&&!fu.length,
  failedMetadata:failedMeta,failedCounts,failedAttendance:fa,failedAssignments:fs,failedInPlace:fp,failedClone:fc,failedAuth:fu
 };
 const blocking:string[]=[];
 if(!summary.metadataStable)blocking.push("METADATA_DIGEST_MISMATCH");
 if(!summary.countsStable)blocking.push("ROLLBACK_COUNT_MISMATCH");
 if(!summary.attendanceStable)blocking.push("ATTENDANCE_SOURCE_DRIFT");
 if(!summary.assignmentsStable)blocking.push("ASSIGNMENT_SOURCE_DRIFT_OR_TARGET_COLLISION");
 if(!summary.inPlaceAttendanceStable)blocking.push("IN_PLACE_ATTENDANCE_PLAN_DRIFT");
 if(!summary.attendanceCloneStable)blocking.push("ATTENDANCE_CLONE_SOURCE_DRIFT_OR_TARGET_COLLISION");
 if(!summary.firebaseAuthStable)blocking.push("FIREBASE_AUTH_SOURCE_DRIFT_OR_TARGET_COLLISION");
 return {ready:!blocking.length,blocking,summary,summaryDigest:h(JSON.stringify(canon(summary)))};
}
function ms(v:unknown):number{return v instanceof Timestamp?v.toMillis():0;}
function out(x:R,duplicate:boolean,writes:number){
 const now=Date.now(),exp=ms(x.expiresAt),expired=!exp||now>=exp;
 const valid=s(x.status)==="armed"&&!expired&&s(x.approvalContractDigest)===D.approval&&x.actualUidCutoverAllowed===false;
 return {
  ok:true,version:UID_V2_CUTOVER_APPROVAL_PHASE4C10_VERSION,mode:"ten_minute_cutover_approval_record_only",
  requestId:REQUEST_ID,duplicate,writeOperations:writes,status:s(x.status),generation:Number(x.generation||0),
  approvalContractDigest:s(x.approvalContractDigest),liveAuditSummaryDigest:s(x.liveAuditSummaryDigest),
  approvalDigest:s(x.approvalDigest),approvedAtIso:s(x.approvedAtIso),expiresAtIso:s(x.expiresAtIso),
  ttlSeconds:TTL_SECONDS,expiresInSeconds:Math.max(0,Math.floor((exp-now)/1000)),valid,expired,
  liveAuditSummary:x.liveAuditSummary,
  safety:{approvalRecordWrites:writes,firestoreSourceWrites:0,sourceSheetWrites:0,activeUidRegistryWrites:0,attendanceWrites:0,assignmentWrites:0,firebaseAuthWrites:0,sessionChanges:0,commitCallableIncluded:false,sheetDriftCheckRequiredAtCommit:true,actualUidCutoverAllowed:false},
  nextGate:{phase:"Phase 4C-11 final commit dry-run only",allowed:valid,actualUidCutoverAllowed:false}
 };
}

export const armUidV2CutoverApprovalPhase4c10=onCall({region:REGION,timeoutSeconds:540,memory:"1GiB",enforceAppCheck:false},async req=>{
 const caller=superAdmin(req.auth),i=(req.data||{}) as any;
 if(s(i.requestId)!==REQUEST_ID||s(i.approvalContractDigest)!==D.approval||s(i.confirmPhrase)!==CONFIRM||i.confirmApprovalRecordOnly!==true||i.confirmNoCutover!==true)
  throw new HttpsError("failed-precondition","Phase 4C-10 arm gate failed.");
 const a=await audit(caller);if(!a.ready)throw new HttpsError("failed-precondition","Live drift audit blocked approval: "+a.blocking.join(", "));
 const db=getFirestore(app()),ref=db.collection("uidV2CutoverApprovals").doc(REQUEST_ID);
 let duplicate=false,writes=0,data:R={};
 await db.runTransaction(async tx=>{
  const snap=await tx.get(ref),now=Date.now();
  if(snap.exists){const e=snap.data()||{},same=s(e.approvalContractDigest)===D.approval&&s(e.approvedByFirebaseUid)===caller&&s(e.rollbackSnapshotDigest)===D.rollbackSnapshot;
   if(!same)throw new HttpsError("already-exists","Conflicting approval record.");
   if(s(e.status)==="armed"&&ms(e.expiresAt)>now){duplicate=true;data=e;return;}
  }
  const gen=(snap.exists?Number((snap.data()||{}).generation||0):0)+1;
  const approved=Timestamp.fromMillis(now),expires=Timestamp.fromMillis(now+TTL_SECONDS*1000);
  const approvedAtIso=new Date(approved.toMillis()).toISOString(),expiresAtIso=new Date(expires.toMillis()).toISOString();
  const approvalDigest=h(JSON.stringify(canon({requestId:REQUEST_ID,generation:gen,approvedByFirebaseUid:caller,approvedAtIso,expiresAtIso,approvalContractDigest:D.approval,liveAuditSummaryDigest:a.summaryDigest,rollbackSnapshotDigest:D.rollbackSnapshot})));
  data={version:UID_V2_CUTOVER_APPROVAL_PHASE4C10_VERSION,phase:"Phase 4C-10",mode:"ten_minute_cutover_approval_record_only",requestId:REQUEST_ID,status:"armed",generation:gen,approvedByFirebaseUid:caller,approvedAt:approved,approvedAtIso,expiresAt:expires,expiresAtIso,ttlSeconds:TTL_SECONDS,payloadDigest:D.payload,fanoutDigest:D.fanout,phase4c6ContractDigest:D.c6,preflightContractDigest:D.preflight,rollbackContractDigest:D.rollbackContract,rollbackSnapshotDigest:D.rollbackSnapshot,sheetSnapshotDigest:D.sheetSnapshot,liveAuditContractDigest:D.liveAudit,approvalContractDigest:D.approval,liveAuditSummary:a.summary,liveAuditSummaryDigest:a.summaryDigest,approvalDigest,approvalRecordWrites:1,activeUidRegistryWrites:0,sourceDataWrites:0,commitCallableIncluded:false,sheetDriftCheckRequiredAtCommit:true,actualUidCutoverAllowed:false};
  tx.set(ref,data);writes=1;
 });
 return out(data,duplicate,writes);
});

export const inspectUidV2CutoverApprovalPhase4c10=onCall({region:REGION,timeoutSeconds:60,memory:"256MiB",enforceAppCheck:false},async req=>{
 superAdmin(req.auth);const i=(req.data||{}) as any;
 if(s(i.requestId)!==REQUEST_ID||s(i.approvalContractDigest)!==D.approval)throw new HttpsError("failed-precondition","Phase 4C-10 inspect gate failed.");
 const snap=await getFirestore(app()).collection("uidV2CutoverApprovals").doc(REQUEST_ID).get();
 if(!snap.exists)throw new HttpsError("not-found","Approval record not found.");
 return out(snap.data()||{},true,0);
});
