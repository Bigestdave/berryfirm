/* ---------- Manage a position ---------- */
const manage=(i=0)=>{const p=S.pos[i];if(!p)return toast('No open trade','info');const m=MP(p);M={i,tab:M.tab||'Stop loss',sl:p.sl==null?+(m.p-m.sd*dir(p)).toFixed(m.dp):p.sl,fr:.5};mg()};
const mgT=t=>{M.tab=t;mg()};
const mgF=f=>{M.fr=f;mg()};
const mgSL=d=>{const p=S.pos[M.i],m=MP(p);let n=M.sl+d;n=dir(p)>0?Math.min(n,m.p-m.st):Math.max(n,m.p+m.st);M.sl=+n.toFixed(m.dp);mg()};
const setSL=()=>{const p=S.pos[M.i],m=MP(p);if(serverNeeded())return;if(BerryAPI.online&&p.id)return BerryAPI.updatePosition(p.id,M.sl);p.sl=M.sl;shut();draw();toast(m.s+' stop loss set · '+tk(M.sl,m))};
const closePos=(i,f)=>{
 const p=S.pos[i],m=MP(p),xp=m.p*(p.side=='Buy'?1-SLIP:1+SLIP),q=p.z*f,r=(xp-p.e)*q*dir(p),fee=q*xp*FEE;
 if(serverNeeded())return;if(BerryAPI.online&&p.id)return BerryAPI.closePosition(p.id,f);
 S.bal+=r-fee;S.rl+=r-fee;S.ord.unshift([p.side=='Buy'?'Sell':'Buy',+q.toFixed(4),xp,'just now',p.m||'BTC']);
 if(f>=.999)S.pos.splice(i,1);else p.z=+(p.z-q).toFixed(4);
 shut();draw();toast((f>=.999?'Closed ':'Partly closed ')+m.s+' · '+sg(r-fee))};
const mg=()=>{
 const p=S.pos[M.i],m=MP(p),b=dir(p),xp=m.p*(b>0?1-SLIP:1+SLIP);let body='';
 if(M.tab=='Stop loss'){
  const cur=lossAt(p),nl=Math.max(0,(p.e-M.sl)*p.z*b),after=DAILY-Math.max(0,wr()-cur+nl-S.rl);
  body=`<div class="r" style="min-height:72px"><span class="k">New stop loss</span><span class="stp"><b>${tk(M.sl,m)}</b><button aria-label="Lower stop loss" onclick="mgSL(-${m.st})">${I('minus',18)}</button><button aria-label="Raise stop loss" onclick="mgSL(${m.st})">${I('plus',18)}</button></span></div>${R('Loss at stop (estimate)',`${mm(cur)} → <span class="rd">${mm(nl)}</span>`)+R('Daily loss left if hit',`${mm(left2())} → ${mm(after)}`)}<div class="mu sm" style="margin:12px 0 0">Stops fill at the next available price, which can differ from your stop.</div><button class="btn" style="margin-top:16px" onclick="setSL()">Update stop loss</button>`}
 else if(M.tab=='Partial close'){
  const q=+(p.z*M.fr).toFixed(4),rs=(xp-p.e)*q*b-q*xp*FEE;
  body=`<div class="tf" style="margin:12px 0 0">${[.25,.5,.75].map(f=>`<button class="${f==M.fr?'on':''}" onclick="mgF(${f})">${Math.round(f*100)}%</button>`).join('')}</div>${R('Closes',zf(q,m))+R('Result (estimate)',`<span class="${rs<0?'rd':'gn'}">${sg(rs)}</span>`)+R('Stays open',zf(+(p.z-q).toFixed(4),m))}<button class="btn" style="margin-top:16px" onclick="closePos(${M.i},${M.fr})">Close ${Math.round(M.fr*100)}%</button>`}
 else{
  const rs=(xp-p.e)*p.z*b-p.z*xp*FEE;
  body=`${R('Closes at','≈ '+pf(xp,m))+R('Fee · 5 bps','$'+f2(p.z*xp*FEE))+R('Result (estimate)',`<span class="${rs<0?'rd':'gn'}">${sg(rs)}</span>`)}<button class="btn" style="margin-top:16px" onclick="closePos(${M.i},1)">Close position</button>`}
 sheet(`<div class="t2">${m.s}</div><div class="mu">${p.side} · ${zf(p.z,m)} · entry ${tk(p.e,m)}</div><div class="seg" style="margin-top:14px">${['Stop loss','Partial close','Close'].map(t=>`<button class="${t==M.tab?'on':''}" onclick="mgT('${t}')">${t}</button>`).join('')}</div>${body}`)};
/* ---------- Markets: the Trade tab opens here ---------- */
const pick=k=>{if(DT()){S.m=k;newT(k);draw()}else go('trade',{m:k})};
const mrow=k=>{const m=MK[k];return`<button class="r${DT()&&k==S.m?' sel':''}" style="min-height:68px" onclick="pick('${k}')">${mi(k,44,held(k))}<span class="nm">${m.s}<small>${m.n}</small></span><b class="v">${pf(m.p,m)}<small>${chg(k)}</small></b></button>`};
const mfind=()=>{const t=(S.mq||'').toLowerCase().trim();return Object.keys(MK).filter(k=>mon(k)&&(S.mc=='All'||MK[k].c==S.mc)&&(!t||(MK[k].s+' '+MK[k].n+' '+k+' '+MK[k].c).toLowerCase().includes(t)))};
const mlist=()=>{const ks=mfind();return ks.length?CATS.map(c=>{const a=ks.filter(k=>MK[k].c==c);return a.length?`<div class="sec">${c}<span class="mu sm">${a.length}</span></div>${a.map(mrow).join('')}`:''}).join(''):EMP('No markets match','Try another name or category.')};
const msearch=v=>{S.mq=v;$('#ml').innerHTML=mlist()};
const mcat=c=>{S.mc=c;draw()};
const mpane=()=>{
 const cats=['All',...CATS.filter(c=>Object.keys(MK).some(k=>MK[k].c==c&&mon(k)))];
 return`<label class="in sr">${I('search',20)}<input id="ms" value="${S.mq}" oninput="msearch(this.value)" placeholder="Search markets" autocomplete="off" aria-label="Search markets"></label>
<div class="pills">${cats.map(c=>`<button class="${c==S.mc?'on':''}" onclick="mcat('${c}')">${c}</button>`).join('')}</div>
${S.pos.length&&!S.mq&&S.mc=='All'?`<div class="sec" style="margin-top:8px">Open trades<span class="mu sm">${S.pos.length}</span></div>${S.pos.map(posRow).join('')}`:''}<div id="ml">${mlist()}</div>`};
V.markets=()=>DT()?mkt():`${hdr(1)}<h1 style="margin:4px 0 14px">Markets</h1>${mpane()}
<div class="mu sm" style="margin-top:18px">Each fill pays a 5 bps fee and 2 bps slippage.</div>`;
const mswitch=()=>sheet(`<div class="t2">Switch market</div>${CATS.map(c=>{const a=Object.keys(MK).filter(k=>MK[k].c==c&&mon(k));return a.length?`<div class="sec" style="font-size:15px;color:var(--mu);margin-top:14px">${c}</div>${a.map(k=>`<button class="r" style="min-height:58px" onclick="pick('${k}')">${mi(k,36,held(k))}<span class="nm">${MK[k].s}</span><b class="v">${pf(MK[k].p,MK[k])}<small>${chg(k)}</small></b></button>`).join('')}`:''}).join('')}`);
/* ---------- Market detail ---------- */
const mv=(c,m,full,mt)=>`<div class="sb" style="margin:${mt}px 0 0"><span class="${c.d<0?'rd':'gn'}">${c.d<0?'▼':'▲'} ${full?dd(c.d,m)+' ('+Math.abs(c.p).toFixed(1)+'%)':Math.abs(c.p).toFixed(1)+'%'}</span> <span class="mu" style="font-weight:500">today</span></div>`;
const about=m=>R('Market',m.n)+R('Size step',zf(m.zs,m))+R('Fee','5 bps per fill')+R('Slippage','2 bps against you')+R('Max exposure','2× your equity')+R('Stops','Fill at the next available price')+R('Evaluation scope','Rule-based fills, no external order book');
const ordRow=o=>{const m=MK[o[4]||'BTC'];return`<div class="r" style="min-height:64px"><span class="nm" style="margin:0">${o[0]} ${zf(o[1],m)}<small>${o[3]}</small></span><b class="v">${pf(o[2],m)}<small>Filled</small></b></div>`};
V.trade=()=>{
 const k=S.m,m=MK[k],c=dchg(k),mine=S.pos.filter(p=>(p.m||'BTC')==k),oo=S.ord.filter(o=>(o[4]||'BTC')==k);
 const b=S.tab=='Position'?(mine.length?mine.map(p=>posRow(p,S.pos.indexOf(p))).join(''):EMP('No open trades','Tap Buy or Sell to place one.')):S.tab=='Orders'?(oo.length?oo.map(ordRow).join(''):EMP('No orders yet','Your fills show up here.')):about(m);
 return`<div class="bar">${BK('markets')}<button class="ttl" onclick="mswitch()" aria-label="Switch market">${mi(k,32,held(k))}<span>${m.s}<small>${m.n}</small></span><span class="mu" style="display:flex">${I('down',18)}</span></button></div>
<div class="big" style="margin-top:6px">${hp(m.p,m)}</div>${mv(c,m,1,10)}
${candles({sl:mine.length?mine[0].sl:null})}<div class="tf">${TFS.map((t,i)=>`<button class="${i==S.tf?'on':''}" onclick="S.tf=${i};draw()">${t[0]}</button>`).join('')}<span class="sp" aria-hidden="true">${I('candle',22)}</span></div>
<div class="two" style="margin:0 0 14px"><div class="card col"><div class="mu sm">Daily loss left</div><b>${mm(dayLeft())}</b></div><div class="card col"><div class="mu sm">Max loss left</div><b>${mm(eq()-FLOOR)}</b></div></div>
<div class="tabs">${['Position','Orders','About'].map(t=>`<button class="${t==S.tab?'on':''}" onclick="S.tab='${t}';draw()">${t}</button>`).join('')}</div>${b}`};
D.trade=()=>paused()?{c:'col',h:`<div class="mu sm">Trading is paused while your payout is open.</div>`}:{h:`<button class="btn sell" onclick="openOrder('Sell')">Sell</button><button class="btn buy" onclick="openOrder('Buy')">Buy</button>`};
/* ---------- Order ticket ---------- */
const slAt=(m,s)=>+(m.p+(s=='Buy'?-1:1)*m.sd).toFixed(m.dp);
const newT=(k,s='Buy')=>{const m=MK[k];T={m:k,side:s,z:m.z0,sl:slAt(m,s),tp:null}};
const openOrder=s=>{if(paused())return toast('Trading is paused while your payout is open','warn');newT(S.m,s);go('order')};
const side=s=>{if(s!=T.side){T.side=s;T.sl=slAt(MK[T.m],s);T.tp=null}T.touch=1;draw()};
const st=(f,d)=>{const m=MK[T.m];if(f=='z')T.z=Math.max(m.zs,+(T.z+d).toFixed(4));else{const b=T.side=='Buy'?1:-1;let n=T[f]+d;n=f=='sl'?(b>0?Math.min(n,m.p-m.st):Math.max(n,m.p+m.st)):(b>0?Math.max(n,m.p+m.st):Math.min(n,m.p-m.st));T[f]=+n.toFixed(m.dp)}T.touch=1;draw()};
const addTP=()=>{const m=MK[T.m];T.tp=+(m.p+(T.side=='Buy'?2:-2)*m.sd).toFixed(m.dp);T.touch=1;draw()};
const stp=(k,v,f,d,sub)=>`<div class="r" style="min-height:76px"><span class="k">${k}${sub?`<span class="mu sm" style="display:block;font-weight:500">${sub}</span>`:''}</span><span class="stp"><b>${v}</b><button aria-label="Decrease ${k}" onclick="st('${f}',-${d})">${I('minus',18)}</button><button aria-label="Increase ${k}" onclick="st('${f}',${d})">${I('plus',18)}</button></span></div>`;
const orderBad=()=>T.z>maxZ(T.m)+1e-9?'Bigger than your 2× limit allows':tLeft()<0?'Stop is beyond your daily loss limit':'';
const tbody=()=>{
 const m=MK[T.m],bad=orderBad(),bu=T.side=='Buy';
 return`<div class="seg"><button class="${bu?'on':''}" onclick="side('Buy')">Buy</button><button class="${bu?'':'on sell'}" onclick="side('Sell')">Sell</button></div>
${stp('Size',zf(T.z,m),'z',m.zs)}${stp('Stop loss',tk(T.sl,m),'sl',m.st)}
${T.tp==null?`<div class="r" style="min-height:64px"><span class="k">Take profit</span><button class="v bl" onclick="addTP()">Add</button></div>`:stp('Take profit',tk(T.tp,m),'tp',m.st,`+${mm(Math.abs(T.tp-m.p)*T.z)} if hit · <button class="bl" onclick="T.tp=null;draw()">Remove</button>`)}
<div class="risk">${I('shield',26)}<span>${bad?`<span class="am">${bad}</span>`:`Risk ${mm(tRisk())} · daily loss left ${mm(tLeft())}`}</span></div>`};
V.order=()=>{
 const m=MK[T.m],c=dchg(T.m);
 return`<div class="bar">${BK('trade')}<b class="ttl">${m.s}</b></div>
<div class="big">${hp(m.p,m)}</div>${mv(c,m,0,10)}${candles({m:T.m,h:210,sl:T.sl,tp:T.tp})}${tbody()}`};
D.order=()=>({h:`<button class="btn ${T.side=='Sell'?'sell':''}" ${orderBad()?'disabled':''} onclick="review()">Review ${T.side.toLowerCase()}</button>`});
const review=()=>{
 const m=MK[T.m],bu=T.side=='Buy',px=m.p*(bu?1+SLIP:1-SLIP),fee=T.z*px*FEE,use=(nt()+T.z*m.p)/(2*eq())*100;
 sheet(`<div class="t2">${T.side} ${zf(T.z,m)}</div><div class="mu">Check the numbers, then confirm.</div><div style="margin-top:10px">${R('Estimated price','≈ '+pf(px,m))+R('Fee · 5 bps','$'+f2(fee))+R('Slippage · 2 bps','≈ $'+f2(T.z*m.p*SLIP))+R('Buying power used',Math.round(use)+'% of 2×')+R('Stop loss',tk(T.sl,m))+R('If your stop loss is hit',`<span class="rd">−${mm(tRisk())}</span>`,mm(tLeft())+' left today')}</div><div class="risk" style="margin-top:12px">${I('shield',20,'gn')}<span class="sm">Within your limits · Rules v1</span></div><button class="btn ${bu?'':'sell'}" style="margin-top:16px" onclick="fill()">Confirm ${T.side.toLowerCase()}</button>`)};
const fill=()=>{
 if(serverNeeded())return;
 const m=MK[T.m],bu=T.side=='Buy',px=m.p*(bu?1+SLIP:1-SLIP),fee=T.z*px*FEE;
 if(BerryAPI.online)return BerryAPI.order({market:T.m,side:T.side,size:T.z,stopLoss:T.sl,takeProfit:T.tp});
 S.pos.push({m:T.m,side:T.side,z:T.z,e:px,sl:T.sl,tp:T.tp});S.bal-=fee;S.rl-=fee;S.ord.unshift([T.side,T.z,px,'just now',T.m]);S.days=Math.max(S.days,1);S.tab='Position';S.m=T.m;
 go('trade');
 sheet(`<div class="ctr" style="padding-top:6px">${CK(44)}<div class="t2" style="margin-top:14px">Filled</div><div class="mu">${T.side} ${zf(T.z,m)} at ${pf(px,m)}</div></div><div style="margin-top:14px">${R('Fee','$'+f2(fee))+R('Stop loss',tk(T.sl,m))}</div><button class="btn" style="margin-top:18px" onclick="shut()">Done</button>`)};
/* ---------- Desktop: markets list, chart and ticket side by side ---------- */
const mkt=()=>{
 if(T.m!=S.m)newT(S.m);
 const k=S.m,m=MK[k],c=dchg(k),mine=S.pos.filter(p=>(p.m||'BTC')==k),oo=S.ord.filter(o=>(o[4]||'BTC')==k),pw=Math.max(420,CW()-392);
 const tb=S.tab=='Position'?(mine.length?mine.map(p=>posRow(p,S.pos.indexOf(p))).join(''):EMP('No open trades','Use the ticket to place one.')):S.tab=='Orders'?(oo.length?oo.map(ordRow).join(''):EMP('No orders yet','Your fills show up here.')):about(m);
 const tk2=paused()?`<div class="card col tk"><b>Trading is paused</b><div class="mu" style="margin-top:6px">Your payout request is open. Trading resumes once it is paid.</div></div>`:`<div class="card col tk"><b>Place a trade</b>${tbody()}<button class="btn ${T.side=='Sell'?'sell':''}" style="margin-top:16px" ${orderBad()?'disabled':''} onclick="review()">Review ${T.side.toLowerCase()}</button></div>`;
 return`${hdr(1)}<h1 style="margin:4px 0 18px">Markets</h1><div class="md"><aside>${mpane()}</aside>
<section class="mr"><div class="th"><div class="tn">${mi(k,48,held(k))}<div><div class="tt">${m.s}</div><div class="mu">${m.n}</div></div></div><div class="tpr"><div class="big" style="font-size:38px;margin:0">${hp(m.p,m)}</div>${mv(c,m,1,6)}</div></div>
${candles({m:k,vw:pw,h:300,sl:T.touch?T.sl:mine.length?mine[0].sl:null,tp:T.touch?T.tp:null})}<div class="tf" style="margin-top:6px">${TFS.map((t,i)=>`<button class="${i==S.tf?'on':''}" onclick="S.tf=${i};draw()">${t[0]}</button>`).join('')}</div>
<div class="cols t">${tk2}<div><div class="two" style="margin:0 0 14px"><div class="card col"><div class="mu sm">Daily loss left</div><b>${mm(dayLeft())}</b></div><div class="card col"><div class="mu sm">Max loss left</div><b>${mm(eq()-FLOOR)}</b></div></div>
<div class="tabs">${['Position','Orders','About'].map(t=>`<button class="${t==S.tab?'on':''}" onclick="S.tab='${t}';draw()">${t}</button>`).join('')}</div>${tb}</div></div></section></div>`};
