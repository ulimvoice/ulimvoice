(function(global){
  'use strict';
  if(global.__ULIM_STAFF_LOGIN_FIREBASE_PRIMARY_7329__)return;
  global.__ULIM_STAFF_LOGIN_FIREBASE_PRIMARY_7329__=true;
  const VERSION='2026-08-16.732.09.2-refresh-session-restore';
  const PROFILE_KEY='ulimFirebaseStaffProfile7320';
  const LOGOUT_KEY='ULIM_STAFF_EXPLICIT_LOGOUT_7322';
  const DOMAIN='auth.ulimvoice.app';
  const ROLES=['teacher','admin','superAdmin'];
  let loginPromise=null,restorePromise=null,lastLoginId='';
  function text(v){return String(v==null?'':v).trim();}
  function norm(v){return text(v).normalize('NFKC').toLowerCase();}
  function owner(){return global.ULIM_ROOM_CLASSROOM_REALTIME_72919||global.ULIM_ROOM_CLASSROOM_REALTIME_72918||global.ULIM_ROOM_CLASSROOM_REALTIME_72917||null;}
  async function runtime(){const o=owner();if(!o||typeof o.preloadRuntime!=='function')throw new Error('로그인 기능을 준비하지 못했습니다.');return o.preloadRuntime();}
  function bytesToBase64Url(bytes){let b='';bytes.forEach(v=>b+=String.fromCharCode(v));return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');}
  async function deriveLoginEmail(loginId){
    const id=norm(loginId);if(!id)throw new Error('교직원 ID를 입력해주세요.');
    if(!global.crypto||!global.crypto.subtle||typeof TextEncoder==='undefined')throw new Error('현재 브라우저에서는 안전한 로그인을 사용할 수 없습니다.');
    const digest=await global.crypto.subtle.digest('SHA-256',new TextEncoder().encode('ulimvoice-staff-password-v1\u001f'+id));
    return 'u_'+bytesToBase64Url(new Uint8Array(digest))+'@'+DOMAIN;
  }
  function roleLabel(role){return role==='superAdmin'?'전체관리자':role==='admin'?'관리자':'강사';}
  function storedProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')||{};}catch(_e){return {};}}
  async function readProfile(rt,fallbackId){
    const user=rt&&rt.auth&&rt.auth.currentUser;if(!user)throw new Error('로그인 사용자를 확인하지 못했습니다.');
    const tr=await rt.sdk.getIdTokenResult(user,false),claims=tr&&tr.claims||{},role=text(claims.role);
    if(!ROLES.includes(role)||claims.authVersion==null)throw new Error('교직원 계정 권한을 확인하지 못했습니다.');
    if(role==='teacher'&&!text(claims.teacherUid))throw new Error('강사 계정 정보가 일치하지 않습니다.');
    const old=storedProfile(),same=!old.firebaseAuthUid||text(old.firebaseAuthUid)===text(user.uid)?old:{};
    const id=text(claims.loginId||claims.adminId||claims.legacyAdminId||fallbackId||same.id||same.loginId);
    const name=text(claims.name||claims.displayName||user.displayName||same.name||same.displayName||same.teacherName||same.adminName||id);
    return {id,name,role:roleLabel(role),firebaseRole:role,phone:text(claims.phone||same.phone),mustChangePassword:same.mustChangePassword===true,accountUid:text(claims.accountUid||claims.teacherUid||same.accountUid||user.uid),principalUidV2:text(claims.principalUidV2||same.principalUidV2||user.uid),firebaseAuthUid:user.uid,permissions:claims.permissions||same.permissions||null,passwordLoginEnabled:true,authVersion:claims.authVersion};
  }
  function saveProfile(profile){
    global.adminInfo=profile||{};global.adminModeActive=true;global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=true;
    try{adminInfo=global.adminInfo;adminModeActive=true;}catch(_e){}
    try{localStorage.setItem('adminInfo',JSON.stringify(profile||{}));localStorage.setItem(PROFILE_KEY,JSON.stringify(profile||{}));localStorage.setItem('ulimLastMode','admin');localStorage.removeItem(LOGOUT_KEY);sessionStorage.removeItem(LOGOUT_KEY);}catch(_e){}
    try{global.adminToken='FIREBASE_AUTH';adminToken='FIREBASE_AUTH';localStorage.removeItem('adminToken');sessionStorage.removeItem('adminToken');}catch(_e){}
  }
  function showShell(){
    try{document.body.classList.add('admin-mode');}catch(_e){}
    const overlay=document.getElementById('loginOverlay'),wrapper=document.querySelector('.wrapper'),tab=document.querySelector('.tab[data-tab="tabAdmin"]'),content=document.getElementById('tabAdmin'),box=document.getElementById('adminLoginBox'),dash=document.getElementById('adminDashboard');
    if(overlay)overlay.style.display='none';if(wrapper)wrapper.style.display='flex';
    document.querySelectorAll('.tab').forEach(n=>n.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(n=>n.classList.remove('active'));
    if(tab){tab.style.display='';tab.style.pointerEvents='auto';tab.classList.add('active','admin-only-tab');}if(content)content.classList.add('active');if(box)box.style.display='none';if(dash)dash.style.display='block';
    try{localStorage.setItem('ulimActiveTabId','tabAdmin');}catch(_e){}
    try{if(typeof global.applyAdminPermissions==='function')global.applyAdminPermissions();}catch(_e){}
  }
  function showLogin(){
    global.adminInfo=null;global.adminModeActive=false;global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=false;try{adminInfo=null;adminModeActive=false;adminToken='';}catch(_e){}
    try{localStorage.removeItem('adminInfo');localStorage.removeItem(PROFILE_KEY);localStorage.removeItem('adminToken');localStorage.removeItem('ulimLastMode');sessionStorage.removeItem('adminToken');}catch(_e){}
    try{document.body.classList.remove('admin-mode','teacher-mode','full-admin-mode');}catch(_e){}
    const overlay=document.getElementById('loginOverlay'),wrapper=document.querySelector('.wrapper'),box=document.getElementById('adminLoginBox'),dash=document.getElementById('adminDashboard');
    if(overlay)overlay.style.display='flex';if(wrapper)wrapper.style.display='none';if(box)box.style.display='block';if(dash)dash.style.display='none';
  }
  async function login(id,password){
    if(loginPromise)return loginPromise;
    loginPromise=(async function(){
      const idEl=document.getElementById('adminIdInput'),pwEl=document.getElementById('adminPwInput');
      const cleanId=text(id==null?(idEl?idEl.value:''):id);
      const pw=String(password==null?(pwEl?pwEl.value:''):password);
      if(!cleanId||!pw)throw new Error('교직원 ID와 비밀번호를 입력해주세요.');
      try{localStorage.removeItem(LOGOUT_KEY);sessionStorage.removeItem(LOGOUT_KEY);}catch(_e){}
      const rt=await runtime();const o=owner();if(o&&typeof o.resetStableTokenGuard==='function')o.resetStableTokenGuard('');
      const email=await deriveLoginEmail(cleanId);if(rt.auth.currentUser)try{await rt.sdk.signOut(rt.auth);}catch(_e){}
      const cred=await rt.sdk.signInWithEmailAndPassword(rt.auth,email,pw);if(o&&typeof o.getStableIdToken==='function')await o.getStableIdToken(rt,false,'staff-login');else await rt.sdk.getIdToken(cred.user,false);
      const p=await readProfile(rt,cleanId);lastLoginId=p.id||cleanId;saveProfile(p);showShell();
      try{global.dispatchEvent(new CustomEvent('ulim-firebase-auth-ready',{detail:{uid:p.firebaseAuthUid,role:p.firebaseRole,version:VERSION,reason:'staff-login'}}));}catch(_e){}
      try{if(typeof global.adminLoadInitialData==='function')Promise.resolve(global.adminLoadInitialData()).catch(function(){});}catch(_e){}
      return true;
    })().catch(function(e){alert(e&&e.message?e.message:'교직원 로그인에 실패했습니다.');return false;}).finally(function(){loginPromise=null;});
    return loginPromise;
  }
  async function changePassword(force,knownCurrent){
    const rt=await runtime();if(!rt.auth.currentUser)return false;
    const p=global.adminInfo||await readProfile(rt,lastLoginId),id=text(p.id||lastLoginId);if(!id)return false;
    const current=knownCurrent||prompt('현재 비밀번호를 입력해주세요.');if(!current)return false;
    const next=prompt('새 비밀번호를 입력해주세요.\n6자 이상으로 설정해주세요.');if(!next)return false;if(String(next).length<6)return alert('새 비밀번호는 6자 이상으로 설정해주세요.'),false;if(String(next)===String(current))return alert('현재 비밀번호와 다른 새 비밀번호를 입력해주세요.'),false;
    const confirmPw=prompt('새 비밀번호를 한 번 더 입력해주세요.');if(next!==confirmPw)return alert('새 비밀번호가 서로 다릅니다.'),false;
    try{
      const email=await deriveLoginEmail(id),credential=rt.sdk.EmailAuthProvider.credential(email,current);await rt.sdk.reauthenticateWithCredential(rt.auth.currentUser,credential);await rt.sdk.updatePassword(rt.auth.currentUser,next);
      const updated=Object.assign({},p,{mustChangePassword:false,passwordLoginEnabled:true});saveProfile(updated);try{global.dispatchEvent(new CustomEvent('ulim-staff-password-changed',{detail:{version:VERSION}}));}catch(_e){}alert('비밀번호가 변경되었습니다.');return true;
    }catch(e){alert(e&&e.message?e.message:'비밀번호 변경에 실패했습니다.');return false;}
  }
  async function logout(){
    try{localStorage.setItem(LOGOUT_KEY,'Y');sessionStorage.setItem(LOGOUT_KEY,'Y');}catch(_e){}
    try{global.dispatchEvent(new CustomEvent('ulim-staff-logout-start',{detail:{version:VERSION}}));}catch(_e){}
    try{const rt=await runtime();if(rt.auth.currentUser)await rt.sdk.signOut(rt.auth);}catch(_e){}
    showLogin();return true;
  }
  async function restore(){
    if(restorePromise)return restorePromise;
    restorePromise=(async function(){
      const rt=await runtime();
      return await new Promise(function(resolve){
        let settled=false,unsub=null;const finish=function(value){if(settled)return;settled=true;try{if(unsub)unsub();}catch(_e){}resolve(!!value);};
        const timer=setTimeout(function(){global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=false;finish(false);},12000);
        try{
          unsub=rt.sdk.onAuthStateChanged(rt.auth,async function(user){
            clearTimeout(timer);
            if(!user){global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=false;finish(false);return;}
            try{if(localStorage.getItem(LOGOUT_KEY)==='Y'||sessionStorage.getItem(LOGOUT_KEY)==='Y'){global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=false;finish(false);return;}}catch(_e){}
            try{
              const tr=await rt.sdk.getIdTokenResult(user,false),role=text(tr&&tr.claims&&tr.claims.role);
              if(!ROLES.includes(role)){global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=false;finish(false);return;}
              const p=await readProfile(rt,'');lastLoginId=p.id||'';saveProfile(p);showShell();
              try{global.dispatchEvent(new CustomEvent('ulim-firebase-auth-ready',{detail:{uid:p.firebaseAuthUid,role:p.firebaseRole,version:VERSION,reason:'staff-restore'}}));}catch(_e){}
              finish(true);
            }catch(_e){global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=false;finish(false);}
          },function(){clearTimeout(timer);global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=false;finish(false);});
        }catch(_e){clearTimeout(timer);global.__ULIM_STAFF_FIREBASE_SESSION_READY_7329__=false;finish(false);}
      });
    })();
    return restorePromise;
  }
  async function waitForRestore(timeoutMs){
    const ms=Math.max(1000,Number(timeoutMs)||12000);
    return Promise.race([restore(),new Promise(function(resolve){setTimeout(function(){resolve(false);},ms);})]);
  }
  function install(){global.adminLogin=login;global.changeAdminPasswordByPrompt=changePassword;global.adminLogout=logout;try{adminLogin=login;changeAdminPasswordByPrompt=changePassword;adminLogout=logout;}catch(_e){}restore().catch(function(){});}
  global.__ULIM_STAFF_LOGIN_FIREBASE_PRIMARY_7329_API__=Object.freeze({version:VERSION,login,logout,restore,waitForRestore,changePassword,deriveLoginEmail});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(typeof window!=='undefined'?window:globalThis);
