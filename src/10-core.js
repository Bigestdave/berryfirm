'use strict';
const $=s=>document.querySelector(s);
/* ---------- Config: the only place that differs between this preview and a live deployment ---------- */
const BERRY=Object.assign({
 demo:true,                              // Show judge demo controls and clearly labelled sample screens.
 user:{name:'you.near',role:'trader'},    // the signed-in trader's NEAR account
 share:.9,cap:1000,                      // commercial payout policy: 90% of eligible profit, up to $1,000 per funded account
 fees:{5000:59,10000:89,25000:199,50000:349}, // one-time evaluation fee by account size (USD terms). 0 = free
 treasury:'',                            // NEAR account that holds the payout pool (shown on Add funds and the ledger)
 logos:''                                // folder or CDN for crypto logos, e.g. 'logos/'. Empty keeps the built-in glyphs
},window.BERRY_CONFIG||{});
const PCT=()=>Math.round(BERRY.share*100)+'%',CAPM=()=>'$'+BERRY.cap,PAYT=()=>PCT()+' of profit, up to '+CAPM();
if(/Chrome\//.test(navigator.userAgent)&&!/iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent))document.documentElement.classList.add('lq');
let DAILY=500,START=10000,FLOOR=9000;const FEE=.0005,SLIP=.0002,V={},D={};
const K=()=>START/10000,SZ=()=>'$'+START/1000+'K',setSize=n=>{START=n;DAILY=Math.round(n*.05);FLOOR=Math.round(n*.9)};
const ORD0=()=>[['Buy',+(.05*K()).toFixed(4),60000,'12:04 UTC today','BTC'],['Sell',+(.04*K()).toFixed(4),59400,'18:32 UTC yesterday','BTC'],['Buy',+(.04*K()).toFixed(4),58800,'10:15 UTC yesterday','BTC']];
const POS0=()=>[{m:'BTC',side:'Buy',z:+(.05*K()).toFixed(4),e:60000,sl:58000,tp:null}];
const POOL0=()=>({inp:525.6,res:0,snd:0,paid:[['7f2a',3.2,'4dK9…x2Qa','2h ago'],['c91e',4.2,'Qm7T…8vLr','1d ago']]});
const S={v:'start',p:{},stage:'challenge',bal:10640,rl:0,days:2,tab:'Position',tf:1,pay:'idle',chk:0,q:60,qr:0,amt:0,net:0,t:{},appeal:0,m:'BTC',mq:'',mc:'All',pdis:0,
 pos:[{m:'BTC',side:'Buy',z:.05,e:60000,sl:58000,tp:null}],ord:ORD0(),pool:POOL0(),sales:[],bp:'All',preview:false,aiReady:false,apiDecision:null,apiPayout:null,own:{need:['breach','wallet'],done:14,min:9}};
const NET=()=>S.settlementNetwork||'Treasury rail',USDCN=()=>S.rail=='testnet'?'test USDC':'USDC';
let T={m:'BTC',side:'Buy',z:.02,sl:58500,tp:null},M={i:0,tab:'Stop loss',sl:0,fr:.5},timers=[];
const PRE={
 active(){Object.assign(S,{stage:'challenge',bal:10640*K(),rl:0,days:2,pay:'idle',pdis:0,pos:POS0(),ord:ORD0()})},
 passed(){Object.assign(S,{stage:'challenge',bal:11020*K(),rl:0,days:3,pay:'idle',pdis:0,pos:[],ord:ORD0()})},
 fresh(){Object.assign(S,{stage:'challenge',bal:START,rl:0,days:0,pay:'idle',pdis:0,pos:[],ord:[]})},
 funded(){clr();Object.assign(S,{stage:'funded',bal:START+6,rl:0,days:0,pay:'idle',pdis:0,pos:[],ord:[],pool:POOL0(),sales:[],t:{}})}
};
/* formatting */
const f2=n=>n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const m0=n=>(n<0?'−':'')+'$'+Math.abs(Math.round(n)).toLocaleString('en-US');
const mm=n=>{n=Math.abs(n);return Math.abs(n-Math.round(n))<.005?'$'+Math.round(n).toLocaleString('en-US'):'$'+f2(n)};
const sg=n=>(n<-.004?'−':'+')+mm(n);
const h=n=>{const[a,b]=Math.abs(n).toFixed(2).split('.');return`${n<0?'−':''}$${(+a).toLocaleString('en-US')}<span class="dim">.${b}</span>`};
const tick=v=>'$'+Math.round(v).toLocaleString('en-US');
const hm=()=>new Date().toISOString().slice(11,16)+' UTC';
const shortAccount=(account,fallback='')=>{const value=String(account||fallback);if(value.length<=18)return value;const short=`${value.slice(0,8)}…${value.slice(-6)}`;return`<span class="addr" title="${value}">${short}</span>`};
/* account maths: every number on screen comes from these */
const dir=p=>p.side=='Buy'?1:-1;
const pl=p=>(MP(p).p-p.e)*p.z*dir(p);
const flt=()=>S.pos.reduce((a,p)=>a+pl(p),0);
const eq=()=>S.bal+flt();
const dayLeft=()=>DAILY-Math.max(0,-(S.rl+flt()));
const lossAt=p=>p.sl==null?Math.max(0,-pl(p)):Math.max(0,(p.e-p.sl)*p.z*dir(p));
const wr=()=>S.pos.reduce((a,p)=>a+lossAt(p),0);
const left2=()=>DAILY-Math.max(0,wr()-S.rl);
const est=()=>Math.min(BERRY.cap,Math.max(0,eq()-START)*BERRY.share);
const nt=()=>S.pos.reduce((a,p)=>a+p.z*MP(p).p,0),maxZ=m=>(2*eq()-nt())/MK[m].p;
const paused=()=>['review','approved','sending'].includes(S.pay);
const apiBlocked=()=>BerryAPI.required&&!BerryAPI.online;
const serverNeeded=()=>{if(!apiBlocked())return false;toast('Server unavailable. Refresh.','err');return true};
const tRisk=()=>Math.abs(MK[T.m].p-T.sl)*T.z;
const tLeft=()=>DAILY-Math.max(0,wr()+tRisk()-S.rl);
/* icons */
const IC={
 home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 bars:'<path d="M5 20V11M12 20V4M19 20v-7"/>',
 gift:'<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 13h18M12 8C8 8 7 3 10 3s2 5 2 5zm0 0c4 0 5-5 2-5s-2 5-2 5z"/>',
 down:'<path d="M5 9l7 7 7-7"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',back:'<path d="M15 5l-7 7 7 7"/>',chev:'<path d="M9 5l7 7-7 7"/>',check:'<path d="M5 12.5l4.2 4.2L19 7"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 alert:'<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
 share:'<path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8"/>',
 copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
 shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 wallet:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
 lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
 candle:'<path d="M7 4v16M17 4v16"/><rect x="5" y="8" width="4" height="7" rx="1"/><rect x="15" y="6" width="4" height="9" rx="1"/>',
 pause:'<path d="M9 5v14M15 5v14"/>',layers:'<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 15-5 16 0"/>',
 up:'<path d="M7 17L17 7M9 7h8v8"/>',list:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',power:'<path d="M12 3v8M6.4 6.9a8 8 0 1 0 11.2 0"/>'
};
const I=(n,s=22,c='')=>`<svg class="ic ${c}" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const G=(c='#fff',s=34)=>`<svg width="${s}" height="${s}" viewBox="0 0 44 44" fill="${c}" aria-hidden="true"><circle cx="16" cy="28" r="12" mask="url(#gm)"/><circle cx="32" cy="32" r="8.5"/><path d="M19 15.2C20 9 28 5.5 38 8 37 15 27 19 19 15.2Z"/></svg>`;
/* brand: flat silver logo (two berries in a coin ring), sparkles, avatars */
const LG=(s=34)=>`<svg width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29.2" fill="#0b0d16" stroke="url(#sv)" stroke-width="3"/><circle cx="32" cy="32" r="24.2" fill="none" stroke="url(#sv)" stroke-width=".9" opacity=".5"/><g transform="translate(13.2 13.4) scale(.85)"><circle cx="16" cy="28" r="12" fill="url(#svb)"/><circle cx="32" cy="32" r="8.5" fill="url(#svb)" stroke="#0b0d16" stroke-width="1.8"/><path d="M19 15.2C20 9 28 5.5 38 8 37 15 27 19 19 15.2Z" fill="url(#sv)"/><ellipse cx="12.5" cy="20" rx="2.6" ry="1.4" fill="#4d5568" opacity=".6"/><ellipse cx="29.3" cy="26.8" rx="1.9" ry="1" fill="#4d5568" opacity=".6"/></g></svg>`;
const SPK=a=>a.map(([x,y,s,d])=>`<svg class="spk" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;animation-delay:${d}s" viewBox="0 0 24 24" aria-hidden="true"><path fill="url(#sv)" d="M12 0C12.9 7.3 16.7 11.1 24 12 16.7 12.9 12.9 16.7 12 24 11.1 16.7 7.3 12.9 0 12 7.3 11.1 11.1 7.3 12 0Z"/></svg>`).join('');
const AVI=(i,c='')=>`<span class="ava ${c} im av${i}" aria-hidden="true"></span>`;
const avId=id=>2+[...String(id)].reduce((a,x)=>a+x.charCodeAt(0),0)%(AVU.length-2);
const COINB='<span class="art i-coinf" aria-hidden="true" style="width:40px;height:40px"></span>';
const GB=s=>G('url(#gb)',s);
const CK=s=>`<svg class="cki" width="${s}" height="${s}" viewBox="0 0 24 24" role="img" aria-label="Done"><circle cx="12" cy="12" r="11" fill="#19d46a" fill-opacity=".14" stroke="#19d46a" stroke-opacity=".42" stroke-width="1.3"/><path d="M7.4 12.3l3.2 3.2 6-6.4" stroke="#19d46a" stroke-width="2.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ck=CK(18);
const WN=`<svg class="cki" width="18" height="18" viewBox="0 0 24 24" role="img" aria-label="Near limit"><circle cx="12" cy="12" r="11" fill="#ffb020" fill-opacity=".14" stroke="#ffb020" stroke-opacity=".42" stroke-width="1.3"/><path d="M12 7.2v5.6M12 16.1h.01" stroke="#ffb020" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
/* shared pieces */
const hdr=(av,wm)=>`<div class="bar hb">${wm?`<span class="lock">${LG(34)}<span class="wm">berry firm</span></span>`:LG(34)}${av?`<button class="ava im av0" aria-label="Profile" onclick="go('me')"></button>`:''}</div>`;
const BK=t=>`<button class="bk" aria-label="Back" onclick="go('${t}')">${I('back',24)}</button>`;
const R=(k,v='',s='',f='',p=0,nc=0)=>{const t=f?'button':'div';return`<${t} class="r${p?' p':''}"${f?` onclick="${f}"`:''}><span class="k">${k}</span><b class="v">${v}${s?`<small>${s}</small>`:''}</b>${f&&!nc?`<span class="ch">${I('chev',20)}</span>`:''}</${t}>`};
const AIL=`<div class="ai">${GB(22)}Berry AI</div>`;
const AI=(t,s)=>`<div class="card col">${AIL}<b>${t}</b><div class="mu" style="margin-top:2px">${s}</div></div>`;
const EMP=(t,s)=>`<div class="emp"><span class="art i-line" aria-hidden="true" style="width:96px;height:96px"></span><b style="color:var(--tx)">${t}</b><span>${s||''}</span></div>`;
const L=(ic,k,v,f)=>`<button class="r p" style="min-height:68px;gap:16px" onclick="${f}">${I(ic,24)}<span class="k">${k}</span><b class="v mu">${v}</b><span class="ch">${I('chev',20)}</span></button>`;
const chips=a=>`<div class="chips"><span class="mu">Based on</span>${a.map(x=>`<span>${x}</span>`).join('')}</div>`;
const posRow=(p,i)=>{const x=pl(p),m=MP(p);return`<button class="r" style="min-height:72px" onclick="manage(${i})">${mi(p.m||'BTC',44,1)}<span class="nm">${m.s}<small>${p.side} · ${zf(p.z,m)}</small></span><b class="v ${x<-.004?'rd':'gn'}">${sg(x)}<small>${p.sl==null?'No stop':'SL '+tk(p.sl,m)}</small></b></button>`};
const sheet=x=>{$('#shc').innerHTML=x;$('#sh').classList.add('o');$('#sh>div').scrollTop=0};
const shut=()=>$('#sh').classList.remove('o');
const TI={ok:'check',info:'info',warn:'alert',err:'close'};let tT;
const toastOut=e=>{if(!e||!e.isConnected||e.classList.contains('bye'))return;e.classList.add('bye');setTimeout(()=>e.remove(),230)};
const toast=(t,k='ok')=>{const h=$('#ts');clearTimeout(tT);h.textContent='';const e=document.createElement('div'),message=String(t||'Something went wrong');e.className='toast '+k;e.innerHTML=`<span class="ti">${I(TI[k]||'info',16)}</span>`;const label=document.createElement('b');label.textContent=message;label.title=message;e.append(label);e.onclick=()=>toastOut(e);h.append(e);tT=setTimeout(()=>toastOut(e),2800)};
const copyTxt=(t,ok)=>{const f=()=>toast('Couldn’t copy. Try again.','warn');try{navigator.clipboard.writeText(t).then(()=>toast(ok),f)}catch(e){f()}};
/* status tag: tinted tile with a dot; amber ones breathe because they are still in progress */
const TG=(k,t,l=k=='am')=>`<span class="tg ${k} d${l?' live':''}">${t}</span>`;
const later=(ms,f)=>timers.push(setTimeout(f,ms));
function clr(){timers.forEach(clearTimeout);timers=[]}
/* charts */
const rnd=a=>{let x=(a*7919)%2147483647||1;x=x*16807%2147483647;return()=>(x=x*16807%2147483647)/2147483647};
const TFS=[['1H',48,59330,22],['1D',72,59980,70],['1W',84,61600,190],['1M',90,56900,380]];
function spark(wd=390,ht=76){
 const E=eq(),W=wd,H=ht;
 if(Math.abs(E-START)<.005&&S.days==0)return`<svg class="cht" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="M20 ${H/2}Q70 ${H/2-32} 120 ${H/2}${[220,320,420,520,620,720,820,920,1020,1120,1220].filter(x=>x<W+100).map(x=>`T${x} ${H/2}`).join('')}" fill="none" stroke="#252a41" stroke-width="3" stroke-linecap="round"/></svg><div class="mu ctr" style="margin-top:4px">Place your first trade</div>`;
 const n=wd>400?Math.min(150,Math.round(64*wd/390)):64,r=rnd(11+(S.stage=='funded'?5:0)),w=[0];
 for(let i=1;i<n;i++)w.push(w[i-1]+(r()-.5));
 const a=w.map((v,i)=>START+(E-START)*i/(n-1)+(v-w[n-1]*i/(n-1))*(Math.abs(E-START)*.14+8*K()));
 const lo=Math.min(...a),hi=Math.max(...a),y=v=>8+(H-24)*(1-(v-lo)/(hi-lo||1)),x=i=>i*W/(n-1);
 const d=a.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
 return`<svg class="cht" viewBox="0 0 ${W} ${H}" role="img" aria-label="Equity over time"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4562ff" stop-opacity=".35"/><stop offset="1" stop-color="#4562ff" stop-opacity="0"/></linearGradient></defs><path d="${d}L${W} ${H}L0 ${H}Z" fill="url(#ga)"/><path d="${d}" fill="none" stroke="#6b86ff" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${x(n-1)}" cy="${y(a[n-1]).toFixed(1)}" r="4.5" fill="#6b86ff"/></svg>`}
/* router, nav, dock */
const NN=['start','trade','order','passed','payout','pool','case','ledger','obiz'];
const TAB={home:'home',failed:'home',passed:'home',markets:'markets',trade:'markets',order:'markets',help:'help',pay:'pay',payout:'pay',pool:'pay',me:'me'};
const NAV=[['home','Home','home'],['markets','Trade','bars'],['help','Help'],['pay','Payouts','gift'],['me','Profile']];
const OPV=['owner','queue','accts','orules','case','obiz'],ONAV=[['owner','Overview','home'],['queue','Queue','file'],['accts','Accounts','user'],['orules','Rules','shield'],['me','Exit','back']];
const OP=()=>OPV.includes(S.v)||S.v=='ledger'&&S.p.from=='owner';
/* desktop layout starts at 1180px: sidebar, wider pages, two columns */
const DT=()=>innerWidth>=1180,WIDE=['home','markets','start','pay','payout','help','me','owner','orules','ledger','obiz'];
const CW=()=>Math.min(innerWidth-(S.v=='start'?0:240)-80,1120);
const two=(a,b,c='')=>DT()?`<div class="cols ${c}"><div class="c1">${a}</div><div class="c2">${b}</div></div>`:a+b;
const side0=()=>{if(OP()){const a=biz('All');return`<div class="mu sm">Net profit</div><div class="sbv">${h(a.net)}</div><div class="gn sm sb">${sg(biz('Today').net)} today</div>`}const F=S.stage=='funded',pr=eq()-START;return`<div class="mu sm">${SZ()} ${F?'Funded account':'Challenge'}</div><div class="sbv">${h(eq())}</div><div class="${pr<-.004?'rd':'gn'} sm sb">${sg(pr)} ${pr<-.004?'loss':'profit'}</div>`};
/* nav: built once per mode; later renders only move the .on class, so the glass pill can slide between items.
   The pill is four edges on short springs. The leading edge is stiffer than the trailing one, which gives a small stretch. */
const IN={e:null,v:{l:0,r:0,t:0,b:0},lead:{l:0,r:0,t:0,b:0},k:null,raf:0,last:0,initialAlignDone:true,alignTarget:null};
const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const indRect=()=>{const n=$('#nav'),a=n&&n.querySelector('.nb.on');return a&&n.offsetWidth?{l:a.offsetLeft,r:a.offsetLeft+a.offsetWidth,t:a.offsetTop,b:a.offsetTop+a.offsetHeight}:null};
const indPaint=()=>{const i=$('#ind'),e=IN.e;if(i&&e)i.style.cssText=`opacity:1;width:${Math.max(0,e.r-e.l).toFixed(1)}px;height:${Math.max(0,e.b-e.t).toFixed(1)}px;transform:translate3d(${e.l.toFixed(1)}px,${e.t.toFixed(1)}px,0)`};
const SPR={lead:[520,.8],trail:[315,.92],side:[420,.8]};
const indStep=now=>{
 const dt=Math.min((now-IN.last)/1000,1/30),T=indRect();IN.last=now;
 if(!T||!IN.e){IN.raf=0;return}
 let busy=0;
 for(const s of 'lrtb'){const q=IN.lead[s],[k,z]=q>0?SPR.lead:q<0?SPR.trail:SPR.side;IN.v[s]+=(k*(T[s]-IN.e[s])-2*Math.sqrt(k)*z*IN.v[s])*dt;IN.e[s]+=IN.v[s]*dt;if(Math.abs(T[s]-IN.e[s])>.25||Math.abs(IN.v[s])>3)busy=1}
 if(!busy){IN.e={...T};IN.v={l:0,r:0,t:0,b:0}}
 indPaint();IN.raf=busy?requestAnimationFrame(indStep):0};
function indGo(snap){
 const i=$('#ind'),T=indRect();if(!i)return;
 if(!T){i.style.opacity=0;IN.e=null;IN.k=null;return}
 const k=$('#nav .nb.on').dataset.k;
 if(snap||!IN.e||RM()){cancelAnimationFrame(IN.raf);IN.raf=0;IN.e={...T};IN.v={l:0,r:0,t:0,b:0};IN.k=k;return indPaint()}
 if(k!=IN.k){IN.k=k;$('#nav').classList.add('rdy');const dx=(T.l+T.r-IN.e.l-IN.e.r)/2,dy=(T.t+T.b-IN.e.t-IN.e.b)/2,h=Math.abs(dx)>=Math.abs(dy),f=h?dx:dy;IN.lead=h?{l:f>0?-1:1,r:f>0?1:-1,t:0,b:0}:{t:f>0?-1:1,b:f>0?1:-1,l:0,r:0}}
 if(!IN.raf){IN.last=performance.now();IN.raf=requestAnimationFrame(indStep)}}
function alignInitialIndicator(nv,on){
 if(!on||IN.initialAlignDone)return;
 const active=nv.querySelector('.nb.on');if(!active||IN.alignTarget===active)return;
 IN.alignTarget=active;
 const align=()=>{
  if(IN.initialAlignDone||IN.alignTarget!==active)return;
  IN.initialAlignDone=true;IN.alignTarget=null;
  const target=indRect();if(!target)return;
  cancelAnimationFrame(IN.raf);IN.raf=0;IN.e={...target};IN.v={l:0,r:0,t:0,b:0};IN.k=active.dataset.k;indPaint();
 };
 if(DT()||RM()){requestAnimationFrame(align);return}
 const done=e=>{if(e.target!==active||e.propertyName!=='padding')return;active.removeEventListener('transitionend',done);align()};
 active.addEventListener('transitionend',done);
 setTimeout(()=>{active.removeEventListener('transitionend',done);align()},420);
}
const nav=()=>{
 const nv=$('#nav'),op=OP(),lg=S.v=='ledger',on=op?(S.v=='case'?'queue':lg||S.v=='obiz'?'owner':S.v):lg?'pay':TAB[S.v],m=op?'o':'t';
 if(nv.dataset.m!=m){nv.dataset.m=m;IN.e=null;IN.k=null;IN.initialAlignDone=false;IN.alignTarget=null;nv.classList.remove('rdy');nv.innerHTML=`<div class="brand">${LG(38)}<span class="wm">berry firm</span></div><i class="ind" id="ind" aria-hidden="true"></i>`+(op?ONAV:NAV).map(([k,l,ic])=>`<button class="nb" data-k="${k}" aria-label="${l}" onclick="go('${k}')">${k=='help'&&!op?G('currentColor',26):k=='me'&&!op?AVI(0,'xs'):I(ic,24)}<span class="lbw"><span class="lb">${l}</span></span></button>`).join('')+'<div class="side"></div>'}
 nv.querySelectorAll('.nb').forEach(x=>{const o=x.dataset.k==on;x.classList.toggle('on',o);if(o)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
 const q=nv.querySelector('.nb[data-k=queue]');if(q){let x=q.querySelector('.bd');const n=S.own.need.length;if(n){if(!x){x=document.createElement('i');x.className='bd';q.append(x)}x.textContent=n}else if(x)x.remove()}
 nv.querySelector('.side').innerHTML=side0();indGo();alignInitialIndicator(nv,on)};
if(window.ResizeObserver)new ResizeObserver(()=>indGo(1)).observe($('#nav'));
if(document.fonts)document.fonts.ready.then(()=>indGo(1));
function draw(){
 const y=scrollY,dt=DT();if(dt&&(S.v=='trade'||S.v=='order'))S.v='markets';$('#v').innerHTML=V[S.v]();$('#v').className=dt&&WIDE.includes(S.v)?'wide':'';
 document.body.classList.toggle('nn',dt?S.v=='start':NN.includes(S.v));
 const d=dt&&S.v=='start'?null:D[S.v]?D[S.v]():null,dk=$('#dock');dk.className='dock'+(d&&d.c?' '+d.c:'');dk.innerHTML=d?d.h:'';
 nav();scrollTo(0,y);if(S.v=='payout')payTick()}
function go(k,p){shut();if(DT()&&(k=='trade'||k=='order'))k='markets';if(k=='markets'&&S.v!='markets'&&S.v!='trade'){S.mq='';S.mc='All'}S.v=k;S.p=p||{};if(S.p.m){S.m=S.p.m;if(DT())newT(S.m)}draw();scrollTo(0,0)}
addEventListener('keydown',e=>{if(e.key==='Escape')shut()});
let lastW=innerWidth,rz;addEventListener('resize',()=>{clearTimeout(rz);rz=setTimeout(()=>{if(DT()!=lastW>=1180||Math.abs(innerWidth-lastW)>=80){lastW=innerWidth;draw()}},150)});
