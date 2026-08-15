(function (global) {
  'use strict';
  if (global.__ULIM_ROOM_CLASSROOM_REALTIME_72919__) return;
  global.__ULIM_ROOM_CLASSROOM_REALTIME_72919__ = true;

  const VERSION = '2026-08-15.729.20-firestore-primary-single-owner';
  const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyAW-sqtUQ_mJ6ZS_aV8pTOAKvHTSX-FXUM',
    authDomain: 'ulim-7b09a.firebaseapp.com',
    projectId: 'ulim-7b09a',
    storageBucket: 'ulim-7b09a.firebasestorage.app',
    messagingSenderId: '364788231295',
    appId: '1:364788231295:web:b43fb49527bb6af1c6634a'
  });
  const FUNCTIONS_REGION = 'asia-northeast3';
  const APP_NAME = 'ulim-firebase-primary-72919';
  const state = { runtimePromise:null, runtime:null, classroomDate:'', classroomUnsub:null, roomMonth:'', roomUnsub:null, lastError:'' };

  function text(v){ return String(v == null ? '' : v).trim(); }
  function preferredPersistence(sdk){
    let mode=''; let keep=true;
    try {
      mode=sessionStorage.getItem('ulimLastMode') || localStorage.getItem('ulimLastMode') || '';
      keep = mode === 'student' ? localStorage.getItem('ulimStudentAutoLogin') !== 'N' : localStorage.getItem('ulimAdminAutoLogin') !== 'N';
    } catch(_ignore){}
    return keep ? sdk.browserLocalPersistence : sdk.browserSessionPersistence;
  }
  async function loadSdk(){
    const [appSdk,authSdk,functionsSdk,firestoreSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.1.0/firebase-functions.js'),
      import('https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js')
    ]);
    return Object.assign({}, appSdk, authSdk, functionsSdk, firestoreSdk);
  }
  async function preloadRuntime(){
    if(state.runtime) return state.runtime;
    if(state.runtimePromise) return state.runtimePromise;
    state.runtimePromise=(async function(){
      const sdk=await loadSdk(); let app;
      try{ app=sdk.getApp(APP_NAME); }catch(_e){ app=sdk.initializeApp(FIREBASE_CONFIG,APP_NAME); }
      const auth=sdk.getAuth(app);
      await sdk.setPersistence(auth, preferredPersistence(sdk));
      const functions=sdk.getFunctions(app,FUNCTIONS_REGION);
      const db=sdk.getFirestore(app);
      const commitClassroom=sdk.httpsCallable(functions,'commitClassroomUsageFirestorePrimary7355057');
      const releaseClassroom=sdk.httpsCallable(functions,'releaseClassroomUsageFirestorePrimary7355057');
      const updateClassroom=sdk.httpsCallable(functions,'updateClassroomUsageSlotFirestorePrimary7355057');
      state.runtime={sdk,app,auth,functions,db,commitClassroom,releaseClassroom,updateClassroom};
      return state.runtime;
    })().finally(function(){state.runtimePromise=null;});
    return state.runtimePromise;
  }
  async function ensureAuthenticated(){
    const rt=await preloadRuntime();
    if(rt.auth.currentUser) return rt;
    if(typeof rt.sdk.onAuthStateChanged !== 'function') return null;
    await new Promise(function(resolve){
      let done=false,unsub=null;
      const finish=function(){if(done)return;done=true;try{if(unsub)unsub();}catch(_e){}resolve();};
      const timer=setTimeout(finish,3500);
      try{unsub=rt.sdk.onAuthStateChanged(rt.auth,function(){clearTimeout(timer);finish();},function(){clearTimeout(timer);finish();});}catch(_e){clearTimeout(timer);finish();}
    });
    return rt.auth.currentUser ? rt : null;
  }
  async function waitUntilAuthenticated(timeoutMs){
    const deadline=Date.now()+Math.max(1000,Number(timeoutMs)||12000);
    let rt=null;
    while(Date.now()<deadline){ rt=await ensureAuthenticated(); if(rt&&rt.auth.currentUser)return rt; await new Promise(r=>setTimeout(r,120)); }
    return rt;
  }
  async function forceReauthenticate(){ return ensureAuthenticated(); }
  async function getStableIdToken(rt,force){ rt=rt||await ensureAuthenticated(); if(!rt||!rt.auth.currentUser)throw new Error('Firebase 로그인이 필요합니다.'); return rt.sdk.getIdToken(rt.auth.currentUser,force===true); }
  async function getStableIdTokenResult(rt,force){ rt=rt||await ensureAuthenticated(); if(!rt||!rt.auth.currentUser)throw new Error('Firebase 로그인이 필요합니다.'); return rt.sdk.getIdTokenResult(rt.auth.currentUser,force===true); }
  function resetStableTokenGuard(){ return true; }
  function callable(rt,name){ return rt.sdk.httpsCallable(rt.functions,name); }
  function data(v){return v&&v.data?v.data:v||{};}
  function hourValue(v){const m=String(v==null?'':v).match(/(\d{1,2})/);return m?Number(m[1]):NaN;}
  function normalizeClassroomRows(rows,date){
    return (Array.isArray(rows)?rows:[]).map(function(raw,index){
      const x=raw&&typeof raw==='object'?raw:{};
      const room=text(x.room||x.classroom||x.roomName);
      const startHour=Number.isInteger(Number(x.startHour))?Number(x.startHour):hourValue(x.startTime||x.start);
      const endHour=Number.isInteger(Number(x.endHour))?Number(x.endHour):hourValue(x.endTime||x.end);
      const instructor=text(x.instructor||x.adminName||x.teacherName||x.staffName);
      const className=text(x.className||x.purpose||x.classTitle);
      const rawStatus=text(x.status||x.state),statusKey=rawStatus.replace(/\s/g,'').toLowerCase();
      const status=!rawStatus||['active','used','사용','사용중'].indexOf(statusKey)>=0?'사용중':rawStatus;
      const fallbackId='LEGACY-'+text(date)+'-'+room.replace(/\s/g,'')+'-'+String(startHour)+'-'+String(endHour)+'-'+String(index);
      return Object.assign({},x,{recordId:text(x.recordId)||fallbackId,date:text(x.date)||text(date),room:room,startHour:startHour,endHour:endHour,instructor:instructor,adminName:text(x.adminName)||instructor,className:className,purpose:text(x.purpose)||className,status:status});
    }).filter(function(x){return x.room&&Number.isInteger(x.startHour)&&Number.isInteger(x.endHour)&&x.endHour>x.startHour;});
  }
  async function readClassroomRecords(date){
    date=text(date||dateKey());if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return [];
    const rt=await ensureAuthenticated();if(!rt)return [];
    const snap=await rt.sdk.getDoc(rt.sdk.doc(rt.db,'realtimeClassroomDays',date));
    const payload=snap&&snap.exists()?(snap.data()||{}):{};
    const rows=normalizeClassroomRows(payload.records,date);
    try{global.adminClassroomUsageRows=rows.map(function(x){return Object.assign({},x);});global.adminClassroomUsageLoadedDate=date;}catch(_e){}
    return rows;
  }

  function dateKey(){
    try{if(typeof global.adminClassroomUsageDate_==='function')return text(global.adminClassroomUsageDate_());}catch(_e){}
    const el=document.getElementById('adminClassroomUsageDate'); return text(el&&el.value);
  }
  function monthKey(){
    try{if(global.roomCurrentDate instanceof Date)return global.roomCurrentDate.getFullYear()+'-'+String(global.roomCurrentDate.getMonth()+1).padStart(2,'0');}catch(_e){}
    const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  }
  async function subscribeClassroom(date){
    date=text(date||dateKey()); if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
    const rt=await ensureAuthenticated(); if(!rt)return null;
    if(state.classroomDate===date&&state.classroomUnsub)return true;
    try{if(state.classroomUnsub)state.classroomUnsub();}catch(_e){}
    state.classroomDate=date;
    state.classroomUnsub=rt.sdk.onSnapshot(rt.sdk.doc(rt.db,'realtimeClassroomDays',date),function(snap){
      const payload=snap.exists()?(snap.data()||{}):{}; const rows=normalizeClassroomRows(payload.records,date);
      try{global.adminClassroomUsageRows=rows.map(x=>Object.assign({},x));global.adminClassroomUsageLoadedDate=date;if(typeof global.adminRenderClassroomUsageTable==='function')global.adminRenderClassroomUsageTable();}catch(_e){}
    },function(err){state.lastError=text(err&&err.message);});
    return true;
  }
  async function subscribeRoomMonth(month){
    month=text(month||monthKey()); if(!/^\d{4}-\d{2}$/.test(month))return null;
    const rt=await ensureAuthenticated(); if(!rt)return null;
    if(state.roomMonth===month&&state.roomUnsub)return true;
    try{if(state.roomUnsub)state.roomUnsub();}catch(_e){}
    state.roomMonth=month;
    state.roomUnsub=rt.sdk.onSnapshot(rt.sdk.doc(rt.db,'realtimeRoomMonths',month),function(){
      try{if(typeof global.loadRoomReservations==='function')Promise.resolve(global.loadRoomReservations(true)).catch(function(){});}catch(_e){}
    },function(err){state.lastError=text(err&&err.message);});
    return true;
  }
  function readClassroomRequest(){
    const date=dateKey();
    const room=text(document.getElementById('adminClassroomUsageRoom')&&document.getElementById('adminClassroomUsageRoom').value);
    const startHour=Number(document.getElementById('adminClassroomUsageStart')&&document.getElementById('adminClassroomUsageStart').value);
    const endHour=Number(document.getElementById('adminClassroomUsageEnd')&&document.getElementById('adminClassroomUsageEnd').value);
    const assignedInstructor=text(document.getElementById('adminClassroomUsageInstructor')&&document.getElementById('adminClassroomUsageInstructor').value) || text(global.adminInfo&&(global.adminInfo.name||global.adminInfo.id));
    const className=text(document.getElementById('adminClassroomUsageClass')&&document.getElementById('adminClassroomUsageClass').value);
    const memo=text(document.getElementById('adminClassroomUsageMemo')&&document.getElementById('adminClassroomUsageMemo').value);
    if(!date||!room||!Number.isInteger(startHour)||!Number.isInteger(endHour)||endHour<=startHour)throw new Error('사용일·강의실·시간을 확인해주세요.');
    return {date,groups:[{room,startHour,endHour}],assignedInstructor,className,memo,requestId:'CLASSROOM-'+Date.now()+'-'+Math.random().toString(36).slice(2)};
  }
  async function saveClassroom(){
    const rt=await ensureAuthenticated();if(!rt)throw new Error('로그인 후 이용해주세요.');
    const req=readClassroomRequest(); const result=data(await rt.commitClassroom(req));
    if(Array.isArray(result.records)){global.adminClassroomUsageRows=result.records;global.adminClassroomUsageLoadedDate=req.date;if(typeof global.adminRenderClassroomUsageTable==='function')global.adminRenderClassroomUsageTable();}
    await subscribeClassroom(req.date); return result;
  }
  async function commitSingleClassroomSlot(room,hour){
    const rt=await ensureAuthenticated();if(!rt)throw new Error('로그인 후 이용해주세요.');
    const date=dateKey(),startHour=Number(hour),roomName=text(room);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!roomName||!Number.isInteger(startHour))throw new Error('사용일·강의실·시간을 확인해주세요.');
    const assignedInstructor=text(document.getElementById('adminClassroomUsageInstructor')&&document.getElementById('adminClassroomUsageInstructor').value)||text(global.adminInfo&&(global.adminInfo.name||global.adminInfo.id));
    const className=text(document.getElementById('adminClassroomUsageClass')&&document.getElementById('adminClassroomUsageClass').value);
    const memo=text(document.getElementById('adminClassroomUsageMemo')&&document.getElementById('adminClassroomUsageMemo').value);
    const result=data(await rt.commitClassroom({date:date,groups:[{room:roomName,startHour:startHour,endHour:startHour+1}],assignedInstructor:assignedInstructor,className:className,memo:memo,forceOverride:false,requestId:'CLASSROOM-SLOT-7355054-'+Date.now()+'-'+Math.random().toString(36).slice(2)}));
    if(Array.isArray(result.records)){global.adminClassroomUsageRows=result.records.map(x=>Object.assign({},x));global.adminClassroomUsageLoadedDate=date;if(typeof global.adminRenderClassroomUsageTable==='function')global.adminRenderClassroomUsageTable();}
    await subscribeClassroom(date);return result;
  }
  global.ulimCommitClassroomSlot729_=commitSingleClassroomSlot;
  async function loadClassroom(date){ await subscribeClassroom(date||dateKey()); return {status:'success',records:Array.isArray(global.adminClassroomUsageRows)?global.adminClassroomUsageRows:[]}; }
  function installWrappers(){
    global.adminSaveClassroomUsage=saveClassroom;
    global.adminLoadClassroomUsage=function(force){return loadClassroom(dateKey(),force);};
    try{adminSaveClassroomUsage=global.adminSaveClassroomUsage;adminLoadClassroomUsage=global.adminLoadClassroomUsage;}catch(_e){}
  }
  async function start(){
    installWrappers(); const rt=await ensureAuthenticated(); if(!rt)return null;
    const d=dateKey();if(d)subscribeClassroom(d);subscribeRoomMonth(monthKey()); return rt;
  }

  const api=Object.freeze({version:VERSION,start,preloadRuntime,ensureAuthenticated,waitUntilAuthenticated,forceReauthenticate,getStableIdToken,getStableIdTokenResult,resetStableTokenGuard,subscribeClassroom,subscribeRoomMonth,readClassroomRecords,commitClassroom:function(payload){return preloadRuntime().then(function(rt){return rt.commitClassroom(payload);});},releaseClassroom:function(payload){return preloadRuntime().then(function(rt){return rt.releaseClassroom(payload);});},updateClassroom:function(payload){return preloadRuntime().then(function(rt){return rt.updateClassroom(payload);});},status:function(){return {version:VERSION,ready:!!(state.runtime&&state.runtime.auth.currentUser),lastError:state.lastError};}});
  global.ULIM_ROOM_CLASSROOM_REALTIME_72919=api;
  global.ULIM_ROOM_CLASSROOM_REALTIME_72918=api;
  global.ULIM_ROOM_CLASSROOM_REALTIME_72917=api;
  global.ULIM_ROOM_CLASSROOM_REALTIME_72916=api;
  global.ULIM_ROOM_CLASSROOM_REALTIME_728=api;
  global.ULIM_ROOM_CLASSROOM_REALTIME_727=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){start().catch(function(){});},{once:true});else start().catch(function(){});
})(typeof window!=='undefined'?window:globalThis);
