/*------------------  CORE IMPORTS  ------------------*/
import { db } from "./firebase-config.js";
import {
    ref as R, set as S, get as G, update as U, push as P, onValue as O, remove as X
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

/*====================================================
   SMALL OBFUSCATION UTIL
====================================================*/
const _r=(a)=>R(db,a), _G=G, _S=S, _U=U, _P=P, _X=X, _O=O;
const _t=(ms)=>new Promise(z=>setTimeout(z,ms));
const _N=(l)=>console.log(l);

/*====================================================
   GLOBAL USER
====================================================*/
window.CU = JSON.parse(localStorage.getItem("CU")||"{}");

/*====================================================
   RANK + POWER MAP
====================================================*/
const _rp={
    newbie:{r:"newbie",t:["newbie","newcomer"],cpm:1,tk:30,sp:[]},
    member:{r:"member",t:["member","user"],cpm:5,tk:20,sp:["msg","react"]},
    admin:{r:"admin",t:["admin","trusted"],cpm:15,tk:20,sp:["msg","react","room","mod1"]},
    high:{r:"high",t:["op","expert"],cpm:20,tk:25,sp:["msg","react","room","mod2"]},
    core:{r:"core",t:["full control","master"],cpm:45,tk:50,sp:["msg","react","room","mod3","acc"]},
    pioneer:{r:"pioneer",t:["founder","pioneer"],cpm:999999,tk:999999,sp:["msg","react","room","mod4","acc","rank","give"]}
};

/*====================================================
   SAVE CURRENT USER
====================================================*/
function _saveCU(){localStorage.setItem("CU",JSON.stringify(window.CU));}

/*====================================================
   LOGIN
====================================================*/
window.doLogin = async function(){
    let u=document.getElementById("lUser").value.trim(),
        p=document.getElementById("lPass").value.trim();
    let s=await _G(_r("users/"+u));
    if(!s.exists()) return alert("Unknown user.");
    let d=s.val();
    if(d.p!==p) return alert("Wrong password");
    window.CU={u:u,p:p,rank:d.rank,disp:d.disp,titles:d.titles||[],et:d.et||d.titles?.[0]||"",credits:d.credits||0};
    _saveCU();
    await _log(u,"login");
    location.href="dashboard.html";
};

/*====================================================
   CREATE ACCOUNT (CORE+PIONEER)
====================================================*/
window.mkAcc = async function(){
    if(!window.CU||!["core","pioneer"].includes(window.CU.rank)) return alert("No permission");
    let u=prompt("Username:");
    let p=prompt("Password:");
    if(!u||!p) return;
    let rnk="newbie";
    await _S(_r("users/"+u),{
        p:p, rank:rnk, disp:u, titles:_rp[rnk].t, et:_rp[rnk].t[0], credits:0
    });
    alert("Account created.");
};

/*====================================================
   LOG LOGIN/LOGOUT (10 day auto-purge)
====================================================*/
async function _log(u,t){
    let L=_r("logs/"+Date.now());
    await _S(L,{u:u,ev:t,t:Date.now()});
}
async function _purgeLogs(){
    let s=await _G(_r("logs"));
    if(!s.exists())return;
    let n=Date.now(),d10=10*24*60*60*1000;
    s.forEach(c=>{
        if(n-c.val().t>d10) _X(_r("logs/"+c.key));
    });
}
_purgeLogs();

/*====================================================
   AUTO CREDIT SYSTEM (EVERY 1 MIN)
====================================================*/
async function _creditTick(){
    if(!window.CU.u) return;
    let r=window.CU.rank;
    let inc=_rp[r].cpm;
    if(inc===999999) return;  
    let path="users/"+window.CU.u;
    let s=await _G(_r(path));
    if(!s.exists()) return;
    let d=s.val();
    d.credits=(d.credits||0)+1;
    await _U(_r(path),{credits:d.credits});
    window.CU.credits=d.credits;
    _saveCU();
    _checkPromotion(d);
}
async function _creditLoop(){
    while(true){await _t(60000); await _creditTick();}
}
_creditLoop();

/*====================================================
   AUTO PROMOTION
====================================================*/
async function _checkPromotion(d){
    let R=d.rank;
    let need=_rp[R].tk;
    if(!need||d.credits<need) return;
    if(R==="newbie"){
        await _U(_r("users/"+d.disp),{rank:"member"});
        window.CU.rank="member";
        _saveCU();
        alert("You ranked up to MEMBER!");
    }
}

/*====================================================
   SELLING TITLES (SHOP EXPIRATION)
====================================================*/
async function _purgeShop(){
    let s=await _G(_r("shop"));
    if(!s.exists())return;
    let n=Date.now();
    s.forEach(c=>{
        let v=c.val();
        if(!v.t) return;
        let rk=v.r;
        let lim=_rp[rk].tk*24*60*60*1000;  
        if(_rp[rk].tk>=999999) return;  
        if(n-v.ts>lim){
            _X(_r("shop/"+c.key));
        }
    });
}
_purgeShop();

/*====================================================
   AUCTION CLEANUP
====================================================*/
async function _purgeAuctions(){
    let s=await _G(_r("auctions"));
    if(!s.exists())return;
    s.forEach(c=>{
        let v=c.val();
        if(Date.now()>v.end) _X(_r("auctions/"+c.key));
    });
}
_purgeAuctions();

/*====================================================
   CREATE ROOM (ADMIN+)
====================================================*/
window.mkRoom = async function(rc){
    if(!rc) return;
    let s=await _G(_r("rooms/"+rc));
    if(s.exists()) return alert("Exists");
    await _S(_r("rooms/"+rc),{by:window.CU.u});
    alert("Created");
};

/*====================================================
   DELETE ROOM (ADMIN+)
====================================================*/
window.rmRoom = async function(rc){
    if(!rc) return;
    await _X(_r("rooms/"+rc));
    alert("Deleted");
};

/*====================================================
   LOAD ROOM LIST — RETURNS EXISTING ROOM CODES
====================================================*/
window.getRooms = async function(cb){
    _O(_r("rooms"),ss=>{
        let out=[];
        ss.forEach(c=>out.push(c.key));
        cb(out);
    });
};

/*====================================================
   REACTIONS
====================================================*/
window.reactMsg = async function(rm,id,em){
    let p="reactions/"+rm+"/"+id+"/"+window.CU.u;
    await _S(_r(p),{em:em,t:Date.now()});
};

/*====================================================
   SEND MESSAGE
====================================================*/
window.sendMsg = async function(){
    let rm=new URLSearchParams(location.search).get("room");
    let v=document.getElementById("msgIn").value.trim();
    if(!v) return;
    let M=_r("messages/"+rm);
    await _P(M,{u:window.CU.u,disp:window.CU.disp,msg:v,t:Date.now()});
    document.getElementById("msgIn").value="";
};

/*====================================================
   LOAD MESSAGES (AUTO PURGE >10 days)
====================================================*/
window.loadMsgs = function(rm,cb){
    _O(_r("messages/"+rm),ss=>{
        let out=[];
        let now=Date.now(),lim=10*24*60*60*1000;
        ss.forEach(c=>{
            let v=c.val();
            if(now-v.t>lim){ _X(_r("messages/"+rm+"/"+c.key)); return; }
            out.push({id:c.key,...v});
        });
        cb(out);
    });
};

/*====================================================
   COMMAND HANDLER (PARSED ON CHAT PAGE)
====================================================*/
window.doCmd = async function(cmd,rm){
    let p=cmd.split(" ");
    let C=p[0];
    let userR=_rp[window.CU.rank];

    if(C==="?/auction"){
        if(!userR.sp.includes("msg") && !userR.sp.includes("react")) return alert("No permission");
        let title=p[1].replace(/"/g,"");
        let sb=parseInt(p[2]);
        let tm=Math.min(parseInt(p[3]),300);
        let id=Date.now();
        await _S(_r("auctions/"+id),{
            t:title, sb:sb, by:window.CU.u, ts:Date.now(), end:Date.now()+tm*1000
        });
        alert("Auction started");
    }

    // … OTHER COMMANDS EXIST IN THE FULL VERSION
};

/*====================================================
   LOAD REACTIONS PER MESSAGE
====================================================*/
window.loadReact = function(rm,id,cb){
    _O(_r("reactions/"+rm+"/"+id),(ss)=>{
        let out=[];
        ss.forEach(c=>out.push(c.val()));
        cb(out);
    });
};

/*====================================================
   LOGOUT
====================================================*/
window.doLogout = async function(){
    if(window.CU?.u) await _log(window.CU.u,"logout");
    localStorage.removeItem("CU");
    location.href="index.html";
};
