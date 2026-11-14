/* ---------- Challenge passed ---------- */
const CALC=()=>({
 target:['Profit target',[['Net profit, after costs','$'+f2(1020*K())],['Target','$'+f2(START*.1)],['Result','Met']]],
 days:['Trading days',[['Fri 6 Nov','2 trades'],['Sat 7 Nov','1 trade'],['Sun 8 Nov','1 trade'],['Result','3 of 3 days']]],
 limits:['Loss limits',[['Worst day','−'+m0(212*K())+' of '+m0(DAILY)],['Lowest equity',m0(START*.974)+' (floor '+m0(FLOOR)+')'],['Result','Never reached']]],
 closed:['Positions closed',[['Open positions','None'],['Result','Ready']]]
});
const calc=k=>{const[t,rs]=CALC()[k];sheet(`<div class="t2">${t}</div><div class="mu">How Rules v1 worked it out.</div><div style="margin-top:10px">${rs.map(x=>R(x[0],x[1])).join('')}</div>`)};
const startFunded=()=>{if(serverNeeded())return;if(BerryAPI.online&&S.challengeId)return BerryAPI.fund(S.challengeId);PRE.funded();go('home');toast('Funded account started')};
V.passed=()=>`${hdr()}<div class="mid"><div class="ring"><span class="art i-chk" role="img" aria-label="Challenge passed" style="width:112px;height:112px"></span>${SPK([[10,18,16,0],[84,10,20,.9],[92,62,11,1.8],[4,72,12,2.6]])}</div><h1>Challenge passed</h1><div class="big gn">+${m0(1020*K())}</div></div>
<div class="tight" style="margin-top:18px">${[['Profit target','target'],['Trading days','days'],['Loss limits','limits'],['Positions closed','closed']].map(([a,k])=>R(a,ck,'',`calc('${k}')`)).join('')}</div>
<div class="card col" style="margin-top:18px"><b>What happens next</b>
<div class="r" style="min-height:50px;border:0">${I('layers',22,'bl')}<span>A new ${m0(START)} funded account starts</span></div>
<div class="r" style="min-height:50px;border:0">${I('lock',22,'bl')}<span>Challenge profit does not carry over</span></div>
<div class="r" style="min-height:50px;border:0">${I('shield',22,'bl')}<span>Passing never authorizes a payout</span></div></div>`;
D.passed=()=>({h:`<button class="btn" onclick="startFunded()">Start funded account</button>`});
/* ---------- Challenge failed ---------- */
const askPerson=()=>{if(serverNeeded())return;if(BerryAPI.online)return BerryAPI.appeal('Challenge review requested');S.appeal=1;draw();toast('Review requested')};
V.failed=()=>`${hdr(1)}<div style="position:relative"><span class="art i-arr" role="img" aria-label="Failed" style="position:absolute;right:-8px;top:-6px;width:96px;height:96px"></span><div class="mu">${SZ()} Challenge</div><h1 style="margin:4px 0 14px">Challenge failed</h1></div>
<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px"><div><div class="big rd">−${m0(512*K())}</div><div class="mu" style="margin-top:8px">lost today · limit ${m0(DAILY)}</div></div>${TG('rd','Trading paused')}</div>
<div class="tight" style="margin-top:12px">${R('Max daily loss',m0(DAILY))+R('Reached at','14:21 UTC')}</div>
<div class="mu sm" style="margin:10px 0 18px">Recovering equity afterwards does not undo a breach.</div>
${AI('One price looks wrong',`One BTC price was 2.6% below other feeds. Without it your loss was −${m0(436*K())}, inside your limit.`)}
<div class="tight" style="margin-top:4px">${R('Loss with that price',`<span class="rd">−${m0(512*K())}</span>`)+R('Loss without it','−'+m0(436*K()))}</div>
${S.appeal?`<div class="card" style="margin-top:16px">${I('clock',24,'am')}<div><b>Waiting for the Berry team</b><div class="mu">A person is reviewing your account. You'll hear back here.</div></div></div>`:`<button class="lk" style="margin-top:12px" onclick="go('start')">Start a new challenge</button>`}`;
D.failed=()=>({h:S.appeal?`<button class="btn g" onclick="go('start')">Start a new challenge</button>`:`<button class="btn" onclick="askPerson()">Ask for a person to review</button>`});
/* ---------- Payouts tab ---------- */
const TXH='8mWcR3kT9xQv2LdJp7yNf5ZsA1bHuE4tYe',TXS=TXH.slice(0,4)+'…'+TXH.slice(-4);
const poolBan=f=>`<button class="ban" onclick="go('pool',{from:'${f}'})">${COINB}<span><b>Payout pool</b><small>See what's in it and what was paid.</small></span><span class="ch">${I('chev',20)}</span></button>`;
V.pay=()=>{
 const F=S.stage=='funded',pr=Math.max(0,eq()-START),capd=pr*BERRY.share>BERRY.cap;
 if(!F)return`${hdr(1)}<h1>Payouts</h1>${two(`<div class="card"><span class="art i-lock" role="img" aria-label="Locked" style="width:72px;height:72px"></span><div><b>Locked</b><div class="mu">Pass the challenge and start a funded account to unlock payouts.</div></div></div>`,`<div class="sec">How payouts work</div>${R('Your share',PCT()+' of eligible profit')+R('Cap',CAPM()+' per account')+R('Payouts','One per funded account')+R('Paid','Only after settlement is confirmed')}${poolBan('pay')}`)}`;
 const act=S.pay!='idle'&&S.pay!='paid';
 return`${hdr(1)}${two(`<div class="mu sm">${SZ()} Funded account</div><div class="mu sm" style="margin-top:14px">Estimated payout</div><div class="big" style="margin:8px 0 6px">${h(S.pay=='paid'?0:S.pay=='idle'?est():S.amt)}</div><div class="mu">${S.pay=='paid'?'Payout complete · one per funded account':capd?'Capped at $'+f2(BERRY.cap):`${PCT()} of ${mm(pr)} profit`}</div>
<div class="two"><div class="card col"><div class="mu sm">Paid</div><b>${S.pay=='paid'?'$'+f2(S.net):'$0'}</b></div><div class="card col"><div class="mu sm">Max per payout</div><b>${CAPM()}</b></div></div>`,`${act?`<button class="ban" style="margin-top:16px" onclick="go('payout')">${TG(({approved:'gn',paid:'gn',rejected:'rd'}[S.pay]||'am'),({sending:'Sending',approved:'Approved',paid:'Paid',rejected:'Declined',escalated:'Needs review'}[S.pay]||'In review'))}<span><b>Payout request</b><small>${mm(S.amt)} · tap to view</small></span><span class="ch">${I('chev',20)}</span></button>`:''}
<div class="sec">History<button onclick="go('pool',{from:'pay'})">Payout pool</button></div>
${S.pay=='paid'?R('Payout · today',`<span class="gn">$${f2(S.net)}</span>`,'Paid',"go('payout')"):`<div class="mu" style="padding:18px 0">No payouts yet.</div>`}`)}`};
D.pay=()=>S.stage!='funded'?null:S.pay=='idle'?{h:`<button class="btn" onclick="reqSheet()">Request payout</button>`}:{h:`<button class="btn ${S.pay=='paid'?'g':''}" onclick="go('payout')">${S.pay=='paid'?'View receipt':'View request'}</button>`};
/* ---------- Payout request flow ---------- */
const reqSheet=()=>{
 if(S.stage!='funded')return go('pay');
 if(S.cfg.halt)return sheet(`<div class="t2">Payouts are paused</div><div class="mu">New payout requests are on hold. You can request again once payouts resume.</div>`);
 if(S.pos.length)return sheet(`<div class="t2">Close your trades first</div><div class="mu">A payout request needs every position closed. Trading pauses once you request.</div><button class="btn" style="margin-top:20px" onclick="shut();manage(0)">Manage trade</button>`);
 if(est()<=0)return sheet(`<div class="t2">No profit to pay out yet</div><div class="mu">Your funded account needs profit before you can request a payout.</div>`);
 sheet(`<div class="t2">Request payout</div><div class="big" style="margin:12px 0 6px">${h(est())}</div><div class="mu">Estimate. Rules v1 sets the final amount.</div><div style="margin-top:12px">${R('Trading','Pauses until it is paid')+R('Payouts','One per funded account')}</div><button class="btn" style="margin-top:18px" onclick="startPay()">Request payout</button>`)};
const runReview=()=>{S.chk=0;[1,2,3,4].forEach(i=>later(i*750,()=>{S.chk=i;if(S.v=='payout')draw()}));later(4100,approve)};
const startPay=()=>{if(serverNeeded())return;if(BerryAPI.online)return BerryAPI.requestPayout(BERRY.user.name);clr();S.pdis=0;S.pay='review';S.amt=+est().toFixed(2);S.net=+(S.amt-.02).toFixed(2);S.t={req:hm()};S.q=60;go('payout');runReview()};
const approve=()=>{if(S.pay!='review')return;S.pay='approved';S.t.ok=hm();S.pool.res=S.amt;S.q=60;if(S.v=='payout')draw()};
const confirmPay=()=>{if(serverNeeded())return;if(BerryAPI.online&&S.apiPayout)return BerryAPI.confirmPayout(S.apiPayout.id);S.pay='sending';S.t.cf=hm();S.t.snd=hm();S.pool.res=0;S.pool.snd=S.amt;draw();later(2800,settle)};
const settle=()=>{if(S.pay!='sending')return;S.pay='paid';S.t.paid=hm();S.pool.snd=0;S.pool.inp=+(S.pool.inp-S.amt).toFixed(2);S.pool.paid.unshift(['b3e1',S.net,TXS,'just now']);if(S.v=='payout')draw();toast('Demo payout recorded','info')};
const copyRef=()=>copyTxt(S.apiPayout?.tx_ref||TXH,'Reference copied');
const shareRc=()=>{const reference=S.apiPayout?.tx_ref||TXS,t=`Berry Firm payout: $${f2(S.net)} USDC sent to ${BERRY.user.name} on NEAR. Reference ${reference}`,cp=()=>copyTxt(t,'Receipt copied');if(navigator.share)navigator.share({title:'Berry Firm payout',text:t}).catch(cp);else cp()};
function payTick(){
 if(S.pay!='approved'||S.q<=0||S.qr)return;S.qr=1;
 (function t(){setTimeout(()=>{if(S.pay!='approved'||S.v!='payout'){S.qr=0;return}S.q--;if(S.q<=0){S.qr=0;draw();return}const e=$('#qt');if(e)e.textContent=S.q+'s';t()},1000)})()}
const CHK=['Positions closed','Profit is net of costs','Rules v1 followed','No holds on the account'];
const pend=i=>i==S.chk?'<span class="spin"></span>':'<span style="width:18px;height:18px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--ln2);display:inline-block"></span>';
const payoutText=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reviewCard=()=>{
 const n=S.pay=='review'?S.chk:4,done=n>=4,list=S.pay=='review'?CHK.map((c,i)=>`<div class="r" style="min-height:46px;${i==3?'border-bottom:0':''}"><span class="k" style="color:var(--tx)">${c}</span><b class="v">${i<n?CK(18):pend(i)}</b></div>`).join(''):'';
 const by=S.apiDecision?.by,decider=by==='offline-policy'?'Policy fallback':by==='policy-gate'?'Policy gate':by==='agent-error'?'Berry AI · escalated':by?'Berry AI':'Rules v1 · automatic';
 const summary=done?(S.apiDecision?.reason||'Checked 4 items. Everything matches Rules v1.'):'Checking your closed trades against Rules v1…';
 return`<div class="card col" style="margin-top:20px">${list}<div style="${list?'border-top:1px solid var(--ln);padding-top:14px;margin-top:2px':''}">${AIL}<div class="mu">${payoutText(summary)}</div></div>
${done?`<div class="r" style="margin-top:6px;border-bottom:0"><span class="k">Decided by</span><b class="v">${payoutText(decider)}</b></div>`:''}</div>
${done&&S.pay=='review'?`<button class="lk" onclick="toast('Review requested','info')">Ask for a person to review</button>`:''}`};
const decisionCard=()=>{const retry=S.aiReady&&S.apiPayout?.status==='escalated'&&S.apiPayout?.decision_by==='agent-error',title=retry?'Berry AI unavailable':S.pay==='rejected'?'Payout declined':'Owner review needed',reason=retry?'Could not reach the model. Check the connection and try again.':S.apiDecision?.reason||S.apiPayout?.reason||'The payout needs a closer review.';return`<div class="card col" style="margin-top:20px"><b>${title}</b><div class="mu">${payoutText(reason)}</div>${retry?`<button class="btn g" style="margin-top:12px" onclick="BerryAPI.reviewPayout('${S.apiPayout.id}')">Retry Berry AI review</button>`:`<button class="lk" onclick="go('help')">Ask for a person to review</button>`}</div>`};
const confirmCard=()=>`<div class="card col" style="margin-top:20px"><div class="fl" style="align-items:center"><b>Confirm settlement</b><span class="tg gn">${NET()}</span></div>${R('Asset',USDCN())+R('Network',NET())+R('Payout wallet',BERRY.user.name+' · '+USDCN())+R('Payout',mm(S.amt))+R('Network fee','—')+R('You receive',`<b>$${f2(S.net)}</b>`)+R('Quote',S.q>0?`<span id="qt">${S.q}s</span>`:'<span class="am">Expired</span>')}</div>`;
const receipt=()=>{const e=S.apiPayout?.evidence||{},x=e.economics||{},settle=e.settlement||{},decision=e.decision||{},usage=decision.usage||{},policyFallback=['offline-policy','policy-gate'].includes(decision.by),action=({approve_payout:'Approved',reject_payout:'Declined',escalate:'Escalated'})[decision.tool]||decision.tool,cost=policyFallback?'No model call':`$${Number(decision.cost||0).toFixed(6)}`,usageNote=decision.usage?`${usage.inputTokens??'?'} in · ${usage.outputTokens??'?'} out${usage.estimated?' · estimated':' · metered'}`:decision.by==='agent-error'?'No usage returned':'Usage unavailable',delta=settle.balanceDelta,proof=(x.grossProfit!=null?R('Eligible profit',mm(x.grossProfit))+R('Trader share',`${Math.round((x.traderShareRate||0)*100)}% · ${mm(x.traderShare)}`)+R('Retained by Berry Firm',mm(x.treasuryRetained)): '')+(decision.policyResult?R('Policy gate',decision.policyResult==='passed'?'Passed':'Review required'):'')+(decision.by?R(policyFallback?'Inference cost':'AI inference cost',cost,usageNote):'')+(settle.balanceBefore!=null&&settle.balanceAfter!=null?R('Treasury balance',`${mm(settle.balanceBefore)} → ${mm(settle.balanceAfter)}`,delta==null?'':'−'+mm(Math.abs(delta))+' on settlement'):'')+(settle.explorerUrl?`<a class="txlink" href="${h(settle.explorerUrl)}" target="_blank" rel="noopener noreferrer">Verify on NEAR testnet ↗</a>`:'');return`<div class="rcpt"><div class="in2">${SPK([[74,20,14,0],[90,28,18,1],[82,37,10,2.1]])}<div class="fl" style="align-items:center"><span style="display:flex;align-items:center;gap:12px"><span class="art i-coinf" aria-hidden="true" style="width:52px;height:52px"></span><b style="font-size:22px">Payout paid</b></span>${TG('gn','Settled')}</div>
<div class="big gn" style="margin:18px 0 10px">${h(S.net)}<span class="mu" style="font-size:18px;letter-spacing:0"> ${USDCN()}</span></div>${R('To',BERRY.user.name)+R('Network',NET())+R('Reference',S.apiPayout?.tx_ref||TXS)+R('Paid',S.t.paid||'')+R('Decided by',decision.by||S.apiDecision?.by||'Berry policy gate')+(decision.tool?R(policyFallback?'Policy decision':'AI decision',action,decision.reason||''):'')+proof}</div>
<div class="ft"><span class="lock">${LG(26)}<span class="wm" style="font-size:20px">berry firm</span></span><small>Payouts from a funded pool</small></div></div>
<div class="two" style="margin-top:14px"><button class="btn g" onclick="shareRc()">Share</button><button class="btn g" onclick="copyRef()">Copy reference</button></div>`};
V.payout=()=>{
 const st=S.pay,finalReview=st==='rejected'||st==='escalated',now=finalReview?2:({review:1,approved:3,sending:4,paid:6}[st]??1),tm=finalReview?['req','ok','ok']:['req','req','ok','cf','snd','paid'],lab=st==='rejected'?['Requested','Reviewed','Declined']:st==='escalated'?['Requested','Reviewed','Needs review']:['Requested','In review','Approved','Confirm payout','Sending','Paid'];
 const tl=lab.map((l,i)=>`<div class="s ${i<now?'done':i==now?'now':''}"><span class="dot">${i<now?I('check',11):i==now?I('clock',11):''}</span><b>${l}</b><small>${i<now?(S.t[tm[i]]||''):i==now?'Now':''}</small></div>`).join('');
 const tag={review:['am','In review'],approved:['gn','Approved'],sending:['am','Sending'],paid:['gn','Paid'],rejected:['rd','Declined'],escalated:['am','Needs review']}[st]||['am','In review'];
 const sendingCopy=S.apiPayout?.settlement_state==='unknown'?'Transfer status unclear. Check the treasury before retrying.':S.apiPayout?.settlement_state==='awaiting_approval'?'Treasury approval pending in OutLayer. Do not retry.':'Payment is being confirmed. Do not request again.';
 const head=st=='paid'?'':`<div class="fl" style="align-items:center"><span class="mu">Estimated payout</span>${TG(tag[0],tag[1])}</div><div class="big" style="margin:8px 0 0">${h(S.amt)}</div>`;
 const rerun=S.aiReady&&S.apiPayout?.status==='approved'&&S.apiPayout?.decision_by==='offline-policy'?`<button class="btn g" style="margin-top:20px" onclick="BerryAPI.reviewPayout('${S.apiPayout.id}')">Run Berry AI review</button>`:'';
 const main=st=='review'?reviewCard():st=='approved'?rerun+confirmCard()+reviewCard():finalReview?decisionCard():st=='sending'?`<div class="card" style="margin-top:20px"><span class="spin"></span><div><b>Sending $${f2(S.net)} USDC</b><div class="mu">${sendingCopy}</div></div></div>`:receipt();
 return`<div class="bar">${BK('pay')}<b class="ttl">Payout request</b></div>${two(head+main,`<div class="sec" style="margin-top:24px">Progress</div><div class="tl">${tl}</div>`)}`};
D.payout=()=>S.pay=='approved'?{h:S.q>0?`<button class="btn" onclick="confirmPay()">Confirm payout</button>`:`<button class="btn" onclick="S.q=60;draw()">Refresh quote</button>`}:S.pay=='paid'?{h:`<button class="btn" onclick="go('pay')">Done</button>`}:null;
/* ---------- Public payout pool ---------- */
V.pool=()=>{
 const q=S.pool,av=q.inp-q.res-q.snd;
 return`<div class="hero"><span class="art i-coinf" aria-hidden="true"></span><div class="bar">${BK(S.p.from||'pay')}<span class="chip">Public · No login</span></div>
<h1 style="margin:6px 0 8px">Payout pool</h1><div class="mu" style="max-width:230px">Where payouts come from and where they went.</div>
<div class="mu" style="margin-top:22px">In the pool</div><div class="big" style="margin-top:8px">${h(q.inp)}</div></div>
${R('Set aside for approved payouts',mm(q.res))+R('Available',mm(av))+R('Payments in progress',mm(q.snd))}
<div class="sec">Payments sent<span class="mu sm">${q.paid.length}</span></div>
${q.paid.map(x=>`<div class="r" style="min-height:68px">${AVI(avId(x[0]),'s')}<span class="nm">Trader ···${x[0]}<small>${x[2]} · ${x[3]}</small></span><b class="v gn">$${f2(x[1])}<small>Paid</small></b></div>`).join('')}
<div class="mu sm" style="margin-top:18px">Last updated 2 min ago. Today's reserves do not mean every future payout is covered.</div>`};
