/* ---------- Operator: Overview, Queue, Accounts, Rules, Ledger ---------- */
const OW={breach:['Breach appeal','Riley Chen · $10K Challenge','Price looks wrong','−$512'],wallet:['Payout request','Trader ···e3b2','Wallet changed after approval','$4.80']};
/* ---- Business: every figure on Overview, the sidebar and the ledger comes from this block.
   Replace biz(), trend() and ledger() with reads from your API (see the build brief).
   New sales and payouts made in this session come from live state, so the numbers move when you use the app. ---- */
const PER=['Today','7D','All'],PL={Today:'Today','7D':'7 days',All:'All time'},PH={Today:24,'7D':168,All:1e9};
const BZ={Today:{n:{5000:3,10000:4,25000:1,50000:1},ai:.9,host:.2},'7D':{n:{5000:61,10000:68,25000:26,50000:16},ai:14.6,host:3},All:{n:{5000:86,10000:86,25000:32,50000:10},ai:19.4,host:3.6}};
const ago=s=>s=='just now'?0:/m ago$/.test(s)?parseFloat(s)/60:/h ago$/.test(s)?parseFloat(s):parseFloat(s)*24;
const hh=x=>x<1/60?'just now':x<1?Math.round(x*60)+'m ago':x<24?Math.round(x)+'h ago':Math.round(x/24)+'d ago';
const biz=per=>{
 if(S.business&&S.business[per])return S.business[per];
 const b=BZ[per],sold=SIZES.reduce((a,s)=>a+(b.n[s]||0),0)+S.sales.length,sales=SIZES.reduce((a,s)=>a+(b.n[s]||0)*(BERRY.fees[s]||0),0)+S.sales.reduce((a,x)=>a+x.f,0),
  paid=S.pool.paid.filter(x=>ago(x[3])<PH[per]),pay=paid.reduce((a,x)=>a+x[1],0),cost=b.ai+b.host,net=sales-pay-cost;
 return{per,sold,sales,pay,np:paid.length,ai:b.ai,host:b.host,cost,net,keep:sales?net/sales:0}};
const trend=per=>{if(S.trends&&S.trends[per])return S.trends[per];const n=per=='Today'?24:per=='7D'?28:30,r=rnd(41+PER.indexOf(per)),a=[];let s=0;for(let i=0;i<n;i++){s+=.4+r()*.9+(i>n*.65?.5:0);a.push(s)}return a};
const area=(v,W,H)=>{const lo=Math.min(...v),hi=Math.max(...v),y=q=>8+(H-24)*(1-(q-lo)/(hi-lo||1)),x=i=>i*(W-14)/(v.length-1),d=v.map((q,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(q).toFixed(1)}`).join('');return`<svg class="cht" viewBox="0 0 ${W} ${H}" role="img" aria-label="Net profit over time"><defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#19d46a" stop-opacity=".26"/><stop offset="1" stop-color="#19d46a" stop-opacity="0"/></linearGradient></defs><path d="${d}L${x(v.length-1)} ${H}L0 ${H}Z" fill="url(#gt)"/><path d="${d}" fill="none" stroke="#2fdc7c" stroke-width="2.2" stroke-linejoin="round"/><circle cx="${x(v.length-1)}" cy="${y(v[v.length-1]).toFixed(1)}" r="4.5" fill="#2fdc7c"/></svg>`};
/* ledger: newest first. Sales and costs are samples; payouts come from the pool list. */
const LS=[[10000,'NEAR','7Hq2…m9Zc',.07],[5000,'USDC','Ch4v…p1Ua',.18],[25000,'ETH','Fm8e…q3Xd',1.6],[10000,'SOL','Zr2k…b7Lw',7],[50000,'USDC','Ta9n…c5Vo',9],[5000,'NEAR','Yd3j…h8Sm',15]];
const LC=[['AI decisions · 38 calls','Inference',.31,1],['Hosting','Server',.4,6],['AI decisions · 112 calls','Inference',.94,12]];
const ledger=()=>S.ledger||[
 ...S.sales.filter(x=>x.f).map(x=>['sale','$'+x.s/1000+'K challenge','Paid in USDC',x.f,'',0]),
 ...LS.filter(x=>BERRY.fees[x[0]]).map(x=>['sale','$'+x[0]/1000+'K challenge','Paid in '+x[1],BERRY.fees[x[0]],x[2],x[3]]),
 ...LC.map(x=>['cost',x[0],x[1],-x[2],'',x[3]]),
 ...S.pool.paid.map(x=>['pay','Payout · Trader ···'+x[0],x[2],-x[1],'',ago(x[3])])
].sort((p,q)=>p[5]-q[5]);
const txLink=(r,meta={})=>(meta.rail==='testnet'||(!meta.rail&&S.rail==='testnet'))&&/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(r||'')?`<a class="txlink" href="https://testnet.nearblocks.io/txns/${encodeURIComponent(r)}" target="_blank" rel="noopener noreferrer">Verify on NEAR testnet ↗</a>`:'';
const shortLedgerDetail=(type,detail,meta={})=>{
 const text=String(detail||'');
 if(type==='decision'&&meta.policyResult==='passed')return`Policy passed · Trader ${Math.round((meta.economics?.traderShareRate||0)*100)}%`;
 if(type==='decision')return meta.by==='offline-policy'?'Policy fallback · eligibility and limits passed':meta.by==='policy-gate'?'Policy gate · owner review':meta.by==='agent-error'?'Berry AI · owner review':meta.by?`Berry AI · ${meta.by}`:/approved/i.test(text)?'Eligibility and limits passed':/reject/i.test(text)?'Request declined':'Needs review';
 if(type==='cost'&&meta.estimated)return'Token count unavailable · estimated cost';
 if(type==='cost'&&Number.isFinite(meta.inputTokens)&&Number.isFinite(meta.outputTokens))return`${(meta.inputTokens-(meta.cachedTokens||0)).toLocaleString()} in · ${(meta.cachedTokens||0).toLocaleString()} cached · ${meta.outputTokens.toLocaleString()} out`;
 if(type==='sale'&&meta.rail==='near-intents-mainnet')return'Payment confirmed · NEAR Intents';
 if(type==='pay'&&meta.balanceBefore!=null&&meta.balanceAfter!=null)return`Treasury ${mm(meta.balanceBefore)} → ${mm(meta.balanceAfter)}`;
 if(type==='demo')return 'No payment collected';
 if(text.length<=42)return text;
 return text.slice(0,39).trimEnd()+'…';
};
const escText=text=>String(text).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const lrow=x=>{const[t,l,d,a,r,hr,meta={}]=x,detail=shortLedgerDetail(t,d,meta),reference=txLink(r,meta),proof=meta.explorerUrl?`<a class="txlink" href="${escText(meta.explorerUrl)}" target="_blank" rel="noopener noreferrer">Verify sale ↗</a>`:'',value=t==='cost'&&Math.abs(a)>0&&Math.abs(a)<.005?'$'+Math.abs(a).toFixed(6):mm(a);return`<div class="r" style="min-height:64px"><span class="nm" style="margin:0">${l}<small title="${escText(d||'')}">${[escText(detail),reference,proof,hh(hr)].filter(Boolean).join(' · ')}</small></span><b class="v ${t=='sale'?'gn':''}">${a<0?'−':'+'}${value}<small>${{sale:'Sale',pay:'Payout',cost:'Cost',decision:'Decision',appeal:'Appeal',demo:'Test account'}[t]||t}</small></b></div>`};
/* ---- shared pieces ---- */
const ohd=(t,s)=>`<div class="bar">${LG(34)}<span class="chip">Operator</span></div><h1 style="margin:4px 0 ${s?'4px':'16px'}">${t}</h1>${s?`<div class="mu" style="margin-bottom:16px">${s}</div>`:''}`;
const caseCard=k=>{const c=S.caseMap&&S.caseMap[k],x=c?{t:c.type=='payout'?'Payout review':'Account review',s:'Trader ···'+c.wallet.slice(-4),d:c.decision?.reason||'Needs an owner decision',a:c.payload?.amount?mm(c.payload.amount):'Review'}:{t:OW[k][0],s:OW[k][1],d:OW[k][2],a:OW[k][3]};return`<button class="card cs" onclick="go('case',{id:'${k}',from:'${S.v}'})">${AVI(c?avId(c.wallet):k=='breach'?1:avId('e3b2'),'s')}<span class="cb"><b>${x.t}</b><small>${x.s}</small>${TG('am',x.d,0)}</span><b>${x.a}</b></button>`};
const limRow=(k,v,m)=>`<div class="r rc"><div class="fl"><span class="k">${k}</span><b>${mm(v)} of ${m0(m)}</b></div><div class="pb"><i style="width:${Math.min(100,v/m*100)}%"></i></div></div>`;
const funRow=(k,n,mx,s)=>`<div class="r rc"><div class="fl"><span class="k">${k}</span><b style="text-align:right">${n}<small style="display:block;color:var(--mu);font-size:13px;font-weight:500;margin-top:1px">${s}</small></b></div><div class="pb"><i style="width:${Math.max(2,Math.min(100,n/mx*100))}%"></i></div></div>`;
const setRow=x=>`<div class="r" style="min-height:68px">${AVI(avId(x[0]),'s')}<span class="nm">Trader ···${x[0]}<small>${x[2]} · ${x[3]}</small></span><b class="v gn">$${f2(x[1])}<small>Paid</small></b></div>`;
const bper=p=>{S.bp=p;draw()};
const addFunds=()=>sheet(`<div class="t2">Add funds</div><div class="mu">Send USDC on NEAR to the treasury account. It shows in the pool once it is confirmed.</div><div style="margin-top:10px">${R('Asset','USDC')+R('Network','NEAR')+R('Treasury account',shortAccount(BERRY.treasury,'a3f9…c81d'))}</div>${BERRY.treasury?`<button class="btn" style="margin-top:18px" onclick="copyTxt(BERRY.treasury,'Address copied')">Copy address</button>`:''}`);
/* ---- Overview: one number, three money rows, then the company. Each row opens its own page (V.obiz). ---- */
const goB=k=>`go('obiz',{k:'${k}'})`;
V.owner=()=>{
 const per=S.bp||'All',b=biz(per),need=S.own.need,q=S.pool,tot=S.own.done+need.length,dt=DT();
 const pz=S.cfg.halt?`<button class="ban" style="margin:0 0 4px" onclick="go('orules')">${TG('am','Paused')}<span><b>Business paused</b><small>No new challenges or payouts. Resume in Rules.</small></span><span class="ch">${I('chev',20)}</span></button>`:'';
 const seg=`<div class="seg s" role="group" aria-label="Period">${PER.map(p=>`<button class="${p==per?'on':''}" onclick="bper('${p}')">${PL[p]}</button>`).join('')}</div>`;
 const hero=`<div class="mu sm" style="margin-top:20px">Net profit</div><div class="big ${b.net<0?'rd':''}" style="margin:8px 0 6px">${h(b.net)}</div><div class="mu">${b.sales?Math.round(b.keep*100)+'% of sales kept':'No sales yet'}</div>${area(trend(per),dt?CW()-436:390,dt?200:76)}`;
 const money=`<div style="margin-top:8px">${R('Sales',mm(b.sales),b.sold+' challenges sold',goB('sales'))+R('Payouts',b.pay?'−'+mm(b.pay):'$0',b.np+' settled',goB('payouts'))+R('AI and hosting','−'+mm(b.cost),'AI '+mm(b.ai)+' · hosting '+mm(b.host),goB('costs'))}</div>`;
 const needs=need.length?`<div class="sec">Needs you<span class="cn">${need.length}</span></div>${need.map(caseCard).join('')}`:'';
 const co=`<div style="margin-top:${need.length?18:8}px">${R('Berry AI',S.own.done+' of '+tot,'cases handled automatically',goB('ai'))+R('Treasury',mm(q.inp),'In the pool',goB('treasury'))+R('Public ledger','Every sale, cost and payout','',"go('ledger',{from:'owner'})",1)}</div>`;
 return`${ohd('Overview')}${pz}${dt?two(seg+hero+money,needs+co):seg+hero+money+needs+co}`};
/* ---- Detail pages, one topic each. They hold what used to crowd the Overview. Replace the reads the same way as biz(). ---- */
const OBZ={
 sales:()=>{const per=S.bp||'All',b=biz(per),n=b.bySize||BZ[per].n,al=biz('All'),q=S.pool;
  const rows=SIZES.filter(s=>BERRY.fees[s]||n[s]||S.sales.some(x=>x.s==s)).map(s=>{const m=S.sales.filter(x=>x.s==s);return R('$'+s/1000+'K challenge',mm((n[s]||0)*(BERRY.fees[s]||0)+m.reduce((a,x)=>a+x.f,0)),((n[s]||0)+m.length)+' sold')}).join('');
  return{k:'Sales',v:mm(b.sales),s:b.sold+' challenges sold · '+PL[per],
   a:`<div style="margin-top:6px">${rows}</div><div class="sec">Latest sales<button onclick="go('ledger',{from:'owner'})">Ledger</button></div>${ledger().filter(x=>x[0]=='sale').slice(0,3).map(lrow).join('')||EMP('No sales yet','Sales appear here as traders pay.')}`,
   z:`<div class="sec">Funnel<span class="mu sm">All time</span></div>${funRow('Challenges sold',al.sold,al.sold,(al.statuses?.active||0)+' active now')+funRow('Passed',al.statuses?.passed||0,al.sold,'Passed challenges')+funRow('Funded',al.statuses?.funded||0,al.sold,'Started a funded account')+funRow('Paid out',q.paid.length,al.sold,'Received a payout')}`}},
 payouts:()=>{const per=S.bp||'All',b=biz(per),td=biz('Today'),q=S.pool;
  return{k:'Paid out',v:b.pay?mm(b.pay):'$0',s:b.np+' settled · '+PL[per],
   a:`<div class="sec">Limits today<button onclick="go('orules')">Change</button></div>${limRow('Payouts',td.pay,S.cfg.lim.pay)}`,
   z:`<div class="sec">Settlements<button onclick="go('ledger',{from:'owner'})">Ledger</button></div>${q.paid.length?q.paid.slice(0,5).map(setRow).join(''):EMP('No payouts yet','They appear here once Berry AI approves one.')}`}},
 costs:()=>{const per=S.bp||'All',b=biz(per);
  return{k:'AI and hosting',v:mm(b.cost),s:(b.sales?Math.round(b.cost/b.sales*100)+'% of sales':'No sales yet')+' · '+PL[per],
   a:`<div style="margin-top:6px">${R('AI decisions',mm(b.ai),'Inference')+R('Hosting',mm(b.host),'Server')}</div>`,
   z:`<div class="sec">Latest costs<button onclick="go('ledger',{from:'owner'})">Ledger</button></div>${ledger().filter(x=>x[0]=='cost').map(lrow).join('')}`}},
 ai:()=>{const need=S.own.need,tot=S.own.done+need.length,td=biz('Today');
  return{k:'Run by Berry AI',v:S.own.done+' of '+tot,s:(tot?Math.round(S.own.done/tot*100):0)+'% of cases handled automatically today',
   a:`<div style="margin-top:6px">${R('Your time today','≈ '+S.own.min+' min','Only exceptions reach you')+R('Needs you',need.length,need.length?'Open the queue':'All clear',"go('queue')")}</div>`,
   z:`<div class="sec">Limits today<button onclick="go('orules')">Change</button></div>${limRow('AI spend',td.ai,S.cfg.lim.ai)}`}},
 treasury:()=>{const q=S.pool,av=q.inp-q.res-q.snd;
  return{k:'In the pool',v:mm(q.inp),s:'USDC on NEAR',
   a:`<div style="margin-top:6px">${R('Set aside',mm(q.res),'For approved payouts')+R('Available',mm(av))+R('Treasury account',shortAccount(BERRY.treasury,'a3f9…c81d'))}</div>`,
   z:`<button class="btn g" style="margin-top:18px" onclick="addFunds()">Add funds</button>`}}};
V.obiz=()=>{const x=(OBZ[S.p.k]||OBZ.sales)();return`<div class="bar">${BK('owner')}<span class="chip">Operator</span></div><div class="mu" style="margin-top:4px">${x.k}</div><h1 style="margin:6px 0 4px">${x.v}</h1><div class="mu" style="margin-bottom:14px">${x.s}</div>${two(x.a,x.z)}`};
/* ---- Ledger: the public page of every sale, cost and payout ---- */
V.ledger=()=>{
 const b=biz('All');
 return`<div class="bar">${BK(S.p.from||'owner')}<span class="chip">Public · No login</span></div><h1 style="margin:4px 0 6px">Ledger</h1><div class="mu" style="margin-bottom:6px">Every sale, cost and payout.</div>
${two(R('Sales',mm(b.sales),b.sold+' challenges sold')+R('Payouts',b.pay?'−'+mm(b.pay):'$0',b.np+' settled')+R('AI and hosting','−'+mm(b.cost))+R('Net profit',`<span class="gn">${mm(b.net)}</span>`)+R('Treasury account',shortAccount(BERRY.treasury,'a3f9…c81d')),`<div class="sec">Latest</div>${ledger().map(lrow).join('')}`)}`};
V.queue=()=>{
 const need=S.own.need,tab=S.p.tab||'Needs you',q=S.pool;
 const list=tab=='Needs you'?(need.length?need.map(caseCard).join(''):EMP('Nothing needs you','Routine cases are handled by Rules v1.')):
  tab=='Handled'?R('Payout request · ···4a1c','$4.20','Approved automatically by Rules v1')+R('Payout request · ···9d70','$3.60','Approved automatically by Rules v1')+R('Challenge result · ···2b8f','Passed','Approved automatically by Rules v1'):
  q.paid.map(x=>R('Trader ···'+x[0],`<span class="gn">$${f2(x[1])}</span>`,x[2]+' · '+x[3])).join('');
 return`${ohd('Queue')}<div class="mu" style="margin:-8px 0 14px">${S.own.done} handled · ${need.length} need you</div>
<div class="tabs">${['Needs you','Handled','Paid'].map(t=>`<button class="${t==tab?'on':''}" onclick="go('queue',{tab:'${t}'})">${t}</button>`).join('')}</div>${list}`};
V.case=()=>{
 const hd=`<div class="bar">${BK(S.p.from||'queue')}<span class="chip">Operator</span></div>`;
 const live=S.caseMap&&S.caseMap[S.p.id];
 if(live){const a=live.payload||{},d=live.decision||{};return`${hd}<div class="mu">${live.type=='payout'?'Payout request':'Review'}</div><h1 style="margin:6px 0 4px">${a.amount?mm(a.amount):'Case review'}</h1><div class="mu" style="margin-bottom:18px">Trader ···${live.wallet.slice(-4)} · ${live.status}</div>${AI(d.by||'Berry policy gate',d.reason||'This case needs an owner decision.')}<div style="margin-top:8px">${R('Wallet',a.requestedWallet||live.wallet)+R('Account balance',a.challenge?mm(a.challenge.balance):'—')+R('Open positions',a.challenge?a.challenge.openPositions:'—')+R('Daily cap left',a.caps?mm(Math.max(0,a.caps.payoutCap-a.caps.paidToday)):'—')}</div><div style="display:grid;gap:10px;margin-top:22px"><button class="btn" onclick="BerryAPI.resolveCase('${live.id}','approve','Approved by owner')">Approve</button><button class="btn g" onclick="BerryAPI.resolveCase('${live.id}','reject','Rejected by owner')">Reject</button><button class="btn g" onclick="BerryAPI.resolveCase('${live.id}','escalate','More information needed')">Keep in queue</button></div>`}
 if(S.p.id=='breach')return`${hd}<div class="pf" style="margin:4px 0 18px">${AVI(1,'l')}<div><div class="mu">Breach appeal</div><h1 style="margin:2px 0 2px">Riley Chen</h1><div class="mu">$10K Challenge · failed at 14:21 UTC</div></div></div>
${AI('One price looks wrong','One BTC price was 2.6% below every other feed. Without it the loss stays inside the limit.')}
<div style="margin-top:6px">${R('Price used','$57,410')+R('Other feeds','$58,940')+R('Loss with that price','<span class="rd">−$512</span>')+R('Loss without it','−$436')}</div>${chips(['Feed log','Trade #11','Rules v1'])}
<div style="display:grid;gap:10px;margin-top:22px"><button class="btn g" onclick="decide('breach','Uphold the breach?','The challenge stays failed. The trader can start a new one.','Uphold breach')">Uphold breach</button><button class="btn g" onclick="decide('breach','Reverse the breach?','The challenge returns to Active and trading resumes.','Reverse breach')">Reverse: bad price</button><button class="btn g" onclick="toast('Asked the trader for more data','info')">Ask for more data</button></div>
<div class="mu sm ctr" style="margin-top:14px">The trader's payout stays held until you decide.</div>`;
 return`${hd}<div class="mu">Payout request</div><h1 style="margin:6px 0 4px">$4.80</h1><div class="mu" style="margin-bottom:18px">Trader ···e3b2 · $10K Funded account</div>
${AI('The wallet changed after approval','Rules v1 approved this payout at 20:41 UTC. The wallet changed at 20:52 UTC, which voids that approval.')}
<div style="margin-top:6px">${R('Approved by','Rules v1 · 20:41 UTC')+R('Wallet changed','20:52 UTC')+R('Amount','$4.80','cap $'+f2(BERRY.cap))}</div>${chips(['Wallet log','Rules v1'])}
<div style="display:grid;gap:10px;margin-top:22px"><button class="btn" onclick="approveSheet()">Approve</button><button class="btn g" onclick="decide('wallet','Reject this payout?','The trader is told why and can ask for a person to review.','Reject')">Reject</button><button class="btn g" onclick="toast('Asked the trader to confirm the wallet','info')">Ask for info</button></div>`};
const decide=(id,t,s,b)=>sheet(`<div class="t2">${t}</div><div class="mu">${s}</div><button class="btn" style="margin-top:20px" onclick="resolve('${id}','${b}')">${b}</button><button class="lk" onclick="shut()">Cancel</button>`);
const approveSheet=()=>{
 const q=S.pool,av=q.inp-q.res-q.snd,pt=biz('Today').pay,cap=S.cfg.lim.pay,ok=av>=4.8&&pt+4.8<=cap;
 sheet(`<div class="t2">Approve $4.80</div><div class="mu">The money is set aside for this payout only.</div><div style="margin-top:10px">${R('Available now',mm(av))+R('Available after',av>=4.8?mm(av-4.8):'Not enough funds')+R('Paid out today',mm(pt)+' of '+m0(cap))}</div><button class="btn" style="margin-top:20px" ${ok?'':'disabled'} onclick="resolve('wallet','Approved')">Approve</button>${ok?'':`<div class="am sm ctr" style="margin-top:10px">${av<4.8?'Add funds to the pool first.':'This would pass today\'s payout cap. Raise it in Rules.'}</div>`}`)};
const RT={Approved:'Payout approved',Reject:'Payout rejected','Uphold breach':'Breach upheld','Reverse breach':'Breach reversed'};
const resolve=(id,b)=>{if(BerryAPI.online&&S.caseMap&&S.caseMap[id])return BerryAPI.resolveCase(id,b=='Approved'?'approve':'reject',b);const to=S.p.from||'queue';S.own.need=S.own.need.filter(x=>x!=id);S.own.done++;S.own.min+=2;if(b=='Approved')S.pool.res=+(S.pool.res+4.8).toFixed(2);go(to);toast(RT[b]||b)};
/* ---- Accounts ---- */
S.af='All';
const ACC=[['4a1c',10000,'Funded',10006,'Active'],['9d70',25000,'Challenge',26120,'Active'],['2b8f',10000,'Challenge',11020,'Passed'],['e3b2',10000,'Funded',10006,'Payout held'],['c91e',5000,'Funded',5004,'Paid'],['7f2a',50000,'Challenge',47520,'Near limit'],['d5f0',10000,'Challenge',9488,'Failed']];
const AST={Active:'gn','Payout in review':'am',Passed:'gn',Paid:'gn','Near limit':'am','Payout held':'am',Failed:'rd'};
const accs=()=>{if(S.accounts)return S.accounts;const F=S.stage=='funded';return[['you',START,F?'Funded':'Challenge',eq(),F&&S.pay!='idle'&&S.pay!='paid'?'Payout in review':dayLeft()<DAILY*.2?'Near limit':'Active'],...ACC]};
const FLAG=['Near limit','Payout held','Failed','Payout in review'];
const accf=()=>accs().filter(a=>S.af=='All'||a[2]==S.af||S.af=='Flagged'&&FLAG.includes(a[4]));
const aname=a=>{if(a[0]=='you')return BERRY.user.name+' (you)';const id=String(a[0]||'');return'Trader ···'+(id.length>12?id.slice(-8):id)};
const arow=a=>`<button class="r" style="min-height:68px" onclick="acct('${a[0]}')">${AVI(a[0]=='you'?0:avId(a[0]),'s')}<span class="nm">${aname(a)}<small>$${a[1]/1000}K ${a[2]}</small></span><b class="v">${mm(a[3])}<small class="${AST[a[4]]}"><i class="sd ${AST[a[4]]}"></i>${a[4]}</small></b></button>`;
const afilt=f=>{S.af=f;draw()};
V.accts=()=>`${ohd('Accounts')}<div class="mu" style="margin:-8px 0 14px">${accs().length} ${accs().length==1?'account':'accounts'}</div>
<div class="pills" style="margin-top:0">${AF().map(f=>`<button class="${f==S.af?'on':''}" onclick="afilt('${f}')">${f}</button>`).join('')}</div>
<div style="margin-top:8px">${accf().length?accf().map(arow).join(''):EMP('No accounts here','Try another filter.')}</div>`;
const AF=()=>['All','Challenge','Funded','Flagged'];
const acct=id=>{const a=accs().find(x=>x[0]==id);if(!a)return;sheet(`<div class="pf" style="margin:2px 0 6px">${AVI(a[0]=='you'?0:avId(a[0]),'l')}<div><div class="t2" style="margin:0">${aname(a)}</div><div class="mu">$${a[1]/1000}K ${a[2]}</div></div></div><div>${R('Status',TG(AST[a[4]]||'mu',a[4],0))+R('Equity',mm(a[3]))+R('Profit or loss',`<span class="${a[3]<a[1]?'rd':'gn'}">${sg(a[3]-a[1])}</span>`)+R('Rules','v1')}</div>${a[4]=='Payout held'?`<button class="btn" style="margin-top:18px" onclick="go('case',{id:'wallet',from:'accts'})">Open case</button>`:`<button class="btn g" style="margin-top:18px" onclick="shut();toast('Trading paused for this account','info')">Pause trading</button>`}`)};
/* ---- Rules: limits, then live switches for sizes and markets ---- */
const swr=(on,f,k,s)=>`<button class="r" style="min-height:64px" role="switch" aria-checked="${on}" onclick="${f}"><span class="k" style="color:var(--tx)">${k}${s?`<span class="mu sm" style="display:block">${s}</span>`:''}</span><span class="sw" aria-hidden="true"></span></button>`;
const limStep=(k,s,key,d)=>`<div class="r" style="min-height:76px"><span class="k" style="color:var(--tx)">${k}<span class="mu sm" style="display:block">${s}</span></span><span class="stp"><b>${m0(S.cfg.lim[key])}</b><button aria-label="Lower ${k}" onclick="limSet('${key}',-${d})">${I('minus',18)}</button><button aria-label="Raise ${k}" onclick="limSet('${key}',${d})">${I('plus',18)}</button></span></div>`;
const limSet=(k,d)=>{const l=S.cfg.lim;l[k]=Math.max(Math.abs(d),l[k]+d);draw();if(BerryAPI.online)BerryAPI.updateRules(k=='pay'?{payoutCap:l[k]}:{aiCap:l[k]})};
const tgHalt=()=>{S.cfg.halt=S.cfg.halt?0:1;draw();if(BerryAPI.online)BerryAPI.updateRules({paused:Boolean(S.cfg.halt)});toast(S.cfg.halt?'Business paused':'Business resumed',S.cfg.halt?'warn':'ok')};
const tgSize=n=>{const c=S.cfg.sz;if(c[n]!==0&&SIZES.filter(s=>c[s]!==0).length<2)return toast('Keep at least one size on','warn');c[n]=c[n]===0?1:0;draw();if(BerryAPI.online)BerryAPI.updateRules({sizes:Object.fromEntries(Object.entries(c).map(([k,v])=>[k,Boolean(v)]))})};
const tgMk=k=>{const c=S.cfg.mk;if(c[k]!==0&&Object.keys(MK).filter(x=>c[x]!==0).length<2)return toast('Keep at least one market on','warn');c[k]=c[k]===0?1:0;draw();if(BerryAPI.online)BerryAPI.updateRules({markets:Object.fromEntries(Object.entries(c).map(([x,v])=>[x,Boolean(v)]))})};
V.orules=()=>`${ohd('Rules','Version 1 · live')}<div class="mu sm" style="margin:-4px 0 12px">Switches change what traders can choose, right away. Fixed terms need a new version.</div>
${two(`<div class="sec">Limits</div>${swr(!S.cfg.halt,'tgHalt()','Business is running','Turn off to pause new challenges and payouts')}${limStep('Daily payout cap','Berry AI stops approving above it','pay',10)}${limStep('Daily AI spend cap','Berry AI stops spending above it','ai',1)}
<div class="sec">Account sizes</div>${SIZES.map(n=>swr(S.cfg.sz[n]!==0,`tgSize(${n})`,m0(n)+' account','Target '+m0(n*.1)+' · Daily loss '+m0(n*.05)+(BERRY.fees[n]?' · Fee '+mm(BERRY.fees[n]):''))).join('')}
<div class="sec">Fixed in Rules v1</div>${R('Profit target','10% of the account')+R('Daily loss limit','5% · from UTC day start')+R('Max loss','10% below the start')+R('Trading days','3 with a trade')+R('Costs','5 bps fee · 2 bps slippage')+R('Max exposure','2× equity')+R('Payout',PAYT())}
<div class="mu sm" style="margin-top:14px">Traders already in a challenge keep the rules they accepted.</div>`,`<div class="sec">Markets<span class="tg mu">${Object.keys(MK).filter(k=>S.cfg.mk[k]!==0).length} of ${Object.keys(MK).length} on</span></div>
${CATS.map(c=>`<div class="mu sm" style="margin:14px 0 0;font-weight:700">${c}</div>${Object.keys(MK).filter(k=>MK[k].c==c).map(k=>swr(S.cfg.mk[k]!==0,`tgMk('${k}')`,MK[k].s,MK[k].n)).join('')}`).join('')}`,'e')}`;
