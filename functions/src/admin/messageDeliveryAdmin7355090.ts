import { createHmac, randomUUID } from "node:crypto";
import { FieldValue, getFirestore, type DocumentData, type DocumentSnapshot } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import { getOrInitializeDefaultFirebaseAdminApp } from "../common/firebaseAdminApp.js";
import { ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS } from "../realtime/realtimeCallableOptions.js";

export const MESSAGE_DELIVERY_ADMIN_7355090_VERSION = "2026-08-24.7355090-admin-alimtalk-delivery-history";
const ULIM_SOLAPI_OPERATIONAL_CONFIG_7355090 = defineSecret("ULIM_SOLAPI_OPERATIONAL_CONFIG");
const CALLABLE_OPTIONS = Object.freeze({ ...ULIM_PUBLIC_REALTIME_CALLABLE_OPTIONS, cors: true, invoker: "public" as const });
const STATUS_OPTIONS = Object.freeze({ ...CALLABLE_OPTIONS, timeoutSeconds: 120, memory: "512MiB" as const, secrets: [ULIM_SOLAPI_OPERATIONAL_CONFIG_7355090] });

type PlainObject = Record<string, unknown>;
type AdminActor7355090 = { uid: string; role: "admin" | "superAdmin"; name: string };

function app(){ return getOrInitializeDefaultFirebaseAdminApp(); }
function db(){ return getFirestore(app()); }
function object(v: unknown): PlainObject { return v && typeof v === "object" && !Array.isArray(v) ? v as PlainObject : {}; }
function text(v: unknown, max=1000): string { return String(v ?? "").trim().slice(0,max); }
function digits(v: unknown): string { return text(v,100).replace(/\D/g,""); }
function unique(values: unknown[], max=500): string[] { return Array.from(new Set(values.map(v=>text(v,max)).filter(Boolean))); }
function maskPhone(v: unknown, fallbackTail=""): string {
  const p=digits(v); if(p.length>=10) return `${p.slice(0,3)}-****-${p.slice(-4)}`;
  const tail=digits(fallbackTail).slice(-4); return tail?`***-****-${tail}`:"";
}
function kstDateBounds(startInput: unknown,endInput: unknown){
  const today=new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
  const monthStart=today.slice(0,8)+"01";
  const startDate=/^\d{4}-\d{2}-\d{2}$/.test(text(startInput,20))?text(startInput,20):monthStart;
  const endDate=/^\d{4}-\d{2}-\d{2}$/.test(text(endInput,20))?text(endInput,20):today;
  if(startDate>endDate) throw new HttpsError("invalid-argument","조회 시작일은 종료일보다 늦을 수 없습니다.");
  const startMs=Date.parse(startDate+"T00:00:00+09:00"), endMs=Date.parse(endDate+"T23:59:59.999+09:00");
  if(!Number.isFinite(startMs)||!Number.isFinite(endMs)) throw new HttpsError("invalid-argument","조회 기간이 올바르지 않습니다.");
  if(endMs-startMs>366*24*60*60*1000) throw new HttpsError("invalid-argument","한 번에 조회할 수 있는 기간은 최대 1년입니다.");
  return {startMs,endMs,startDate,endDate};
}
async function requireFullAdmin7355090(request: CallableRequest<unknown>): Promise<AdminActor7355090>{
  if(!request.auth) throw new HttpsError("unauthenticated","로그인이 필요합니다.");
  const uid=text(request.auth.uid,128), roleRaw=text(request.auth.token.role,40);
  if(roleRaw!=="admin"&&roleRaw!=="superAdmin") throw new HttpsError("permission-denied","전체관리자 권한이 필요합니다.");
  const snap=await db().collection("users").doc(uid).get();
  if(!snap.exists) throw new HttpsError("permission-denied","활성 관리자 정보가 없습니다.");
  const user=snap.data()??{};
  if(user.active!==true||text(user.role,40)!==roleRaw) throw new HttpsError("permission-denied","관리자 권한이 변경되었습니다.");
  return {uid,role:roleRaw,name:text(user.name??user.displayName??request.auth.token.name,120)};
}
function extractResultMessages7355090(delivery: PlainObject): PlainObject[]{
  const stored=delivery.solapiStatusSnapshot7355090;
  if(Array.isArray(stored)&&stored.length) return stored.map(object);
  const raw=object(delivery.result).messageList;
  if(Array.isArray(raw)) return raw.map(object);
  if(raw&&typeof raw==="object") return Object.values(raw as Record<string,unknown>).map(object);
  return [];
}
function messageIdsForDelivery7355090(delivery: PlainObject): string[]{ return unique(extractResultMessages7355090(delivery).map(row=>row.messageId),200).slice(0,500); }
function stateFromMessage7355090(message: PlainObject): "delivered"|"sending"|"accepted"|"failed"{
  const code=text(message.statusCode,20), status=text(message.status,30).toUpperCase();
  if(code==="4000") return "delivered";
  if(code==="3000"||status==="SENDING") return "sending";
  if(code==="2000"||status==="PENDING") return "accepted";
  if(/^1\d{3}$/.test(code)) return "failed";
  if(/^2\d{3}$/.test(code)) return code==="2000"?"accepted":"failed";
  if(/^3\d{3}$/.test(code)) return code==="3000"?"sending":"failed";
  if(status==="COMPLETE") return code==="4000"?"delivered":"failed";
  return "accepted";
}
function aggregateState7355090(messages: PlainObject[],fallbackOk=true): "delivered"|"sending"|"accepted"|"failed"{
  if(!messages.length) return fallbackOk?"accepted":"failed";
  const states=messages.map(stateFromMessage7355090);
  if(states.some(s=>s==="failed")) return "failed";
  if(states.every(s=>s==="delivered")) return "delivered";
  if(states.some(s=>s==="sending")) return "sending";
  return "accepted";
}
function reason7355090(m: PlainObject){ return text(m.reason??m.statusMessage??m.message,1000); }
async function loadStudentNames7355090(uids:string[]):Promise<Map<string,string>>{
  const out=new Map<string,string>(), safe=unique(uids,160).slice(0,500); if(!safe.length)return out;
  const refs=safe.map(uid=>db().collection("students").doc(uid)); const snaps=await db().getAll(...refs);
  snaps.forEach((snap,index)=>{const data=snap.data()??{},uid=safe[index]||snap.id,name=text(data.name??data.studentName??data.displayName,120);if(uid&&name)out.set(uid,name);});
  return out;
}
function deliveryRows7355090(deliveryId:string,delivery:PlainObject,studentNames:Map<string,string>):PlainObject[]{
  const recipients=Array.isArray(delivery.recipients)?delivery.recipients.map(object):[];
  const messages=extractResultMessages7355090(delivery);
  const count=Math.max(Number(delivery.requestCount||0),recipients.length,messages.length,1);
  const aggregate=text(delivery.deliveryState7355090,30)||aggregateState7355090(messages,delivery.ok!==false);
  const rows:PlainObject[]=[];
  for(let i=0;i<count;i++){
    const r=recipients[i]||{},m=messages[i]||{},studentUid=text(r.studentUid,160),state=text(m.messageId,200)?stateFromMessage7355090(m):aggregate;
    rows.push({
      rowKey:`${deliveryId}:${text(m.messageId,200)||i}`,deliveryId,createdAtMs:Number(delivery.createdAtMs||0),
      type:text(delivery.type,80),templateKey:text(delivery.templateKey,100),templateId:text(delivery.templateId,200),actorName:text(delivery.actorName,120),
      studentUid,studentName:studentNames.get(studentUid)||"",recipientTarget:text(r.target,40),phoneMasked:maskPhone(m.to,text(r.phoneTail,20)),
      messageId:text(m.messageId,200),groupId:text(m.groupId,200),status:text(m.status,40),statusCode:text(m.statusCode,20),reason:reason7355090(m),state,
      messageText:text(m.text,5000),dateCreated:text(m.dateCreated,80),dateProcessed:text(m.dateProcessed,80),dateReported:text(m.dateReported,80),dateReceived:text(m.dateReceived,80),
      lastStatusSyncAtMs:Number(delivery.lastStatusSyncAtMs7355090||0)
    });
  }
  return rows;
}
function searchText7355090(row:PlainObject):string{
  return [row.studentName,row.studentUid,row.type,row.recipientTarget,row.phoneMasked,row.statusCode,row.reason,row.messageId,row.messageText,row.actorName].map(v=>text(v,5000).toLowerCase()).join(" ");
}

export const listMessageDeliveriesAdmin7355090=onCall({...CALLABLE_OPTIONS,timeoutSeconds:120,memory:"512MiB"},async request=>{
  await requireFullAdmin7355090(request);
  const input=object(request.data),{startMs,endMs,startDate,endDate}=kstDateBounds(input.startDate,input.endDate);
  const typeFilter=text(input.type,80),stateFilter=text(input.state,30),keyword=text(input.search,200).toLowerCase(),limit=Math.min(500,Math.max(20,Number(input.limit||300)));
  const snap=await db().collection("messageDeliveries").where("createdAtMs",">=",startMs).where("createdAtMs","<=",endMs).orderBy("createdAtMs","desc").limit(limit).get();
  const docs=snap.docs.map(doc=>({id:doc.id,data:doc.data() as PlainObject}));
  const studentUids=docs.flatMap(item=>(Array.isArray(item.data.recipients)?item.data.recipients.map(object):[]).map(r=>text(r.studentUid,160))).filter(Boolean);
  const studentNames=await loadStudentNames7355090(studentUids);
  let rows=docs.flatMap(item=>deliveryRows7355090(item.id,item.data,studentNames));
  if(typeFilter) rows=rows.filter(row=>text(row.type,80)===typeFilter);
  if(stateFilter) rows=rows.filter(row=>text(row.state,30)===stateFilter);
  if(keyword) rows=rows.filter(row=>searchText7355090(row).includes(keyword));
  const summary={total:rows.length,delivered:rows.filter(r=>r.state==="delivered").length,sending:rows.filter(r=>r.state==="sending").length,accepted:rows.filter(r=>r.state==="accepted").length,failed:rows.filter(r=>r.state==="failed").length};
  const syncCandidates=unique(rows.filter(r=>(r.state==="accepted"||r.state==="sending")&&text(r.messageId,200)).map(r=>r.deliveryId),200).slice(0,100);
  return {ok:true,startDate,endDate,rows:rows.slice(0,1000),summary,syncCandidates,version:MESSAGE_DELIVERY_ADMIN_7355090_VERSION};
});

function parseSolapiCredentials7355090(){
  const raw=ULIM_SOLAPI_OPERATIONAL_CONFIG_7355090.value()||process.env.ULIM_SOLAPI_OPERATIONAL_CONFIG||"";
  if(!raw) throw new HttpsError("failed-precondition","SOLAPI 설정을 찾지 못했습니다.");
  let data:PlainObject={}; try{data=object(JSON.parse(raw));}catch{throw new HttpsError("failed-precondition","SOLAPI 설정 형식이 올바르지 않습니다.");}
  const apiKey=text(data.apiKey,200),apiSecret=text(data.apiSecret,300);
  if(!apiKey||!apiSecret) throw new HttpsError("failed-precondition","SOLAPI API 설정이 완전하지 않습니다.");
  return {apiKey,apiSecret};
}
function auth7355090(apiKey:string,apiSecret:string){
  const date=new Date().toISOString(),salt=randomUUID().replace(/-/g,""),signature=createHmac("sha256",apiSecret).update(date+salt,"utf8").digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}
async function fetchSolapiMessages7355090(messageIds:string[]):Promise<Map<string,PlainObject>>{
  const {apiKey,apiSecret}=parseSolapiCredentials7355090(),out=new Map<string,PlainObject>();
  for(let i=0;i<messageIds.length;i+=100){
    const chunk=messageIds.slice(i,i+100),query=new URLSearchParams({messageIds:JSON.stringify(chunk),limit:String(Math.min(500,Math.max(20,chunk.length)))});
    const response=await fetch(`https://api.solapi.com/messages/v4/list?${query.toString()}`,{method:"GET",headers:{Authorization:auth7355090(apiKey,apiSecret),Accept:"application/json"},signal:AbortSignal.timeout(45000)});
    const raw=await response.text(); let parsed:PlainObject={}; try{parsed=object(JSON.parse(raw));}catch{parsed={raw};}
    if(!response.ok) throw new HttpsError("unavailable",`SOLAPI 발송결과 조회 실패(${response.status}): ${text(parsed.message??parsed.errorMessage??raw,600)}`);
    const list=parsed.messageList;
    if(list&&typeof list==="object"&&!Array.isArray(list)) Object.entries(list as Record<string,unknown>).forEach(([id,v])=>{const row=object(v),mid=text(row.messageId??id,200);if(mid)out.set(mid,row);});
    else if(Array.isArray(list)) list.map(object).forEach(row=>{const mid=text(row.messageId,200);if(mid)out.set(mid,row);});
  }
  return out;
}
function stored7355090(row:PlainObject):PlainObject{
  return {messageId:text(row.messageId,200),groupId:text(row.groupId,200),to:digits(row.to),type:text(row.type,40),status:text(row.status,40),statusCode:text(row.statusCode,20),reason:reason7355090(row),text:text(row.text,5000),dateCreated:text(row.dateCreated,80),dateProcessed:text(row.dateProcessed,80),dateReported:text(row.dateReported,80),dateReceived:text(row.dateReceived,80),dateUpdated:text(row.dateUpdated,80)};
}

export const refreshMessageDeliveryStatusesAdmin7355090=onCall(STATUS_OPTIONS,async request=>{
  const actor=await requireFullAdmin7355090(request),input=object(request.data),deliveryIds=unique(Array.isArray(input.deliveryIds)?input.deliveryIds:[],200).slice(0,100);
  if(!deliveryIds.length)return {ok:true,refreshedDeliveries:0,refreshedMessages:0,skipped:true};
  const refs=deliveryIds.map(id=>db().collection("messageDeliveries").doc(id)),snaps=await db().getAll(...refs);
  const deliveries=snaps.filter((snap:DocumentSnapshot<DocumentData>)=>snap.exists).map((snap:DocumentSnapshot<DocumentData>)=>({id:snap.id,data:object(snap.data())}));
  const ids=unique(deliveries.flatMap(item=>messageIdsForDelivery7355090(item.data)),200).slice(0,500);
  if(!ids.length)return {ok:true,refreshedDeliveries:0,refreshedMessages:0,skipped:true,reason:"MESSAGE_ID_NOT_FOUND"};
  const latest=await fetchSolapiMessages7355090(ids),batch=db().batch(),now=Date.now(); let refreshedDeliveries=0;
  deliveries.forEach(item=>{
    const snapshot=messageIdsForDelivery7355090(item.data).map(id=>latest.get(id)).filter(Boolean).map(row=>stored7355090(row as PlainObject));
    if(!snapshot.length)return;
    batch.set(db().collection("messageDeliveries").doc(item.id),{
      solapiStatusSnapshot7355090:snapshot,deliveryState7355090:aggregateState7355090(snapshot,item.data.ok!==false),lastStatusSyncAtMs7355090:now,lastStatusSyncAt7355090:FieldValue.serverTimestamp(),
      lastStatusSyncByUid7355090:actor.uid,lastStatusSyncByName7355090:actor.name,statusSyncVersion7355090:MESSAGE_DELIVERY_ADMIN_7355090_VERSION
    },{merge:true}); refreshedDeliveries+=1;
  });
  if(refreshedDeliveries)await batch.commit();
  return {ok:true,refreshedDeliveries,refreshedMessages:latest.size,version:MESSAGE_DELIVERY_ADMIN_7355090_VERSION};
});
