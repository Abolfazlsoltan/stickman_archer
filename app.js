"use strict";
/* ============================================================
   استودیو استیکمن — Legacy Rig v2
   کاراکتر به سبک Stick War، گام‌برداری IK، فیزیک نیرو/اصطکاک
   ============================================================ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const damp=(c,t,k,dt)=>c+(t-c)*(1-Math.exp(-k*dt));
const rnd=(a=1,b=0)=>b+Math.random()*(a-b);
const PI=Math.PI, TAU=PI*2, DEG=180/PI;
const f2=v=>Number.isFinite(v)?Math.round(v*100)/100:0;
const fa=(v,d=0)=>Number(v).toLocaleString('fa-IR',{minimumFractionDigits:d,maximumFractionDigits:d});
const q=(t,a,b)=>clamp((t-a)/(b-a||1e-6),0,1);
const eo=t=>1-Math.pow(1-t,3), ei=t=>t*t*t;
const eio=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function h2r(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function r2h(r){return '#'+r.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('');}
function mix(a,b,t){const A=h2r(a),B=h2r(b);return r2h([lerp(A[0],B[0],t),lerp(A[1],B[1],t),lerp(A[2],B[2],t)]);}
function rgba(h,a){const c=h2r(h);return `rgba(${c[0]},${c[1]},${c[2]},${a})`;}
const shade=(c,a)=>mix(c,a>0?'#ffffff':'#000000',Math.abs(a));
function el(tag,cls,html){const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;}

/* ---------------- state ---------------- */
const DEFAULTS={
  mode:'studio', theme:'battle', ik:true, limits:true, invert:false, snap:true,
  joints:true, grid:true, vectors:false, ghost:false, props:true, shadow:true, cape:true,
  helmet:true, outline:true, rim:true, grain:true, parallax:true, follow:true,
  quality:(innerWidth<900?'med':'high'),
  thickness:15, headSize:1, heightScale:1, zoom:1.25, glow:.5,
  teamColor:'#d93a2b', inkColor:'#151a21', gear:'bare',
  gravity:981, mass:70, friction:.9, accel:1400, maxSpeed:345, jump:430,
  airControl:.35, wind:.25, rest:.06, timeScale:1, animSpeed:1,
  tlSpeed:1, tlEase:'smooth', loop:true, loopActions:true, sound:true,
  surface:'stone', selJoint:'shN', clip:'idle'
};
const S=Object.assign({},DEFAULTS);
const WALK=155, RUN=345, PPM=100, FIXED=1/120;

const SURF={
  stone:{name:'سنگ', mu:.9, top:'#5b4a33', deep:['#2b2318','#141009'], tuft:'#6b5a3c', kind:'pebble'},
  grass:{name:'چمن', mu:.78, top:'#4e7a34', deep:['#25321c','#111a0e'], tuft:'#79b04a', kind:'grass'},
  ice:{name:'یخ', mu:.08, top:'#9fd8ef', deep:['#2b4657','#101d27'], tuft:'#cfeeff', kind:'ice'},
  sand:{name:'شن', mu:1.15, top:'#c79a55', deep:['#4a3520','#211708'], tuft:'#e0b877', kind:'sand'}
};
const THEMES={
  battle:{name:'میدان نبرد',icon:'🌄',sky:['#141c33','#33294a','#8a4636','#e59248'],hill:['#1c2440','#262c4c','#33324f'],
    ink:'#151a21',bg:'#33294a',outline:'rgba(255,214,160,.34)',lw:1.1,accent:'#ffb020',grid:'rgba(255,206,140,.075)',
    joint:'#ffd166',eff:'#ff3da6',rim:'#ffd39a',shadow:'rgba(0,0,0,.42)',sun:true,glowMul:.35},
  neon:{name:'نئون مدرن',icon:'🌌',sky:['#05060c','#0a0a18','#12082a','#1a0a2e'],hill:['#0b0f22','#121230','#1a1440'],
    ink:'#0b0f18',bg:'#12082a',outline:'#41f0ff',lw:1.4,accent:'#41f0ff',grid:'rgba(65,240,255,.1)',
    joint:'#41f0ff',eff:'#ff3da6',rim:'#ff64c8',shadow:'rgba(255,61,166,.22)',sun:false,glowMul:1},
  minimal:{name:'مینیمال سفید',icon:'📄',sky:['#fbf5e8','#f6ecd8','#efe2c8','#e7d8ba'],hill:['#e4d6bb','#dccdaf','#d2c19f'],
    ink:'#151a21',bg:'#f6ecd8',outline:'rgba(20,24,30,.35)',lw:1,accent:'#c8892a',grid:'rgba(40,32,20,.07)',
    joint:'#c8892a',eff:'#d6316f',rim:'#ffffff',shadow:'rgba(60,45,25,.2)',sun:false,glowMul:0},
  blue:{name:'طراحی فنی',icon:'📐',sky:['#061a2c','#08243c','#0a2c48','#0d3454'],hill:['#0a2438','#0c2c44','#0f3550'],
    ink:'#bfe9ff',bg:'#0a2438',outline:'#bfe9ff',lw:1.5,accent:'#7fe3ff',grid:'rgba(160,225,255,.14)',
    joint:'#ffe08a',eff:'#ff8ac4',rim:'#ffffff',shadow:'rgba(0,0,0,.25)',sun:false,glowMul:.5,tech:true}
};
const GEARS={
  bare:{name:'بدون تجهیز',icon:'✊'}, sword:{name:'شمشیر و سپر',icon:'⚔️'},
  spear:{name:'نیزه و کلاه‌خود',icon:'🛡️'}, bow:{name:'کمان و ترکش',icon:'🏹'},
  miner:{name:'کلنگ معدن',icon:'⛏️'}, staff:{name:'عصای جادو',icon:'✨'}, club:{name:'گرز سنگین',icon:'🪓'}
};

/* ---------------- rig ---------------- */
const JK=['torso','chest','head','shN','elN','wrN','shF','elF','wrF','hipN','knN','anN','hipF','knF','anF'];
const LIM={torso:[-.6,.95],chest:[-.5,.5],head:[-.7,.7],shN:[-2.9,3.2],elN:[0,2.6],wrN:[-1,1],
  shF:[-2.9,3.2],elF:[0,2.6],wrF:[-1,1],hipN:[-1.5,2.9],knN:[0,2.5],anN:[-.9,.9],hipF:[-1.5,2.9],knF:[0,2.5],anF:[-.9,.9]};
const JLABEL={torso:'ستون فقرات',chest:'سینه',head:'سر / گردن',shN:'شانه نزدیک',elN:'آرنج نزدیک',wrN:'مچ نزدیک',
  shF:'شانه دور',elF:'آرنج دور',wrF:'مچ دور',hipN:'ران نزدیک',knN:'زانوی نزدیک',anN:'مچ پای نزدیک',
  hipF:'ران دور',knF:'زانوی دور',anF:'مچ پای دور',hipH:'ارتفاع لگن'};
function rig(){const k=S.heightScale;return{spine:46*k,neck:11*k,headL:15*k,thigh:42*k,shin:40*k,foot:15*k,
  upper:30*k,fore:28*k,hand:7*k,headR:14.6*k*S.headSize*(.86+.14*S.thickness/15)};}
const standH=()=>(rig().thigh+rig().shin)*.95;
function basePose(){return{torso:.05,chest:-.03,head:0,shN:.1,elN:.22,wrN:0,shF:-.08,elF:.26,wrF:0,
  hipN:.06,knN:.1,anN:-.03,hipF:-.06,knF:.12,anF:0,hipH:standH(),rootDX:0,bodyRot:0};}
let cur=basePose(), customPose=null;
const lim=(k,v)=>S.limits&&LIM[k]?clamp(v,LIM[k][0],LIM[k][1]):v;

function makeXform(p,bx,by,dir,sx,sy){
  const pv={x:p.rootDX,y:-p.hipH}, c=Math.cos(p.bodyRot), s=Math.sin(p.bodyRot);
  return{pv,
    L2W(l){const dx=l.x-pv.x,dy=l.y-pv.y;
      return{x:bx+(pv.x+dx*c-dy*s)*dir*sx,y:by+(pv.y+dx*s+dy*c)*sy};},
    W2L(w){const X=(w.x-bx)/(dir*sx)-pv.x,Y=(w.y-by)/sy-pv.y;
      return{x:pv.x+X*c+Y*s,y:pv.y-X*s+Y*c};}};
}
const vec=(a,L)=>({x:Math.cos(a)*L,y:Math.sin(a)*L});
const add=(p,v)=>({x:p.x+v.x,y:p.y+v.y});
const ang=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x);
const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);

function skeleton(p,xf){
  const L=rig(), pv=xf.pv, A={}, P={};
  A.torso=-PI/2+p.torso; P.pelvis={...pv};
  P.chest=add(pv,vec(A.torso,L.spine));
  A.neck=A.torso+p.chest; P.neck=add(P.chest,vec(A.neck,L.neck));
  A.head=A.neck+p.head; P.head=add(P.neck,vec(A.head,L.headL));
  const perp=A.torso+PI/2;
  P.shoulderN=add(add(P.chest,vec(perp,3)),vec(A.torso,-2));
  P.shoulderF=add(add(P.chest,vec(perp,-4)),vec(A.torso,-1));
  A.upN=PI/2-p.shN; P.elbowN=add(P.shoulderN,vec(A.upN,L.upper));
  A.foN=A.upN-p.elN; P.handN=add(P.elbowN,vec(A.foN,L.fore));
  A.haN=A.foN-p.wrN; P.fistN=add(P.handN,vec(A.haN,L.hand*.5));
  A.upF=PI/2-p.shF; P.elbowF=add(P.shoulderF,vec(A.upF,L.upper));
  A.foF=A.upF-p.elF; P.handF=add(P.elbowF,vec(A.foF,L.fore));
  A.haF=A.foF-p.wrF; P.fistF=add(P.handF,vec(A.haF,L.hand*.5));
  P.hipJN=add(pv,{x:2.5,y:0}); P.hipJF=add(pv,{x:-3.5,y:1});
  A.thN=PI/2-p.hipN; P.kneeN=add(P.hipJN,vec(A.thN,L.thigh));
  A.shN2=A.thN+p.knN; P.ankleN=add(P.kneeN,vec(A.shN2,L.shin));
  A.ftN=A.shN2-PI/2+p.anN; P.toeN=add(P.ankleN,vec(A.ftN,L.foot));
  A.thF=PI/2-p.hipF; P.kneeF=add(P.hipJF,vec(A.thF,L.thigh));
  A.shF2=A.thF+p.knF; P.ankleF=add(P.kneeF,vec(A.shF2,L.shin));
  A.ftF=A.shF2-PI/2+p.anF; P.toeF=add(P.ankleF,vec(A.ftF,L.foot));
  const J={abs:A,headR:L.headR};
  for(const k in P) J[k]=xf.L2W(P[k]);
  J.local=P;
  return J;
}
function ik2(hipL,target,L1,L2,pol){
  let dx=target.x-hipL.x, dy=target.y-hipL.y;
  let d=Math.hypot(dx,dy); const mn=Math.abs(L1-L2)+.5, mx=L1+L2-.5;
  const cd=clamp(d,mn,mx);
  if(d>1e-5){dx*=cd/d;dy*=cd/d;} else {dx=0;dy=cd;}
  const t={x:hipL.x+dx,y:hipL.y+dy}, a=Math.atan2(dy,dx);
  const al=Math.acos(clamp((L1*L1+cd*cd-L2*L2)/(2*L1*cd),-1,1));
  const a1=a-al*pol, knee=add(hipL,vec(a1,L1)), a2=ang(knee,t);
  return{a1,a2,knee,target:t};
}
function ikLeg(world,side,footAngle){
  const L=rig(), xf=makeXform(cur,body.x,body.y,body.facing,sq.x,sq.y);
  const hipL=side==='N'?add(xf.pv,{x:2.5,y:0}):add(xf.pv,{x:-3.5,y:1});
  const t=xf.W2L(world), pol=S.invert?-1:1;
  const r=ik2(hipL,t,L.thigh,L.shin,pol);
  let kn=r.a2-r.a1; if(S.limits)kn=clamp(kn,LIM.knN[0],LIM.knN[1]);
  return{hip:lim(side==='N'?'hipN':'hipF',PI/2-r.a1),kn,an:lim(side==='N'?'anN':'anF',(footAngle||0)-r.a1-kn+PI/2)};
}
function ikArm(world,side){
  const L=rig(), xf=makeXform(cur,body.x,body.y,body.facing,sq.x,sq.y);
  const perp=-PI/2+cur.torso+PI/2;
  const shL=side==='N'?add(add(xf.pv,vec(-PI/2+cur.torso,L.spine)),add(vec(perp,3),vec(-PI/2+cur.torso,-2)))
                      :add(add(xf.pv,vec(-PI/2+cur.torso,L.spine)),add(vec(perp,-4),vec(-PI/2+cur.torso,-1)));
  const t=xf.W2L(world), pol=S.invert?1:-1;
  const r=ik2(shL,t,L.upper,L.fore,pol);
  let el=r.a1-r.a2; if(S.limits)el=clamp(el,0,LIM.elN[1]);
  return{sh:lim(side==='N'?'shN':'shF',PI/2-r.a1),el};
}

/* ---------------- body / physics ---------------- */
const body={x:0,y:0,vx:0,vy:0,onGround:true,coyote:0,jumpBuf:0,facing:1,ax:0,force:0,fric:0,held:false};
let dirBlend=1, landCrouch=0, sq={x:1,y:1}, sqv=0, shake=0, camX=0, camY=0, fps=60;
const stats={steps:0,hits:0,dist:0,apex:0,jumps:0};
const feet=[{off:10,plant:{x:10,y:0},sw:null},{off:-12,plant:{x:-12,y:0},sw:null}];
const boxes=[{x:360,y:-56,w:130,h:56},{x:520,y:-108,w:112,h:108}];
const rock={x:-330,hp:0};
const target={x:690,y:-96,r:36,flash:0};
const bag={x:250,top:-232,len:150,a:0,v:0,flash:0};
const bagPos=()=>({x:bag.x+Math.sin(bag.a)*bag.len,y:bag.top+Math.cos(bag.a)*bag.len});
function surfaceYAt(x){
  if(!(S.props&&S.mode==='field'))return 0;
  let y=0; for(const b of boxes) if(x>b.x-4&&x<b.x+b.w+4) y=Math.min(y,b.y);
  return y;
}
const keys={left:false,right:false}; let touchAxis=0;
const axisInput=()=>clamp((keys.right?1:0)-(keys.left?1:0)+touchAxis,-1,1);
function desiredMotion(){
  if(S.mode==='studio'){
    const m=CLIPS[active.name]||CLIPS.idle;
    if(m.loco==='walk')return{input:body.facing,max:WALK*S.animSpeed};
    if(m.loco==='run')return{input:body.facing,max:RUN*S.animSpeed};
    return{input:0,max:S.maxSpeed};
  }
  const a=axisInput(); return{input:a,max:S.maxSpeed*(Math.abs(a)>.05?1:0)};
}
function doJump(k=1){
  if(!(body.onGround||body.coyote>0)||body.held)return;
  body.vy=-S.jump*k; body.onGround=false; body.coyote=0; body.jumpBuf=0;
  sqv=1.1; stats.jumps++; sfx.jump(); dust(body.x,body.y,9,1);
}
function land(y){
  const impact=body.vy; body.y=y;
  if(impact>240&&S.rest>.05){body.vy=-impact*S.rest;body.onGround=false;}
  else{body.vy=0;body.onGround=true;}
  if(impact>90){
    landCrouch=clamp(impact/700,0,1.2); sqv=-clamp(impact/620,.15,1.1);
    shake=Math.min(14,shake+impact*.008); dust(body.x,y,Math.round(clamp(impact/60,4,20)),1.3);
    sfx.land(impact);
    feet.forEach((f,i)=>{f.sw=null;f.plant={x:body.x+body.facing*f.off,y:surfaceYAt(body.x+body.facing*f.off)};});
    if(active.name==='jump'&&!active.fired.land){active.fired.land=1;active.fired.landT=active.t;}
  }
}
function slipFx(){
  if(Math.random()<.35){const f=feet[Math.random()<.5?0:1];
    spawn('dust',f.plant.x,f.plant.y,1,{vx:-body.vx*.25,vy:-rnd(40,10),col:SURF[S.surface].tuft});}
}
function physicsStep(dt){
  const g=S.gravity, mu=S.friction, mo=desiredMotion(), input=body.held?0:mo.input;
  const prev=body.vx;
  let cmd=input!==0?clamp((mo.max*input-body.vx)*7,-S.accel,S.accel):0, a=cmd;
  if(body.onGround){
    const tr=mu*g;
    if(Math.abs(a)>tr){if(Math.abs(cmd)>tr+120&&Math.abs(body.vx)>25)slipFx();a=Math.sign(a)*tr;}
    body.fric=input===0?-Math.sign(body.vx)*mu*S.mass*g:0;
  }else{a*=S.airControl;body.fric=0;}
  body.vx+=a*dt;
  if(input===0&&body.onGround){const d=mu*g*.6*dt;body.vx=Math.abs(body.vx)<=d?0:body.vx-Math.sign(body.vx)*d;}
  body.vx+=S.wind*46*dt*(body.onGround?.12:1);
  body.force=a*S.mass;
  body.ax=(body.vx-prev)/dt;
  if(!body.held){
    body.vy+=g*dt; body.x+=body.vx*dt; body.y+=body.vy*dt;
    body.onGround=false;
    if(body.y>=0)land(0);
    if(S.props&&S.mode==='field'){
      const L=rig(), H=(L.spine+L.neck+L.headL+L.headR+standH())*.92, hw=12*S.heightScale;
      for(const b of boxes){
        const cx=body.x,top=body.y-H,bot=body.y,bx2=b.x+b.w,by2=b.y+b.h;
        if(cx+hw>b.x&&cx-hw<bx2&&bot>b.y&&top<by2){
          const ox=Math.min(cx+hw-b.x,bx2-(cx-hw)), oy=Math.min(bot-b.y,by2-top);
          if(oy<ox){ if(bot-b.y<by2-top)land(b.y); else{body.y=by2+H;body.vy=Math.max(0,body.vy);} }
          else{ body.x=cx<(b.x+bx2)/2?b.x-hw:bx2+hw; body.vx*=-S.rest; }
        }
      }
    }
  }else{body.vx=0;body.vy=0;body.onGround=false;}
  if(body.onGround)body.coyote=.1; else body.coyote=Math.max(0,body.coyote-dt);
  body.jumpBuf=Math.max(0,body.jumpBuf-dt);
  if(body.jumpBuf>0&&(body.onGround||body.coyote>0))doJump();
  stats.dist+=Math.abs(body.vx)*dt; stats.apex=Math.max(stats.apex,-body.y);
  // bag pendulum
  bag.v+=(-(g/Math.max(40,bag.len))*Math.sin(bag.a)-bag.v*1.1)*dt; bag.a+=bag.v*dt;
  bag.flash=Math.max(0,bag.flash-dt*3); target.flash=Math.max(0,target.flash-dt*3);
  // cloth (fixed step verlet)
  clothStep(cape,capeAnchor,dt,9*S.heightScale,1);
  if(S.helmet)clothStep(plume,plumeAnchor,dt,7*S.heightScale,1.5);
}
/* cloth */
function makeCloth(n){return{pts:[],n};}
const cape=makeCloth(6), plume=makeCloth(4);
let capeAnchor={x:0,y:-100}, plumeAnchor={x:0,y:-160};
function clothStep(c,anchor,dt,seg,windMul){
  const n=S.quality==='low'?Math.max(3,c.n-2):c.n;
  if(c.pts.length!==n){c.pts=Array.from({length:n},(_,i)=>({x:anchor.x,y:anchor.y+i*seg,px:anchor.x,py:anchor.y+i*seg}));}
  c.pts[0].x=anchor.x;c.pts[0].y=anchor.y;c.pts[0].px=anchor.x;c.pts[0].py=anchor.y;
  const ax=(S.wind*340-body.vx*2.4)*windMul, ay=S.gravity*.85;
  for(let i=1;i<n;i++){const p=c.pts[i];
    const vx=(p.x-p.px)*.985, vy=(p.y-p.py)*.985;
    p.px=p.x;p.py=p.y; p.x+=vx+ax*dt*dt; p.y+=vy+ay*dt*dt;}
  for(let k=0;k<3;k++)for(let i=1;i<n;i++){
    const a=c.pts[i-1],b=c.pts[i];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-4;
    const diff=(d-seg)/d*.5;
    if(i>1){a.x+=dx*diff;a.y+=dy*diff;}
    b.x-=dx*diff*(i>1?1:2);b.y-=dy*diff*(i>1?1:2);
    const gy=surfaceYAt(b.x)-1; if(b.y>gy)b.y=gy;
  }
}

/* ---------------- clips ---------------- */
let active={name:'idle',t:0,fired:{},once:false};
function armSwing(T,C,amp,bend){
  const sN=clamp(((footPos(0).x-body.x)*C.dir)*.014,-.85,.85);
  const hold=S.gear!=='bare', a=amp*(hold?.5:1);
  T.shN=-sN*a+(hold?.35:.05); T.shF=sN*a+(hold?.2:-.05);
  T.elN=bend+Math.max(0,-sN)*.5+(hold?.5:0); T.elF=bend+.1+Math.max(0,sN)*.4+(hold?.6:0);
  if(S.gear==='miner'){T.shN=1.15;T.elN=1.5;}
  if(S.gear==='spear'){T.shN=.55;T.elN=.95;}
  if(S.gear==='staff'){T.shN=.5;T.elN=.75;}
}
const CLIPS={
  idle:{label:'ایستاده',icon:'🧍',dur:4.4,kind:'state',resp:13,fn:(t,T)=>{
    const b=Math.sin(t*1.7);T.stance=[10,-12];
    T.torso+=.022*b;T.hipH+=.9*b;T.head+=.05*Math.sin(t*.6);
    T.shN+=.05*Math.sin(t*1.7+.4);T.shF-=.05*Math.sin(t*1.7+.2);T.rootDX+=1.6*Math.sin(t*.45);}},
  guard:{label:'گارد',icon:'🛡️',dur:3.2,kind:'state',resp:14,fn:(t,T)=>{
    const b=Math.sin(t*3.1);T.stance=[20,-18];
    T.hipH=standH()*(.86+.012*b);T.torso=.18+.02*b;T.chest=-.07;T.head=-.08;
    T.shN=.55+.05*b;T.elN=1.45+.06*b;T.wrN=-.15;T.shF=.78+.04*b;T.elF=1.65;T.rootDX=-2;}},
  walk:{label:'راه رفتن',icon:'🚶',dur:1,kind:'state',loco:'walk',resp:16,fn:(t,T,C)=>{
    T.loco='walk';T.stance=[9,-11];T.hipAuto=true;T.torso+=.07;T.head-=.02;armSwing(T,C,.8,.28);}},
  run:{label:'دویدن',icon:'🏃',dur:1,kind:'state',loco:'run',resp:20,fn:(t,T,C)=>{
    T.loco='run';T.stance=[10,-12];T.hipAuto=true;T.crouch=.97;T.torso+=.2;T.head-=.06;armSwing(T,C,1.15,1);}},
  air:{hidden:true,dur:1,kind:'state',resp:18,fn:(t,T,C)=>{
    T.air=true;const tuck=C.vy<-40?1:(C.vy>60?.35:.6);
    T.hipH=standH()*(.86-.06*tuck);
    T.hipN=.55+.7*tuck;T.knN=.5+1.1*tuck;T.anN=.15;T.hipF=-.35+.3*tuck;T.knF=.35+.7*tuck;T.anF=.1;
    T.shN=1.2+.5*tuck;T.elN=.6;T.shF=-.9-.3*tuck;T.elF=.7;T.torso=.1+.1*tuck;T.head=-.06;
    const h=-body.y;if(C.vy>60&&h<80){const p=1-h/80;T.hipH-=9*p;T.torso+=.1*p;}}},
  jump:{label:'پرش',icon:'🦘',dur:3,kind:'action',waitLand:true,resp:24,fn:(t,T,C)=>{
    T.stance=[10,-12];
    if(t<.16){const w=eio(t/.16);T.hipH=standH()*(.95-.24*w);T.torso=.05+.24*w;
      T.shN=-.55*w;T.shF=-.45*w;T.elN=.3+.5*w;T.elF=.3+.5*w;T.rootDX=-3*w;}
    else{
      if(!C.fired.go){C.fired.go=1;doJump();}
      if(!body.onGround&&!C.fired.land)CLIPS.air.fn(t,T,C);
      else{const lt=C.fired.landT||t,r=eio(q(t,lt+.02,lt+.42));
        T.hipH=standH()*(.72+.23*r);T.torso=.3*(1-r)+.05;T.shN=.45*(1-r);T.elN=.6*(1-r)+.22;}
    }}},
  wave:{label:'سلام',icon:'👋',dur:2.2,kind:'state',resp:18,fn:(t,T)=>{
    const w=Math.sin(t*6.5);T.stance=[10,-12];
    T.shN=2.35+.08*Math.sin(t*1.5);T.elN=.55+.38*w;T.wrN=.2*w;T.shF=-.12;T.elF=.3;
    T.torso=.04-.05*Math.sin(t*1.5);T.head=.12+.05*w;
    T.hipH=standH()*(.955+.008*Math.sin(t*1.5));T.rootDX=1.5*Math.sin(t*.8);}},
  kick:{label:'ضربه پا',icon:'🥋',dur:.86,kind:'action',resp:28,fn:(t,T,C)=>{
    T.stance=[-6,-14];const s=eio(q(t,.2,.42)),r=eio(q(t,.5,.86));
    const kx=body.x+C.dir*(-10+104*s-64*r), ky=body.y-(28+80*s-72*r);
    T.footN={x:kx,y:ky};T.footAngleN=.5*s;
    T.hipH=standH()*(.92-.06*s+.04*r);T.torso=.05-.34*s+.3*r;T.chest=-.05-.1*s;T.head=.1*s;
    T.shN=.3-1.1*s+.9*r;T.elN=.5+.7*s;T.shF=-.2+.9*s-.7*r;T.elF=.4+.5*s;T.rootDX=-3-4*s+5*r;
    if(!C.fired.sw&&t>.2){C.fired.sw=1;sfx.swoosh();body.vx+=C.dir*70;}
    if(!C.fired.hit&&t>.34){C.fired.hit=1;hitCheck(kx,ky,'kick');}}},
  sword:{label:'شمشیر',icon:'⚔️',dur:.78,kind:'action',gear:'sword',resp:30,fn:(t,T,C)=>{
    T.stance=[16,-18];const w=eio(q(t,0,.24)),s=eo(q(t,.24,.44)),r=eio(q(t,.46,.78));
    T.shN=lerp(lerp(.5,2.75,w),.45,s);T.shN=lerp(T.shN,.55,r);
    T.elN=lerp(lerp(1.4,.45,w),.12,s);T.elN=lerp(T.elN,1.4,r);T.wrN=-.2*w+.3*s;
    T.torso=lerp(lerp(.14,-.18,w),.34,s);T.torso=lerp(T.torso,.18,r);T.chest=-.06+.12*s;
    T.rootDX=-4*w+10*s-6*r;T.hipH=standH()*(.88-.04*w+.02*s+.06*r);
    T.shF=.7+.3*s;T.elF=1.6-.3*s;
    if(!C.fired.sw&&t>.26){C.fired.sw=1;sfx.swoosh();body.vx+=C.dir*130;}
    if(!C.fired.hit&&t>.37){C.fired.hit=1;const h=live.J.handN;hitCheck(h.x+C.dir*46,h.y+10,'slash');}}},
  spear:{label:'نیزه',icon:'🔱',dur:.82,kind:'action',gear:'spear',resp:28,fn:(t,T,C)=>{
    T.stance=[18,-20];const w=eio(q(t,0,.3)),s=eo(q(t,.3,.46)),r=eio(q(t,.52,.82));
    T.shN=lerp(lerp(.5,.05,w),1.45,s);T.shN=lerp(T.shN,.55,r);
    T.elN=lerp(lerp(1.3,1.75,w),.06,s);T.elN=lerp(T.elN,1.0,r);
    T.shF=.6+.5*s;T.elF=1.5-.5*s;T.torso=lerp(lerp(.14,-.1,w),.3,s);T.torso=lerp(T.torso,.18,r);
    T.rootDX=-5*w+14*s-8*r;T.hipH=standH()*(.87-.03*w+.05*r);
    if(!C.fired.sw&&t>.3){C.fired.sw=1;sfx.swoosh(.8);body.vx+=C.dir*175;}
    if(!C.fired.hit&&t>.42){C.fired.hit=1;const h=live.J.handN;hitCheck(h.x+C.dir*84,h.y,'slash');}}},
  bow:{label:'کمان',icon:'🏹',dur:1.2,kind:'action',gear:'bow',resp:24,fn:(t,T,C)=>{
    T.stance=[12,-16];T.hipH=standH()*.93;T.torso=.08;T.head=-.04;T.rootDX=-2;
    const d=eio(q(t,.15,.55)),rel=q(t,.62,.72),rec=eio(q(t,.78,1.2));
    const cy=body.y-T.hipH-rig().spine*.85;
    T.handF={x:body.x+C.dir*(48-8*rel-14*rec),y:cy-4};
    T.handN={x:body.x+C.dir*(22-32*d+38*rel-6*rec),y:cy+3};
    T.bowDraw=d*(1-rel);
    if(!C.fired.rel&&t>.62){C.fired.rel=1;shootArrow();body.vx-=C.dir*45;}}},
  mine:{label:'کلنگ',icon:'⛏️',dur:1,kind:'action',gear:'miner',resp:26,fn:(t,T,C)=>{
    T.stance=[14,-16];const u=eio(q(t,0,.36)),d=eo(q(t,.36,.52)),r=eio(q(t,.56,1));
    T.shN=lerp(lerp(.6,2.5,u),.25,d);T.shN=lerp(T.shN,.6,r);
    T.elN=lerp(lerp(1.2,.5,u),.15,d);T.elN=lerp(T.elN,1.2,r);
    T.shF=lerp(lerp(.5,2.2,u),.35,d);T.shF=lerp(T.shF,.5,r);
    T.elF=lerp(lerp(1.3,.6,u),.2,d);T.elF=lerp(T.elF,1.3,r);
    T.torso=lerp(lerp(.1,-.2,u),.5,d);T.torso=lerp(T.torso,.1,r);
    T.hipH=standH()*(.9-.05*u+.02*d+.05*r);
    if(!C.fired.hit&&t>.5){C.fired.hit=1;mineHit();}}},
  cast:{label:'جادو',icon:'✨',dur:1.5,kind:'action',gear:'staff',resp:20,fn:(t,T,C)=>{
    T.stance=[10,-14];const u=eio(q(t,0,.5)),ch=q(t,.5,.95),rel=eo(q(t,.95,1.08)),r=eio(q(t,1.1,1.5));
    T.shN=lerp(lerp(.4,2.6,u),1.35,rel);T.shN=lerp(T.shN,.5,r);
    T.elN=lerp(lerp(.9,.25,u),.1,rel);T.elN=lerp(T.elN,.75,r);
    T.shF=.3+.4*u-.3*rel;T.elF=.9+.4*ch;T.torso=-.06*u+.16*rel;T.head=-.1*u;
    T.hipH=standH()*(.94+.03*u-.02*rel);T.orb=Math.max(ch,rel*.6)*(1-r);
    if(ch>0&&ch<1&&Math.random()<.5){const h=live.J.handN;
      spawn('magic',h.x+C.dir*40+rnd(30,-30),h.y-20+rnd(30,-30),1,{vx:0,vy:-rnd(30),col:S.teamColor});}
    if(!C.fired.rel&&t>.96){C.fired.rel=1;castRelease();}}},
  victory:{label:'پیروزی',icon:'🏆',dur:1.7,kind:'action',resp:16,fn:(t,T,C)=>{
    T.stance=[12,-12];const b=Math.sin(t*4.2);
    T.shN=2.5+.12*b;T.elN=.35+.1*b;T.shF=2.4-.12*b;T.elF=.4-.1*b;
    T.torso=-.06;T.head=-.12;T.hipH=standH()*(.97+.02*b);
    if(!C.fired.j1&&t>.25){C.fired.j1=1;if(body.onGround){body.vy=-S.jump*.45;body.onGround=false;sqv=.8;sfx.jump(.6);dust(body.x,body.y,6,1);}}
    if(!C.fired.j2&&t>.95){C.fired.j2=1;if(body.onGround){body.vy=-S.jump*.45;body.onGround=false;sqv=.8;sfx.jump(.6);dust(body.x,body.y,6,1);}}}},
  fall:{label:'سقوط',icon:'💥',dur:2.7,kind:'action',resp:13,snapAll:true,fn:(t,T,C)=>{
    const dn=eio(q(t,0,.55)),up=eio(q(t,1.75,2.7)),k=dn*(1-up);
    T.bodyRot=-1.45*k;T.hipH=lerp(standH()*.95,14,k);
    T.hipN=lerp(.06,2.55,k);T.knN=lerp(.1,.35,k);T.anN=lerp(0,.2,k);
    T.hipF=lerp(-.06,2.35,k);T.knF=lerp(.12,.6,k);T.anF=lerp(0,.15,k);
    T.shN=lerp(.1,1.5,k);T.elN=lerp(.22,.5,k);T.shF=lerp(-.08,1.1,k);T.elF=lerp(.26,.8,k);
    T.torso=lerp(.05,.2,k);T.head=lerp(0,.25,k);
    T.air=k>.25||(!body.onGround&&t<.8);
    if(!C.fired.push&&t<.03){C.fired.push=1;body.vx-=C.dir*150;body.vy=-235;body.onGround=false;sfx.hit(.8);shake=9;}
    if(!C.fired.dust&&body.onGround&&t>.3){C.fired.dust=1;dust(body.x,body.y,16,1.4);sfx.land(520);}}},
  custom:{hidden:true,dur:1,kind:'state',resp:60,fn:(t,T)=>{if(customPose)Object.assign(T,customPose);T.custom=true;}}
};
const CLIP_ORDER=['idle','guard','walk','run','jump','wave','kick','sword','spear','bow','mine','cast','victory','fall'];
const POSES={
  std:{label:'استاندارد',icon:'🧍',make:()=>basePose()},
  guard:{label:'گارد رزمی',icon:'🛡️',make:()=>Object.assign(basePose(),{hipH:standH()*.86,torso:.18,chest:-.07,head:-.08,shN:.55,elN:1.45,wrN:-.15,shF:.78,elF:1.65,hipN:.3,knN:.35,hipF:-.25,knF:.4})},
  tpose:{label:'T-Pose',icon:'✝️',make:()=>Object.assign(basePose(),{torso:0,chest:0,head:0,shN:PI/2,elN:.02,shF:PI/2,elF:.02,hipN:.02,knN:.02,hipF:-.02,knF:.02,hipH:standH()*.99})},
  throw:{label:'پرتاب',icon:'🎯',make:()=>Object.assign(basePose(),{torso:-.16,chest:.1,head:.1,shN:2.9,elN:1.1,wrN:-.4,shF:1.3,elF:.5,hipN:.55,knN:.3,hipF:-.4,knF:.5,rootDX:-4,hipH:standH()*.9})},
  sit:{label:'نشسته',icon:'🧘',make:()=>Object.assign(basePose(),{hipH:26*S.heightScale,torso:.12,head:.05,shN:.35,elN:.85,shF:.3,elF:.9,hipN:1.5,knN:2.3,anN:.3,hipF:1.35,knF:2.4,anF:.25})},
  cheer:{label:'سلام بلند',icon:'🙌',make:()=>Object.assign(basePose(),{shN:2.6,elN:.3,shF:2.5,elF:.35,torso:-.08,head:-.14,hipH:standH()*.98})}
};

/* ---------------- clip manager ---------------- */
function setClip(name,opt={}){
  if(!CLIPS[name])return;
  if(name==='jump'&&S.mode==='field'){body.jumpBuf=.14;doJump();return;}
  if(CLIPS[name].gear&&S.gear!==CLIPS[name].gear)set('gear',CLIPS[name].gear);
  if(name!=='custom')customPose=null;
  active={name,t:0,fired:{},once:S.mode==='field'&&CLIPS[name].kind==='action'};
  if(CLIPS[name].kind==='state')S.baseClip=name;
  S.clip=name; syncClipUI();
  if(!opt.silent)sfx.ui();
}
const ensureClip=n=>{if(active.name!==n)setClip(n,{silent:true});};
function enterCustom(){
  if(active.name==='custom')return;
  customPose=Object.assign({},cur);customPose.dir=body.facing;
  active={name:'custom',t:0,fired:{},once:false};S.clip='custom';syncClipUI();
}
function tickClips(dt){
  const m=CLIPS[active.name]||CLIPS.idle;
  active.t+=dt*S.animSpeed;
  if(S.mode==='field'){
    if(active.once){
      const done=m.waitLand?(active.fired.land&&active.t>(active.fired.landT||0)+.45):active.t>=m.dur;
      if(done){active.once=false;setClip(baseState(),{silent:true});}
    }else if(active.name!=='custom'){
      if(!body.onGround)ensureClip('air');
      else{const a=axisInput();
        if(Math.abs(a)>.05||Math.abs(body.vx)>28)ensureClip(Math.abs(body.vx)>215?'run':'walk');
        else ensureClip(baseState());}
    }
  }else{
    if(m.waitLand){
      if(active.fired.land&&active.t>(active.fired.landT||0)+.5){active.t=0;active.fired={};}
      else if(active.t>6){active.t=0;active.fired={};}
    }else if(active.t>=m.dur){
      if(m.kind==='action'&&!S.loopActions){setClip('idle',{silent:true});}
      else{active.t%=m.dur;active.fired={};}
    }
  }
}
function baseState(){const b=S.baseClip||'idle';return CLIPS[b]&&CLIPS[b].kind==='state'&&b!=='air'?b:'idle';}

/* ---------------- feet ---------------- */
function footPos(i){
  const f=feet[i];if(!f.sw)return f.plant;
  const t=clamp(f.sw.t,0,1),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  return{x:lerp(f.sw.from.x,f.sw.to.x,e),y:lerp(f.sw.from.y,f.sw.to.y,e)-f.sw.lift*Math.sin(PI*t)};
}
function updateFeet(dt,T){
  const dir=body.facing,loco=T.loco,spd=Math.abs(body.vx);
  const stride=loco==='run'?58:42;
  const dur=loco==='run'?clamp(.3-spd*.00035,.16,.3):clamp(.44-spd*.0006,.24,.44);
  const lift=loco==='run'?24:12;
  for(let i=0;i<2;i++){
    const f=feet[i],over=i===0?T.footN:T.footF;
    if(over){f.sw=null;f.plant={x:over.x,y:over.y};continue;}
    const off=T.stance?T.stance[i]:f.off;
    const tx=body.x+dir*off+body.vx*dur*.85, gy=surfaceYAt(tx);
    if(f.sw){
      f.sw.t+=dt/f.sw.dur;
      if(f.sw.t>=1){f.plant={x:f.sw.to.x,y:f.sw.to.y};f.sw=null;footfall(i);}
    }else if(loco){
      const err=(tx-f.plant.x)*dir,other=feet[1-i];
      const gate=loco==='run'?(!other.sw||other.sw.t>.55):!other.sw;
      if(gate&&(err>stride*.5||Math.abs(f.plant.y-surfaceYAt(f.plant.x))>7))
        f.sw={from:{...f.plant},to:{x:tx+dir*stride*.3,y:gy},t:0,dur,lift};
    }else{
      f.plant.x=damp(f.plant.x,body.x+dir*off,9,dt);
      f.plant.y=damp(f.plant.y,surfaceYAt(body.x+dir*off),14,dt);
    }
  }
}
function footfall(i){
  const f=feet[i],sp=Math.abs(body.vx);
  stats.steps++;dust(f.plant.x,f.plant.y,sp>200?5:3,sp>200?1.1:.7);
  sfx.step(sp);if(sp>250)shake=Math.min(shake+.7,6);
}
function geoHip(T){
  const L=rig(),R=(L.thigh+L.shin)*.99,px=body.x+cur.rootDX*body.facing;
  let h=standH(),n=0;
  for(let i=0;i<2;i++){
    if(feet[i].sw)continue;n++;
    const fp=footPos(i),dx=Math.abs(px-fp.x);
    h=Math.min(h,Math.sqrt(Math.max(1,R*R-dx*dx))+(body.y-fp.y));
  }
  if(!n)h=standH()*.88;
  return clamp(h*(T.crouch||1),standH()*.5,standH());
}

/* ---------------- pose update ---------------- */
let live={J:null,shapes:[]};
function updatePose(dt){
  const T=basePose(),m=CLIPS[active.name]||CLIPS.idle;
  T.stance=[10,-12];T.loco=null;T.air=false;T.footN=null;T.footF=null;T.handN=null;T.handF=null;
  T.hipAuto=false;T.bowDraw=0;T.orb=0;T.footAngleN=0;T.footAngleF=0;T.crouch=1;
  const C={t:active.t,dir:body.facing,vx:body.vx,vy:body.vy,onGround:body.onGround,fired:active.fired};
  m.fn(active.t,T,C);
  if(!T.custom){
    T.torso+=clamp(body.vx*body.facing*.00055+body.ax*body.facing*.00028,-.22,.4);
    T.hipH*=1-.26*landCrouch;T.torso+=.12*landCrouch;
    T.head-=(T.torso+T.chest)*.5;
  }
  if(T.air&&!T.footN&&!T.footF){/* FK */}
  else{
    updateFeet(dt,T);
    if(!T.footN)T.footN=footPos(0);
    if(!T.footF)T.footF=footPos(1);
    if(feet[0].sw)T.footAngleN=.25*Math.sin(PI*clamp(feet[0].sw.t,0,1));
    if(feet[1].sw)T.footAngleF=.25*Math.sin(PI*clamp(feet[1].sw.t,0,1));
  }
  if(T.hipAuto)T.hipH=geoHip(T);
  const direct=active.name==='custom';
  const k=m.resp||16;
  for(const key of JK){
    const tv=lim(key,T[key]);
    cur[key]=direct?tv:damp(cur[key],tv,k,dt);
  }
  cur.hipH=direct?T.hipH:damp(cur.hipH,T.hipH,22,dt);
  cur.rootDX=direct?T.rootDX:damp(cur.rootDX,T.rootDX,18,dt);
  cur.bodyRot=direct?T.bodyRot:damp(cur.bodyRot,T.bodyRot,14,dt);
  if(T.handN){const r=ikArm(T.handN,'N');cur.shN=direct?r.sh:damp(cur.shN,r.sh,34,dt);cur.elN=direct?r.el:damp(cur.elN,r.el,34,dt);}
  if(T.handF){const r=ikArm(T.handF,'F');cur.shF=direct?r.sh:damp(cur.shF,r.sh,34,dt);cur.elF=direct?r.el:damp(cur.elF,r.el,34,dt);}
  if(T.footN){const r=ikLeg(T.footN,'N',T.footAngleN);
    cur.hipN=direct?r.hip:damp(cur.hipN,r.hip,42,dt);cur.knN=direct?r.kn:damp(cur.knN,r.kn,42,dt);cur.anN=direct?r.an:damp(cur.anN,r.an,30,dt);}
  if(T.footF){const r=ikLeg(T.footF,'F',T.footAngleF);
    cur.hipF=direct?r.hip:damp(cur.hipF,r.hip,42,dt);cur.knF=direct?r.kn:damp(cur.knF,r.kn,42,dt);cur.anF=direct?r.an:damp(cur.anF,r.an,30,dt);}
  cur.bowDraw=T.bowDraw;cur.orb=T.orb;
}
function lowestY(J){
  let m=-1e9;
  for(const k of ['toeN','toeF','ankleN','ankleF','handN','handF','kneeN','kneeF','pelvis'])m=Math.max(m,J[k].y);
  m=Math.max(m,J.head.y+J.headR);return m;
}
function buildLive(){
  const xf=makeXform(cur,body.x,body.y,dirBlend,sq.x,sq.y);
  let J=skeleton(cur,xf);
  const m=CLIPS[active.name];
  if((active.name==='custom'&&S.snap||m&&m.snapAll)&&body.onGround){
    const d=surfaceYAt(body.x)-lowestY(J);
    if(Math.abs(d)>.4){cur.hipH=clamp(cur.hipH+d,12,standH()*1.3);J=skeleton(cur,makeXform(cur,body.x,body.y,dirBlend,sq.x,sq.y));}
  }
  live.J=J;
  const L=rig();
  capeAnchor=J.chest?{x:J.chest.x-dirBlend*7,y:J.chest.y+4}:{x:body.x,y:body.y-100};
  plumeAnchor={x:J.head.x-dirBlend*4,y:J.head.y-J.headR*.85};
  live.shapes=charShapes(J,cur);
}

/* ---------------- path helpers ---------------- */
function cap(ax,ay,bx,by,r0,r1){
  const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1e-4,nx=-dy/L,ny=dx/L;
  return `M${f2(ax+nx*r0)},${f2(ay+ny*r0)}L${f2(bx+nx*r1)},${f2(by+ny*r1)}`+
    `A${f2(r1)},${f2(r1)} 0 0 0 ${f2(bx-nx*r1)},${f2(by-ny*r1)}L${f2(ax-nx*r0)},${f2(ay-ny*r0)}`+
    `A${f2(r0)},${f2(r0)} 0 0 0 ${f2(ax+nx*r0)},${f2(ay+ny*r0)}Z`;
}
function circ(cx,cy,r){return `M${f2(cx-r)},${f2(cy)}A${f2(r)},${f2(r)} 0 1 0 ${f2(cx+r)},${f2(cy)}A${f2(r)},${f2(r)} 0 1 0 ${f2(cx-r)},${f2(cy)}Z`;}
function poly(pts){return 'M'+pts.map(p=>`${f2(p[0])},${f2(p[1])}`).join('L')+'Z';}
function frame(o,a,dir){const c=Math.cos(a),s=Math.sin(a);
  return(px,py)=>{const y=py*dir;return[o.x+px*c-y*s,o.y+px*s+y*c];};}

/* ---------------- character shapes ---------------- */
function charShapes(J,p){
  const th=S.thickness*(.85+.15*S.heightScale),L=rig(),out=[];
  const thm=THEMES[S.theme],tech=thm.tech,ink=tech?'#bfe9ff':S.inkColor;
  const far=mix(ink,thm.bg,tech?.25:.34),near=ink;
  const stroke=S.outline?(tech?thm.outline:(S.theme==='minimal'?'rgba(20,24,30,.4)':thm.outline)):null;
  const lw=thm.lw;
  const glow=S.glow*thm.glowMul*16;
  const push=(d,fill,lw2,stk,alpha=1,gl=0)=>out.push({d,fill,stroke:stk===undefined?stroke:stk,lw:lw2===undefined?lw:lw2,alpha,glow:gl});
  const fill=x=>tech?rgba('#bfe9ff',.07):x;
  const dir=body.facing;
  // cape
  if(S.cape&&cape.pts.length>2){
    const pts=cape.pts,left=[],right=[];
    for(let i=0;i<pts.length;i++){
      const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1e-4,nx=-dy/d,ny=dx/d;
      const w=(13-i*1.5)*S.heightScale;
      left.push([pts[i].x+nx*w,pts[i].y+ny*w]);right.push([pts[i].x-nx*w,pts[i].y-ny*w]);
    }
    push(poly(left.concat(right.reverse())),fill(shade(S.teamColor,-.18)),lw,undefined,.95);
    push(poly(left.concat(left.slice().reverse().map(pt=>[pt[0]+2,pt[1]]))),fill(shade(S.teamColor,.12)),0,null,.35);
  }
  // far limbs
  push(cap(J.hipJF.x,J.hipJF.y,J.kneeF.x,J.kneeF.y,th*.5,th*.42),fill(far));
  push(cap(J.kneeF.x,J.kneeF.y,J.ankleF.x,J.ankleF.y,th*.42,th*.32),fill(far));
  push(cap(J.ankleF.x,J.ankleF.y,J.toeF.x,J.toeF.y,th*.32,th*.26),fill(far));
  push(cap(J.shoulderF.x,J.shoulderF.y,J.elbowF.x,J.elbowF.y,th*.42,th*.36),fill(far));
  push(cap(J.elbowF.x,J.elbowF.y,J.handF.x,J.handF.y,th*.36,th*.3),fill(far));
  push(circ(J.handF.x,J.handF.y,th*.33),fill(far));
  // quiver
  if(S.gear==='bow'){
    const f=frame(J.chest,ang(J.pelvis,J.chest),dir);
    push(poly([f(-16,-4),f(-6,-8),f(2,26),f(-8,30)]),fill('#5a3a22'));
    for(let i=0;i<3;i++)push(cap(...f(-12+i*4,-10-i*3),...f(-16+i*4,-24-i*3),1.4,1.2),fill('#d8c9a8'),0,null);
  }
  // torso + head
  push(cap(J.pelvis.x,J.pelvis.y,J.chest.x,J.chest.y,th*.6,th*.62),fill(near));
  push(cap(J.chest.x,J.chest.y,J.neck.x,J.neck.y,th*.5,th*.34),fill(near));
  push(circ(J.head.x,J.head.y,J.headR),fill(near));
  // sash
  {const a=ang(J.pelvis,J.chest),f=frame(J.pelvis,a,dir);
   push(poly([f(-th*.62,-3),f(th*.62,-3),f(th*.6,4),f(-th*.6,4)]),fill(S.teamColor),0,null);
   push(poly([f(-th*.5,3),f(-th*.1,3),f(-th*.2,16),f(-th*.62,14)]),fill(shade(S.teamColor,-.2)),0,null,.9);}
  // rim light
  if(S.rim&&!tech&&S.theme!=='minimal'){
    const o=-2.2,oy=-2.4;
    push(cap(J.pelvis.x+o,J.pelvis.y+oy,J.chest.x+o,J.chest.y+oy,th*.2,th*.2),thm.rim,0,null,.2);
    push(circ(J.head.x-J.headR*.3,J.head.y-J.headR*.32,J.headR*.4),thm.rim,0,null,.16);
    push(cap(J.hipJN.x+o,J.hipJN.y+oy,J.kneeN.x+o,J.kneeN.y+oy,th*.16,th*.14),thm.rim,0,null,.16);
  }
  // near limbs
  push(cap(J.hipJN.x,J.hipJN.y,J.kneeN.x,J.kneeN.y,th*.54,th*.44),fill(near));
  push(cap(J.kneeN.x,J.kneeN.y,J.ankleN.x,J.ankleN.y,th*.44,th*.34),fill(near));
  push(cap(J.ankleN.x,J.ankleN.y,J.toeN.x,J.toeN.y,th*.34,th*.28),fill(near));
  push(cap(J.shoulderN.x,J.shoulderN.y,J.elbowN.x,J.elbowN.y,th*.44,th*.38),fill(near));
  push(cap(J.elbowN.x,J.elbowN.y,J.handN.x,J.handN.y,th*.38,th*.32),fill(near));
  push(circ(J.handN.x,J.handN.y,th*.35),fill(near));
  // helmet
  if(S.helmet){
    const r=J.headR*1.06,cx=J.head.x,cy=J.head.y;
    push(`M${f2(cx-r)},${f2(cy-r*.1)}A${f2(r)},${f2(r)} 0 0 1 ${f2(cx+r)},${f2(cy-r*.1)}L${f2(cx+r*.92)},${f2(cy+r*.34)}L${f2(cx+r*.5)},${f2(cy+r*.2)}L${f2(cx-r*.55)},${f2(cy+r*.24)}L${f2(cx-r*.95)},${f2(cy+r*.4)}Z`,
      fill('#8c93a3'),lw,'#3c4351');
    push(poly([[cx+dir*r*.42,cy-r*.1],[cx+dir*r*.72,cy-r*.1],[cx+dir*r*.66,cy+r*.62],[cx+dir*r*.44,cy+r*.5]]),fill('#767d8d'),0,null);
    if(S.helmet&&plume.pts.length>2){
      const pts=plume.pts,l=[],r2=[];
      for(let i=0;i<pts.length;i++){const w=(6-i*1.2)*S.heightScale;
        l.push([pts[i].x,pts[i].y-w]);r2.push([pts[i].x,pts[i].y+w]);}
      push(poly(l.concat(r2.reverse())),fill(S.teamColor),0,null,.95);
    }
  }
  // gear
  const gearOut=gearShapes(J,p,th,fill,lw,dir);
  for(const g of gearOut)out.push(g);
  if(glow>0.4)for(const s of out)if(s.glow===0&&S.theme==='neon')s.glow=glow*.5,s.glowColor=thm.accent;
  live.tip=gearOut.tip;
  return out;
}
function gearShapes(J,p,th,fill,lw,dir){
  const out=[],tech=THEMES[S.theme].tech;
  const push=(d,f,lw2,stk,alpha=1,gl=0)=>out.push({d,fill:tech?rgba('#bfe9ff',.06):f,stroke:stk===undefined?(S.outline?THEMES[S.theme].outline:null):stk,lw:lw2===undefined?lw:lw2,alpha,glow:gl});
  const steel=tech?'#bfe9ff':'#c9d3e0',steelD=tech?'#9fd0e8':'#8b95a6',wood=tech?'#cfe6f5':'#6b4526';
  const aN=ang(J.elbowN,J.handN),aF=ang(J.elbowF,J.handF);
  const fN=frame(J.handN,aN-.25*dir,dir),fF=frame(J.handF,aF,dir);
  const G=S.gear;
  if(G==='sword'||G==='club'||G==='spear'||G==='miner'||G==='staff'){
    if(G==='sword'){
      push(cap(...fN(-16,0),...fN(2,0),3.4,3.2),wood);
      push(circ(...fN(-18,0),4),steelD);
      push(poly([fN(2,-10),fN(6,-9),fN(6,9),fN(2,10)]),steelD);
      push(poly([fN(6,-4.4),fN(56,-3.2),fN(66,0),fN(56,3.2),fN(6,4.4)]),steel);
      push(poly([fN(8,-1.2),fN(54,-.8),fN(54,.8),fN(8,1.2)]),steelD,0,null,.7);
      push(cap(...fN(-8,-2),...fN(-2,-2),1.6,1.6),S.teamColor,0,null);
      out.tip={a:{x:fN(66,0)[0],y:fN(66,0)[1]},b:{x:fN(10,0)[0],y:fN(10,0)[1]}};
    }
    if(G==='club'){
      push(cap(...fN(-14,0),...fN(50,0),4,11),wood);
      for(let i=0;i<4;i++){const a=fN(24+i*8,-9),b=fN(28+i*8,-16),c=fN(32+i*8,-8);push(poly([a,b,c]),steelD);}
      push(cap(...fN(-10,-2),...fN(-2,-2),2,2),S.teamColor,0,null);
      out.tip={a:{x:fN(52,0)[0],y:fN(52,0)[1]},b:{x:fN(10,0)[0],y:fN(10,0)[1]}};
    }
    if(G==='spear'){
      push(cap(...fN(-42,0),...fN(78,0),2.9,2.6),wood);
      push(poly([fN(78,-5.4),fN(102,0),fN(78,5.4)]),steel);
      push(circ(...fN(-44,0),3.4),steelD);
      push(cap(...fN(-6,-3),...fN(6,-3),2.2,2.2),S.teamColor,0,null);
      out.tip={a:{x:fN(102,0)[0],y:fN(102,0)[1]},b:{x:fN(30,0)[0],y:fN(30,0)[1]}};
    }
    if(G==='miner'){
      push(cap(...fN(-18,0),...fN(54,0),3.2,3),wood);
      push(`M${fN(40,-4)}Q${fN(64,-16)} ${fN(78,-6)}L${fN(73,-1)}Q${fN(60,-8)} ${fN(42,4)}Z`,steel);
      push(poly([fN(34,-7),fN(46,-7),fN(46,7),fN(34,7)]),steelD);
      push(cap(...fN(-12,-2),...fN(-4,-2),2,2),S.teamColor,0,null);
      out.tip={a:{x:fN(78,-6)[0],y:fN(78,-6)[1]},b:{x:fN(30,0)[0],y:fN(30,0)[1]}};
    }
    if(G==='staff'){
      push(cap(...fN(-32,0),...fN(64,0),3.1,2.8),wood);
      const orb=fN(74,0),og=(p.orb||0);
      push(`M${fN(58,-9)}Q${fN(70,-12)} ${fN(72,-3)}L${fN(66,-2)}Q${fN(64,-7)} ${fN(58,-5)}Z`,steelD);
      push(`M${fN(58,9)}Q${fN(70,12)} ${fN(72,3)}L${fN(66,2)}Q${fN(64,7)} ${fN(58,5)}Z`,steelD);
      push(circ(orb[0],orb[1],8+og*4),mix(S.teamColor,'#ffffff',.35),1.2,mix(S.teamColor,'#ffffff',.6),1,10+og*26);
      push(circ(orb[0]-2,orb[1]-2,3),rgba('#ffffff',.8),0,null);
      out.tip={a:{x:orb[0],y:orb[1]},b:{x:fN(20,0)[0],y:fN(20,0)[1]}};
    }
  }
  if(G==='bow'){
    const d=p.bowDraw||0;
    push(`M${fF(0,-40)}Q${fF(24,0)} ${fF(0,40)}`,wood,4.6,wood);
    push(`M${fF(0,-40)}L${fF(-6-d*20,0)}L${fF(0,40)}`,'none',1.3,tech?'#bfe9ff':'#efe4cb');
    push(cap(...fF(-3,-6),...fF(3,-6),3.4,3.4),S.teamColor,0,null);
    if(d>.04){
      push(cap(...fF(-6-d*20,0),...fF(34,0),1.5,1.4),tech?'#bfe9ff':'#d9c9a4'),
      push(poly([fF(34,-3),fF(44,0),fF(34,3)]),steel);
      push(poly([fF(-6-d*20,-4),fF(2-d*20,0),fF(-6-d*20,4)]),S.teamColor,0,null);
    }
    out.tip={a:{x:fF(0,-40)[0],y:fF(0,-40)[1]},b:{x:fF(0,40)[0],y:fF(0,40)[1]}};
  }
  if(G==='sword'||G==='spear'){
    const r=(G==='spear'?26:21)*S.heightScale;
    const mid={x:lerp(J.elbowF.x,J.handF.x,.7),y:lerp(J.elbowF.y,J.handF.y,.7)};
    const o={x:mid.x+dir*4,y:mid.y};
    push(circ(o.x,o.y,r),tech?rgba('#bfe9ff',.06):mix(S.teamColor,'#2a1c14',.45),2.4,steelD);
    push(circ(o.x,o.y,r*.72),'none',1.6,rgba(steel,.55));
    push(poly([[o.x-dir*r*.34,o.y-r*.42],[o.x+dir*r*.36,o.y],[o.x-dir*r*.34,o.y+r*.42],[o.x-dir*r*.1,o.y]]),S.teamColor,0,null);
    push(circ(o.x,o.y,r*.2),steel,1,steelD);
  }
  return out;
}

/* ---------------- fx ---------------- */
const parts=[],projs=[],sticks=[],trail=[],ghostBuf=[];
const PCAP=()=>S.quality==='high'?420:S.quality==='med'?240:110;
function spawn(type,x,y,n,o={}){
  for(let i=0;i<n&&parts.length<PCAP();i++){
    const a=o.ang!=null?o.ang+rnd(.6,-.6):rnd(TAU);
    const sp=o.sp||rnd(120,30);
    parts.push({type,x:x+rnd(6,-6),y:y+rnd(4,-4),
      vx:o.vx!=null?o.vx+rnd(30,-30):Math.cos(a)*sp,vy:o.vy!=null?o.vy+rnd(20,-20):Math.sin(a)*sp,
      g:o.g!=null?o.g:(type==='spark'?900:type==='chip'?1200:type==='magic'?-40:120),
      drag:type==='dust'?2.2:.6,life:o.life||rnd(.7,.3),max:o.life||.7,
      size:o.size||(type==='spark'?2.2:type==='chip'?3:5),col:o.col||'#d9c9a8',rot:rnd(TAU)});
  }
}
const dust=(x,y,n,k=1)=>spawn('dust',x,y,n,{sp:70*k,vy:-40*k,col:SURF[S.surface].tuft,life:.55*k,size:5*k});
const spark=(x,y,n)=>spawn('spark',x,y,n,{sp:260,col:'#ffd166',life:.45});
function updateFx(dt){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.vy+=p.g*dt;p.vx*=1-p.drag*dt;p.vy*=1-p.drag*dt*.5;
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.rot+=dt*6;
    if(p.type==='chip'||p.type==='spark'){const gy=surfaceYAt(p.x);if(p.y>gy){p.y=gy;p.vy*=-.35;p.vx*=.6;}}
    if(p.life<=0){parts[i]=parts[parts.length-1];parts.pop();}
  }
  for(let i=projs.length-1;i>=0;i--){
    const pr=projs[i];
    pr.vy+=S.gravity*(pr.type==='arrow'?.6:.12)*dt;pr.vx*=1-.12*dt;
    pr.x+=pr.vx*dt;pr.y+=pr.vy*dt;pr.ang=Math.atan2(pr.vy,pr.vx);pr.life-=dt;
    if(pr.type==='magic'&&Math.random()<.7)spawn('magic',pr.x,pr.y,1,{vx:0,vy:0,col:S.teamColor,life:.4,size:4});
    let hit=false;
    if(S.props&&S.mode==='field'){
      const bp=bagPos();
      if(dist(pr,bp)<44){bag.v+=Math.sign(pr.vx)*2.6;bag.flash=1;hit=true;stats.hits++;spark(bp.x,bp.y,12);sfx.hit(.9);shake=7;}
      if(Math.abs(pr.x-target.x)<12&&Math.abs(pr.y-target.y)<target.r+8){
        target.flash=1;hit=true;stats.hits++;sfx.hit(.6);spark(pr.x,pr.y,8);
        sticks.push({x:pr.x,y:pr.y,ang:pr.ang,life:14});}
    }
    const gy=surfaceYAt(pr.x);
    if(pr.y>=gy){hit=true;pr.y=gy;
      if(pr.type==='arrow'){sticks.push({x:pr.x,y:gy,ang:pr.ang,life:12});dust(pr.x,gy,4,.7);sfx.step(120);}
      else{spawn('magic',pr.x,gy,14,{sp:150,col:S.teamColor,life:.6});sfx.magic(.5);}}
    if(hit||pr.life<=0||Math.abs(pr.x-body.x)>2600){projs[i]=projs[projs.length-1];projs.pop();}
  }
  for(let i=sticks.length-1;i>=0;i--){sticks[i].life-=dt;if(sticks[i].life<=0)sticks.splice(i,1);}
  if(sticks.length>16)sticks.splice(0,sticks.length-16);
  // weapon trail
  const tw=['sword','spear','kick','mine','club'];
  const inWin=tw.includes(active.name)&&active.t>.2&&active.t<.55&&live.tip;
  if(inWin){
    let a=live.tip.a,b=live.tip.b;
    if(active.name==='kick'){a=live.J.toeN;b=live.J.ankleN;}
    trail.push({a:{...a},b:{...b},life:.22});
  }
  for(let i=trail.length-1;i>=0;i--){trail[i].life-=dt;if(trail[i].life<=0)trail.splice(i,1);}
  if(trail.length>14)trail.splice(0,trail.length-14);
  // ghost snapshots
  if(S.ghost&&live.J){
    ghostTimer-=dt;
    if(ghostTimer<=0){ghostTimer=.06;
      const snap={};for(const k in live.J)if(live.J[k]&&live.J[k].x!=null)snap[k]={...live.J[k]};
      snap.headR=live.J.headR;ghostBuf.push(snap);if(ghostBuf.length>6)ghostBuf.shift();}
  }else if(ghostBuf.length)ghostBuf.length=0;
  // camera / squash
  if(S.mode==='studio'){camX=body.x;}
  else if(S.follow)camX=damp(camX,body.x,6,dt);
  camY=damp(camY,clamp(body.y*.55,-320,0),5,dt);
  sqv=damp(sqv,0,11,dt);sq.y=1+.13*sqv;sq.x=1-.1*sqv;
  landCrouch=damp(landCrouch,0,8,dt);
  dirBlend=damp(dirBlend,body.facing,18,dt);
  shake=Math.max(0,shake-dt*26);
  if(Math.abs(body.vx)>4&&S.mode==='field')body.facing=body.vx>0?1:-1;
  if(axisInput()!==0)body.facing=axisInput()>0?1:-1;
}
let ghostTimer=0;
function hitCheck(x,y,kind){
  let hit=false;
  spawn('spark',x,y,4,{sp:120,col:'#ffe6b0',life:.25,size:1.8});
  if(S.props&&S.mode==='field'){
    const bp=bagPos();
    if(dist({x,y},bp)<56){bag.v+=(x<bp.x?1:-1)*3.4;bag.flash=1;hit=true;}
    if(Math.abs(x-rock.x)<70&&y>-70){rock.hp++;spawn('chip',rock.x+rnd(20,-20),-30,10,{sp:180,col:'#9a8a72'});hit=true;}
    if(Math.abs(x-target.x)<20&&Math.abs(y-target.y)<target.r+10){target.flash=1;hit=true;}
  }
  if(hit){stats.hits++;spark(x,y,16);sfx.hit(1);shake=Math.min(14,shake+7);}
  return hit;
}
function mineHit(){
  const L=rig(),x=body.x+body.facing*52,y=surfaceYAt(body.x+body.facing*52);
  const nearRock=S.props&&S.mode==='field'&&Math.abs(x-rock.x)<90;
  spawn('chip',nearRock?rock.x:x,y-6,12,{sp:210,col:nearRock?'#9a8a72':'#c9a24a'});
  spawn('spark',nearRock?rock.x:x,y-8,7,{sp:150,col:'#ffd166',life:.4});
  if(nearRock){rock.hp++;stats.hits++;}
  dust(x,y,6,1);sfx.hit(.85);shake=Math.min(12,shake+5);
}
function shootArrow(){
  const h=live.J.handF||{x:body.x,y:body.y-110};
  projs.push({type:'arrow',x:h.x+body.facing*24,y:h.y,vx:body.facing*840,vy:-70,ang:0,life:5});
  sfx.bow();spawn('dust',h.x,h.y,3,{sp:60,col:'#efe4cb',life:.3});
}
function castRelease(){
  const h=live.J.handN||{x:body.x,y:body.y-110};
  projs.push({type:'magic',x:h.x+body.facing*44,y:h.y-16,vx:body.facing*430,vy:-40,ang:0,life:3.4});
  spawn('magic',h.x+body.facing*44,h.y-16,20,{sp:170,col:S.teamColor,life:.7});
  sfx.magic();shake=Math.min(10,shake+4);
}

/* ---------------- audio ---------------- */
const sfx=(()=>{
  let ac=null,master=null;
  function ready(){
    if(!S.sound)return false;
    if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();
      master.gain.value=.5;master.connect(ac.destination);}catch(e){return false;}}
    if(ac.state==='suspended')ac.resume();
    return true;
  }
  function noise(dur){
    const n=Math.floor(ac.sampleRate*dur),b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=ac.createBufferSource();s.buffer=b;return s;
  }
  function env(node,g,a,d){const gn=ac.createGain();gn.gain.setValueAtTime(0,ac.currentTime);
    gn.gain.linearRampToValueAtTime(g,ac.currentTime+a);gn.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+a+d);
    node.connect(gn);gn.connect(master);return gn;}
  function tone(freq,g,d,type='sine',slide){
    const o=ac.createOscillator();o.type=type;o.frequency.setValueAtTime(freq,ac.currentTime);
    if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),ac.currentTime+d);
    env(o,g,.005,d);o.start();o.stop(ac.currentTime+d+.05);
  }
  function nz(g,d,f,q,type='bandpass'){
    const s=noise(d),bp=ac.createBiquadFilter();bp.type=type;bp.frequency.value=f;bp.Q.value=q||1;
    s.connect(bp);env(bp,g,.004,d);s.start();s.stop(ac.currentTime+d+.05);
  }
  return{
    unlock(){ready();},
    ui(){if(!ready())return;tone(880,.03,.05,'triangle',1200);},
    step(sp){if(!ready())return;const s=S.surface;
      const f=s==='ice'?2600:s==='sand'?700:s==='grass'?1100:1500;
      nz(clamp(sp/2600,.02,.1),.09,f,s==='ice'?3:1.2);
      tone(s==='ice'?260:120,.03,.07,'sine',80);},
    jump(){if(!ready())return;tone(220,.07,.18,'triangle',520);nz(.04,.1,900,1);},
    land(i){if(!ready())return;const g=clamp(i/2200,.03,.22);tone(70,g*1.3,.22,'sine',40);nz(g,.16,420,.8);},
    swoosh(k=1){if(!ready())return;nz(.09*k,.2,1300,.7);},
    hit(k=1){if(!ready())return;tone(150,.14*k,.14,'square',60);nz(.12*k,.12,2200,.6);tone(420,.06*k,.08,'triangle',180);},
    bow(){if(!ready())return;tone(320,.1,.16,'triangle',110);nz(.06,.18,2400,.8);},
    magic(k=1){if(!ready())return;tone(420,.07*k,.5,'sine',1250);tone(628,.05*k,.5,'sine',1880);nz(.04*k,.4,3200,2);}
  };
})();

/* ---------------- canvas / render ---------------- */
const canvas=$('#stage'),ctx=canvas.getContext('2d',{alpha:false});
let W=800,H=500,DPR=1,grainPat=null,vign=null;
function resize(){
  const r=$('#stagewrap').getBoundingClientRect();
  W=Math.max(120,Math.round(r.width));H=Math.max(120,Math.round(r.height));
  DPR=Math.min(window.devicePixelRatio||1,S.quality==='high'?2:S.quality==='med'?1.5:1);
  canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);
  vign=null;
}
new ResizeObserver(resize).observe($('#stagewrap'));
function makeGrain(){
  const c=document.createElement('canvas');c.width=c.height=96;const g=c.getContext('2d');
  const im=g.createImageData(96,96);
  for(let i=0;i<im.data.length;i+=4){const v=200+Math.random()*55;
    im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=26;}
  g.putImageData(im,0,0);grainPat=ctx.createPattern(c,'repeat');
}
const w2s=(x,y)=>({x:(x-camX)*S.zoom+W/2,y:(y-camY)*S.zoom+H*.78});
const s2w=(x,y)=>({x:(x-W/2)/S.zoom+camX,y:(y-H*.78)/S.zoom+camY});
function applyCam(){ctx.translate(W/2+(shake?rnd(shake,-shake):0),H*.78+(shake?rnd(shake,-shake):0));
  ctx.scale(S.zoom,S.zoom);ctx.translate(-camX,-camY);}
function drawShapes(list){
  for(const s of list){
    let p;try{p=new Path2D(s.d);}catch(e){continue;}
    ctx.globalAlpha=s.alpha==null?1:s.alpha;
    if(s.glow){ctx.shadowColor=s.glowColor||s.stroke||s.fill||'#fff';ctx.shadowBlur=s.glow;}
    if(s.fill&&s.fill!=='none'){ctx.fillStyle=s.fill;ctx.fill(p);}
    if(s.stroke&&s.lw>0){ctx.strokeStyle=s.stroke;ctx.lineWidth=s.lw;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke(p);}
    ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;
}
function drawSky(){
  const th=THEMES[S.theme],g=ctx.createLinearGradient(0,0,0,H);
  th.sky.forEach((c,i)=>g.addColorStop(i/(th.sky.length-1),c));
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(S.theme==='neon'){
    const t=performance.now()/1000;
    for(let i=0;i<2;i++){
      const cx=W*(.3+.4*i)+Math.sin(t*.2+i)*40,cy=H*(.3+.2*i);
      const rg=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*.45);
      rg.addColorStop(0,i?'rgba(255,61,166,.22)':'rgba(65,240,255,.18)');rg.addColorStop(1,'transparent');
      ctx.fillStyle=rg;ctx.fillRect(0,0,W,H);
    }
  }
  if(th.sun){
    const sx=W*.74,sy=H*.3,rr=Math.min(W,H)*.09;
    const rg=ctx.createRadialGradient(sx,sy,0,sx,sy,rr*5);
    rg.addColorStop(0,'rgba(255,214,140,.75)');rg.addColorStop(.25,'rgba(255,160,70,.28)');rg.addColorStop(1,'transparent');
    ctx.fillStyle=rg;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffe6b4';ctx.beginPath();ctx.arc(sx,sy,rr,0,TAU);ctx.fill();
  }
  if(S.parallax){
    const t=performance.now()/1000;
    ctx.globalAlpha=S.theme==='minimal'?.5:.32;
    for(let i=0;i<5;i++){
      const px=((i*373+t*9-camX*.05)%(W+320))-160,py=H*(.14+.06*((i*7)%3));
      ctx.fillStyle=S.theme==='minimal'?'#ffffff':(S.theme==='neon'?'#2a1a4a':'#f0b070');
      ctx.beginPath();ctx.ellipse(px,py,58+i*9,15+i*2,0,0,TAU);ctx.fill();
      ctx.beginPath();ctx.ellipse(px+34,py+5,38,11,0,0,TAU);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
}
function hillY(wx,li,gy){
  const amp=[26,42,60][li];
  return gy-[96,60,24][li]*S.zoom-(Math.sin(wx*.004+li*2.1)*amp+Math.sin(wx*.011+li)*amp*.4)*S.zoom;
}
function drawHills(){
  const th=THEMES[S.theme],gy=H*.78-camY*S.zoom;
  th.hill.forEach((col,li)=>{
    const par=S.parallax?[.08,.18,.34][li]:0;
    ctx.beginPath();ctx.moveTo(0,H+2);
    for(let x=0;x<=W+18;x+=18){
      const wx=(x-W/2)/S.zoom+camX*par;
      ctx.lineTo(x,hillY(wx,li,gy));
    }
    ctx.lineTo(W+18,H+2);ctx.closePath();ctx.fillStyle=col;ctx.fill();
    if(li===2&&S.theme==='battle'){
      ctx.fillStyle='rgba(10,12,20,.55)';
      const base=Math.floor(camX*par/150);
      for(let i=-2;i<=Math.ceil(W/(150*S.zoom))+2;i++){
        const wx=(base+i)*150+hash(base+i)*60,sx=(wx-camX*par)*S.zoom+W/2;
        if(sx<-30||sx>W+30)continue;
        const y=hillY(wx,2,gy),k=S.zoom*(.8+hash(i*3)*.4),bob=Math.sin(performance.now()/700+i)*1.2*k;
        ctx.beginPath();ctx.arc(sx,y-15*k+bob,3.1*k,0,TAU);ctx.fill();
        ctx.lineWidth=2.1*k;ctx.strokeStyle='rgba(10,12,20,.55)';ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(sx,y-12*k+bob);ctx.lineTo(sx,y-5*k+bob);
        ctx.moveTo(sx,y-5*k+bob);ctx.lineTo(sx-3*k,y+bob);ctx.moveTo(sx,y-5*k+bob);ctx.lineTo(sx+3*k,y+bob);
        ctx.moveTo(sx+4*k,y-22*k+bob);ctx.lineTo(sx+4*k,y-2*k+bob);ctx.stroke();
      }
    }
  });
}
function drawGrid(){
  if(!S.grid)return;
  const th=THEMES[S.theme],x0=camX-W/2/S.zoom,x1=camX+W/2/S.zoom;
  ctx.lineWidth=1/S.zoom;
  for(let x=Math.floor(x0/50)*50;x<x1;x+=50){
    ctx.strokeStyle=x%200===0?rgba(th.accent,S.theme==='blue'?.28:.14):th.grid;
    ctx.beginPath();ctx.moveTo(x,-560);ctx.lineTo(x,220);ctx.stroke();
  }
  for(let y=-560;y<220;y+=50){
    ctx.strokeStyle=y%200===0?rgba(th.accent,S.theme==='blue'?.24:.12):th.grid;
    ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();
  }
}
function drawGround(){
  const th=THEMES[S.theme],su=SURF[S.surface],x0=camX-W/2/S.zoom-80,x1=camX+W/2/S.zoom+80;
  const g=ctx.createLinearGradient(0,0,0,340);
  if(S.theme==='blue'){g.addColorStop(0,'#0d3450');g.addColorStop(1,'#061a2c');}
  else if(S.theme==='neon'){g.addColorStop(0,'#160c2c');g.addColorStop(1,'#07060f');}
  else if(S.theme==='minimal'){g.addColorStop(0,'#e2d3b4');g.addColorStop(1,'#cdbc98');}
  else{g.addColorStop(0,su.deep[0]);g.addColorStop(1,su.deep[1]);}
  ctx.fillStyle=g;ctx.fillRect(x0,0,x1-x0,420);
  ctx.fillStyle=S.theme==='blue'?rgba(th.accent,.5):S.theme==='neon'?'#41f0ff':su.top;
  ctx.fillRect(x0,-2.5,x1-x0,4);
  if(S.theme==='neon'){ctx.shadowColor='#41f0ff';ctx.shadowBlur=18;ctx.fillRect(x0,-1.5,x1-x0,2);ctx.shadowBlur=0;}
  const step=42;
  for(let i=Math.floor(x0/step);i<=Math.ceil(x1/step);i++){
    const hx=i*step+hash(i)*step*.8,h=hash(i*1.7),gy=surfaceYAt(hx);
    ctx.globalAlpha=.55+h*.4;
    if(su.kind==='grass'&&S.theme!=='blue'){
      ctx.strokeStyle=su.tuft;ctx.lineWidth=1.6;
      for(let b=0;b<3;b++){const bx=hx+b*3-3;
        ctx.beginPath();ctx.moveTo(bx,gy);ctx.quadraticCurveTo(bx+2,gy-6-h*5,bx+5*(h-.5)*2,gy-10-h*7);ctx.stroke();}
    }else if(su.kind==='ice'){
      ctx.strokeStyle=rgba('#cfeeff',.5);ctx.lineWidth=1.2;
      ctx.beginPath();ctx.moveTo(hx,gy+4+h*10);ctx.lineTo(hx+16+h*20,gy+6+h*12);ctx.stroke();
    }else if(su.kind==='sand'){
      ctx.strokeStyle=rgba(su.tuft,.5);ctx.lineWidth=1.4;
      ctx.beginPath();ctx.moveTo(hx,gy+7+h*12);ctx.quadraticCurveTo(hx+12,gy+3+h*12,hx+24,gy+8+h*12);ctx.stroke();
    }else{
      ctx.fillStyle=S.theme==='blue'?rgba(th.accent,.25):su.tuft;
      ctx.beginPath();ctx.ellipse(hx,gy+4+h*14,2.4+h*3.4,1.6+h*2,h,0,TAU);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  ctx.font=`${11/S.zoom}px Vazirmatn, Tahoma, sans-serif`;ctx.textAlign='center';
  for(let x=Math.floor(x0/200)*200;x<x1;x+=200){
    ctx.fillStyle=rgba(th.accent,S.theme==='blue'?.75:.4);
    ctx.fillRect(x-.6,0,1.2,9);
    ctx.fillText((x/PPM).toFixed(0)+'m',x,22);
  }
}
function drawProps(){
  if(!(S.props&&S.mode==='field'))return;
  const th=THEMES[S.theme];
  for(const b of boxes){
    const g=ctx.createLinearGradient(0,b.y,0,b.y+b.h);
    g.addColorStop(0,S.theme==='minimal'?'#d8c8a6':'#4b4335');g.addColorStop(1,S.theme==='minimal'?'#bfad8b':'#2a251c');
    ctx.fillStyle=g;ctx.fillRect(b.x,b.y,b.w,b.h);
    ctx.strokeStyle=rgba(th.accent,.4);ctx.lineWidth=1.4;ctx.strokeRect(b.x,b.y,b.w,b.h);
    ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=1;
    for(let y=b.y+14;y<b.y+b.h;y+=16){ctx.beginPath();ctx.moveTo(b.x,y);ctx.lineTo(b.x+b.w,y);ctx.stroke();}
  }
  // rock
  ctx.fillStyle=S.theme==='minimal'?'#c7b694':'#4a4238';