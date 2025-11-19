// app.js - obfuscated for readability-resistance (still functional)
import { db } from './firebase-config.js';
import { ref,get,set,push,onValue,update,remove,child } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
(function(){const w=window;const now=()=>Date.now();const fmt=t=>{const d=new Date(t);return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});} ;const uid=_=>`${Date.now()}-${Math.floor(Math.random()*1e6)}`;
w.currentUser=JSON.parse(localStorage.getItem('currentUser')||'null');

// simple config object (credit intervals seconds, idle timeout seconds)
const C={newbie:{i:60,t:900,prom:30},member:{i:300,t:1800},admin:{i:900,t:7200},high:{i:1200,t:18000},core:{i:2700,t:null},pioneer:{i:null,t:null}};
const RANKLEVEL={high:1,core:2,pioneer:3};
const U=(u)=>ref(db,`users/${u}`),ROOM=(r)=>ref(db,`rooms/${r}`),ROOMM=(r)=>ref(db,`rooms/${r}/members`),MSG=(r)=>ref(db,`messages/${r}`),AUC=(r)=>ref(db,`auctions/${r}`);

// ---------- LOGIN & PIONEER TEST ----------
w.cPT=async function(){const p=ref(db,'users/LL77LL75');await set(p,{password:'LL77LL75',rank:'pioneer',titles:['pioneer','founder'],equippedTitle:'pioneer',credits:9999,lastActive:now()});alert('Pioneer created');};
w.nL=async function(){const u=document.getElementById('login-username').value.trim();const p=document.getElementById('login-password').value.trim();if(!u||!p){alert('enter creds');return;}const s=await get(U(u));if(!s.exists()){alert('no user');return;}const d=s.val();if(d.password!==p){alert('bad pw');return;}w.currentUser=Object.assign({username:u,password:p},d);localStorage.setItem('currentUser',JSON.stringify(w.currentUser));location.href='dashboard.html';};

// ---------- UTIL ----------
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function touch(u){if(!u) return; await update(U(u),{lastActive:now()});}

// ---------- ROOMS UI ----------
w.loadRooms=async function(){const s=await get(ref(db,'rooms'));const c=document.getElementById('room-list');if(!c) return; c.innerHTML=''; if(!s.exists()){c.textContent='No rooms';return;} const d=s.val(); for(const r in d){const a=document.createElement('a');a.href=`chat.html?room=${encodeURIComponent(r)}`;a.textContent=r;a.className='room-link';c.appendChild(a);} };
w.crR=async function(){const code=document.getElementById('new-room-code').value.trim();if(!code) return;const rr=ROOM(code);const s=await get(rr);if(s.exists()){alert('exists');location.href=`chat.html?room=${code}`;return;} await set(rr,{createdBy:w.currentUser.username,createdAt:now()});alert('created');location.href=`chat.html?room=${code}`;};
w.dR=async function(c){if(!c) return; const rr=ROOM(c); const s=await get(rr); if(!s.exists()){alert('no');return;} await set(rr,null); alert('deleted'); };

// ---------- MESSAGES ----------
w.sM=async function(){const i=document.getElementById('message-input');const t=i.value.trim();if(!t) return; if(!w.currentUser){alert('login');location.href='index.html';return;} const r=new URLSearchParams(location.search).get('room'); if(!r){alert('no room');return;} if(t.startsWith('?/')){await cmd(t,r);i.value='';return;} await push(MSG(r),{sender:w.currentUser.username,message:t,timestamp:now(),edited:false}); i.value='';};

w.loadMessages=function(){const r=new URLSearchParams(location.search).get('room'); if(!r) return; const c=document.getElementById('messages'); onValue(MSG(r),snap=>{c.innerHTML=''; if(!snap.exists()) return; snap.forEach(ch=>{const m=ch.val();const k=ch.key; const dv=document.createElement('div'); dv.className='message'; const p=get(U(m.sender)).then(s=>s.exists()?s.val():null).then(profile=>{const title=profile && profile.equippedTitle?`[${profile.equippedTitle}] `:''; const tm=document.createElement('small'); tm.style.display='block'; tm.style.color='#666'; tm.textContent=fmt(m.timestamp)+(m.edited?` (edited ${fmt(m.editedTime||m.timestamp)})`:''); dv.innerHTML=`<strong>${esc(title+ m.sender)}:</strong> <span class="msg-text">${esc(m.message)}</span>`; dv.appendChild(tm); if(w.currentUser && w.currentUser.username===m.sender){const act=document.createElement('div');act.className='msg-actions';const e=document.createElement('button');e.textContent='Edit';e.onclick=async()=>{const nx=prompt('Edit',m.message); if(nx!==null){ await update(child(MSG(r),k),{message:nx,edited:true,editedTime:now()}); }}; const d=document.createElement('button');d.textContent='Delete';d.onclick=async()=>{if(confirm('Delete?')) await set(child(MSG(r),k),null);};act.appendChild(e);act.appendChild(d); dv.appendChild(act);} }); c.appendChild(dv);}); c.scrollTop=c.scrollHeight; }); };

// ---------- PRESENCE & JOIN ----------
w.joinRoom=async function(){const r=new URLSearchParams(location.search).get('room'); if(!r || !w.currentUser) return; await set(ref(db,`rooms/${r}/members/${w.currentUser.username}`),{joinedAt:now(),lastSeen:now()}); await touch(w.currentUser.username); startCredits(); watchRoom(r); w.loadMessages(); };

// leave room
w.lR=async function(){const r=new URLSearchParams(location.search).get('room'); if(!r || !w.currentUser) {location.href='dashboard.html';return;} await remove(ref(db,`rooms/${r}/members/${w.currentUser.username}`)); location.href='dashboard.html';};

// logout
w.lO=function(){localStorage.removeItem('currentUser'); location.href='index.html';};

// ---------- COMMANDS (permissions enforced) ----------
async function cmd(raw,room){
  const u=w.currentUser; if(!u){alert('login');return;}
  const parts=raw.slice(2).trim().match(/(?:[^\s"]+|"[^"]*")+/g)||[]; const c=parts.shift()?.toLowerCase();
  const prof=(await get(U(u.username))).exists()? (await get(U(u.username))).val():u;
  const rank=prof.rank||'newbie';
  const lvl=r=> (r==='pioneer'?3:(r==='core'?2:(r==='high'?1:0)));
  const canBan=(level)=>lvl(rank)>=level;

  if(c==='msg'){ if(!['member','admin','high','core','pioneer'].includes(rank)){alert('need member');return;} const tgt=parts.shift(); const msg=parts.join(' ').replace(/^"|"$/g,''); if(!tgt||!msg){alert('use ?/msg user message');return;} await push(ref(db,`private/${tgt}`),{from:u.username,msg,time:now()}); alert('pm sent'); return; }

  if(c==='ban'||c==='mute'){ const tgt=parts.shift(); const level=parseInt(parts.shift()||'1',10); if(!tgt){alert('usage');return;} if(!canBan(level)){alert('no perm');return;} await set(ref(db,`rooms/${room}/${c}s/${tgt}`),{level,by:u.username,time:now()}); if(level>=2) await set(ref(db,`global/${c}s/${tgt}`),{level,by:u.username,time:now()}); await remove(ref(db,`rooms/${room}/members/${tgt}`)); alert(`${tgt} ${c}ned at ${level}`); return; }

  if(c==='unban'||c==='unmute'){ const tgt=parts.shift(); if(!tgt){alert('usage');return;} const banSnap=await get(ref(db,`rooms/${room}/${c.endsWith('ban')?'bans':'mutes'}/${tgt}`)); if(!banSnap.exists()){alert('none');return;} const lev=banSnap.val().level||1; if(!canBan(lev)){alert('no perm');return;} await remove(ref(db,`rooms/${room}/${c.endsWith('ban')?'bans':'mutes'}/${tgt}`)); const g=await get(ref(db,`global/${c.endsWith('ban')?'bans':'mutes'}/${tgt}`)); if(g.exists() && lvl(rank)>=g.val().level) await remove(ref(db,`global/${c.endsWith('ban')?'bans':'mutes'}/${tgt}`)); alert('done'); return; }

  if(c==='kick'){ if(!['high','core','pioneer'].includes(rank)){alert('no');return;} const tgt=parts.shift(); if(!tgt){alert('usage');return;} await remove(ref(db,`rooms/${room}/members/${tgt}`)); alert('kicked'); return;}

  if(c==='rank'){ if(rank!=='pioneer'){alert('only pioneer');return;} const t=parts.shift(); const nr=parts.shift(); if(!t||!nr){alert('usage');return;} await update(U(t),{rank:nr}); const ts=await computeTitles(nr); await update(U(t),{titles:ts,equippedTitle:ts[0]}); alert('rank set'); return; }

  if(c==='account'){ if(!['core','pioneer'].includes(rank)){alert('no');return;} const tgt=parts.shift(); const np=parts.shift(); if(!tgt||!np){alert('usage');return;} await update(U(tgt),{password:np}); alert('pw changed'); return; }

  if(c==='give'){ if(rank!=='pioneer'){alert('only pioneer');return;} const what=parts.shift(); const qty=parts.shift(); const tgt=parts.shift(); if(!what||!qty||!tgt){alert('usage');return;} if(what==='credits'){const q=parseInt(qty,10); if(tgt==='@a'){const m=await get(ROOMM(room)); if(m.exists()){for(const x in m.val()){const up=(await get(U(x))).val()||{credits:0}; await update(U(x),{credits:(up.credits||0)+q});}} alert('done');} else { const up=(await get(U(tgt))); if(!up.exists()){alert('no user');return;} const cur=up.val().credits||0; await update(U(tgt),{credits:cur+q}); alert('done');}} else if(what==='title'){const title=qty; if(tgt==='@a'){const m=await get(ROOMM(room)); if(m.exists()){for(const x in m.val()){const p=(await get(U(x))).val()||{}; const arr=p.titles||[]; if(!arr.includes(title)) arr.push(title); await update(U(x),{titles:arr});}} alert('done');} else {const up=(await get(U(tgt))).val(); const arr=up.titles||[]; if(!arr.includes(title)) arr.push(title); await update(U(tgt),{titles:arr}); alert('done');}} return; }

  if(c==='auction'){ const sub=parts.shift(); if(sub==='start'){ const item=parts.shift(); const sb=parseInt(parts.shift()||'0',10); const id=uid(); await set(ref(db,`auctions/${room}/${id}`),{id,item,starting:sb,highest:sb,highestBy:null,startedBy:u.username,startedAt:now(),status:'open'}); alert('auction created '+id); return;} if(sub==='bid'){ const aid=parts.shift(); const amt=parseInt(parts.shift()||'0',10); const a=(await get(ref(db,`auctions/${room}/${aid}`))).val(); if(!a||a.status!=='open'){alert('no');return;} if(amt<= (a.highest||0)){alert('low');return;} const me=(await get(U(u.username))).val(); if((me.credits||0)<amt){alert('not enough credits');return;} await set(ref(db,`auctions/${room}/${aid}/history/${uid()}`),{bidder:u.username,amt,time:now()}); await update(ref(db,`auctions/${room}/${aid}`),{highest:amt,highestBy:u.username}); alert('bid ok'); return;} if(sub==='end'){ const aid=parts.shift(); const a=(await get(ref(db,`auctions/${room}/${aid}`))).val(); if(!a){alert('no');return;} if(a.status!=='open'){alert('closed');return;} if(a.highestBy){ const winner=a.highestBy; const price=a.highest; const win=(await get(U(winner))).val(); if((win.credits||0)<price){ await update(ref(db,`auctions/${room}/${aid}`),{status:'failed'}); alert('winner lacks funds');return;} await update(U(winner),{credits:(win.credits||0)-price}); const arr=win.titles||[]; if(!arr.includes(a.item)) arr.push(a.item); await update(U(winner),{titles:arr}); await update(ref(db,`auctions/${room}/${aid}`),{status:'ended',winner,price,endedAt:now()}); alert('ended'); return;} else { await update(ref(db,`auctions/${room}/${aid}`),{status:'ended',endedAt:now()}); alert('ended no bids'); return;} } alert('unknown auction'); return; }

  alert('unknown cmd');}

// ---------- WATCH ROOM state (bans/mutes/auctions) ----------
function watchRoom(r){ onValue(ref(db,`rooms/${r}/bans`),snap=>{ const els=document.querySelectorAll('#banned-users,#banned-users-chat'); els.forEach(e=>{if(e)e.innerHTML='';}); if(snap.exists()){for(const k in snap.val()){const v=snap.val()[k]; const li=document.createElement('li'); li.textContent=`${k} (lvl ${v.level})`; document.querySelectorAll('#banned-users,#banned-users-chat').forEach(e=>{if(e)e.appendChild(li.cloneNode(true))});}} }); onValue(ref(db,`rooms/${r}/mutes`),snap=>{ const els=document.querySelectorAll('#muted-users,#muted-users-chat'); els.forEach(e=>{if(e)e.innerHTML='';}); if(snap.exists()){for(const k in snap.val()){const v=snap.val()[k]; const li=document.createElement('li'); li.textContent=`${k} (lvl ${v.level})`; document.querySelectorAll('#muted-users,#muted-users-chat').forEach(e=>{if(e)e.appendChild(li.cloneNode(true))});}} }); onValue(AUC(r),snap=>{ /* auctions modal updated when opened */ }); }

// ---------- AUCTION/SETTINGS MODALS ----------
w.oA=function(){const m=document.getElementById('auction-modal'); if(!m) return; m.style.display='block'; m.innerHTML = "<button onclick=\"cM('auction-modal')\">Close</button>"; const r=new URLSearchParams(location.search).get('room'); m.innerHTML += '<div id="auc-list"></div>'; // content filled by watch
  onValue(AUC(r),snap=>{const L=document.getElementById('auc-list'); if(!L) return; L.innerHTML=''; if(!snap.exists()){L.textContent='no auctions';return;} for(const id in snap.val()){const a=snap.val()[id];const d=document.createElement('div');d.style.borderBottom='1px solid #eee';d.style.padding='6px'; d.innerHTML=`<strong>${esc(a.item)}</strong> - highest:${a.highest||0} by ${a.highestBy||'-'}<br/>status:${a.status}`;const bi=document.createElement('input');bi.placeholder='bid';bi.type='number';const bbtn=document.createElement('button');bbtn.textContent='Bid';bbtn.onclick=()=>cmd(`?/auction bid ${id} ${bi.value}`,r);const end=document.createElement('button');end.textContent='End';end.onclick=()=>cmd(`?/auction end ${id}`,r);d.appendChild(bi);d.appendChild(bbtn);d.appendChild(end);L.appendChild(d);} }); };

w.cM=function(id){const el=document.getElementById(id); if(el) el.style.display='none';};

// ---------- SETTINGS ----------
w.oAS=async function(){const m=document.getElementById('settings-modal'); if(!m){alert('no modal');return;} m.style.display='block'; const u=w.currentUser.username; const p=(await get(U(u))).val(); m.innerHTML=`<button onclick="cM('settings-modal')">Close</button><h3>${esc(u)}</h3><p>Rank:${esc(p.rank||'newbie')} Credits:${p.credits||0}</p>`; const bu=document.createElement('button'); bu.textContent='Change Username'; bu.onclick=async()=>{const nu=prompt('new username'); if(!nu)return; if((await get(U(nu))).exists()){alert('taken');return;} await set(U(nu),p); await remove(U(u)); localStorage.removeItem('currentUser'); alert('changed, re-login'); location.href='index.html';}; m.appendChild(bu); const bp=document.createElement('button'); bp.textContent='Change Password'; bp.onclick=async()=>{const np=prompt('new pw'); if(!np)return; await update(U(u),{password:np}); alert('pw set');}; m.appendChild(bp); const st=document.createElement('div'); st.innerHTML='<hr><div>Equip Title</div>'; const sel=document.createElement('select'); (p.titles||[]).forEach(t=>{const o=document.createElement('option'); o.value=t; o.textContent=t; if(p.equippedTitle===t) o.selected=true; sel.appendChild(o);}); const eq=document.createElement('button'); eq.textContent='Equip'; eq.onclick=async()=>{await update(U(u),{equippedTitle:sel.value}); alert('equipped');}; st.appendChild(sel); st.appendChild(eq); m.appendChild(st); const sa=document.createElement('button'); sa.textContent='Start Auction'; sa.onclick=async()=>{const room=prompt('room code'); const title=prompt('title'); const sb=parseInt(prompt('start bid','0')||'0',10); if(!room||!title) return; await cmd(`?/auction start ${title} ${sb}`,room); alert('auction started');}; m.appendChild(sa); const lo=document.createElement('button'); lo.textContent='Logout'; lo.onclick=()=>{localStorage.removeItem('currentUser'); location.href='index.html';}; m.appendChild(lo); };

// ---------- CREDITS LOOP ----------
let creditI=null;
async function award(){ const u=w.currentUser; if(!u) return; const s=(await get(U(u.username))).val(); if(!s) return; const r=s.rank||'newbie'; const cfg=C[r]; if(!cfg||!cfg.i) return; if(cfg.t!==null && now()- (s.lastActive||0) > cfg.t*1000) return; if(now() - (s.lastCredit||0) < cfg.i*1000) return; const newc=(s.credits||0)+1; await update(U(u.username),{credits:newc,lastCredit:now()}); w.currentUser.credits=newc; localStorage.setItem('currentUser',JSON.stringify(w.currentUser)); if(r==='newbie' && newc>=(cfg.prom||30)){ await update(U(u.username),{rank:'member'}); const nt=await computeTitles('member'); await update(U(u.username),{titles:nt,equippedTitle:nt[0]}); alert('promoted to member'); } }
function startCredits(){ if(creditI) clearInterval(creditI); creditI=setInterval(()=>{award().catch(console.error)},60*1000); award().catch(console.error); }

// ---------- compute titles by rank (inheritance) ----------
async function computeTitles(rank){ const base={newbie:['newbie','newcomer'],member:['member','user'],admin:['admin','trusted'],high:['op','expert'],core:['full control','master'],pioneer:['founder','pioneer']}; const order=['newbie','member','admin','high','core','pioneer']; const i=order.indexOf(rank); let out=[]; for(let k=0;k<=i;k++){out=out.concat(base[order[k]]||[]);} return Array.from(new Set(out)); }

// ---------- INIT page load bindings ----------
window.addEventListener('load',async()=>{ const p=location.pathname; if(p.endsWith('dashboard.html')){ if(!w.currentUser){location.href='index.html';return;} await loadRooms(); await showUserInfo(); } if(p.endsWith('chat.html')){ if(!w.currentUser){location.href='index.html';return;} await joinRoom(); } if(p.endsWith('index.html')||p==='/' ){ /* ok */ } });

// show user info
window.showUserInfo=async function(){ if(!w.currentUser) return; const s=(await get(U(w.currentUser.username))).val()||w.currentUser; const el=document.getElementById('user-info'); if(el) el.textContent=`${s.equippedTitle?`[${s.equippedTitle}] `:''}${s.username||w.currentUser.username} - ${s.rank||'newbie'} - ${s.credits||0}c`; const ap=document.getElementById('admin-panel'); if(ap) ap.style.display=(['admin','high','core','pioneer'].includes(s.rank)?'block':'none'); };

// ---------- quick helpers export for html onclicks ----------
w.crR=crR; w.dR=dR; w.oAS=oAS; w.oA=oA; w.sM=sM; w.loadRooms=loadRooms; w.loadMessages=loadMessages; w.joinRoom=joinRoom; w.lR=lR; w.lO=lO; // ensure functions available where used earlier
})();
