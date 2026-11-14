/* ---------- Help ---------- */
const QA=[
 ['Why did my daily limit change?',()=>{const u=Math.max(0,-(S.rl+flt()));return u<.005?`You haven't lost anything today, so all of the ${mm(DAILY)} limit is available.`:`Your open ${S.pos.length==1?MP(S.pos[0]).s+' trade is':'trades are'} down ${mm(u)}, so ${mm(u)} of today's ${mm(DAILY)} limit is used.`},['Trade #6','Rules v1']],
 ['What do I need to pass?',()=>{const pr=eq()-START,tg=START*.1,d=Math.max(0,3-S.days);return S.stage=='funded'||(pr>=tg&&d==0)?'You have met every requirement. Start your funded account.':`${mm(Math.max(0,tg-pr))} more profit${d?` and ${d} more trading day${d>1?'s':''}`:''}.`},['Rules v1','12:04 UTC']],
 ['Where is my payout?',()=>S.pay=='idle'?(S.stage=='funded'?'None requested yet. Request one from Payouts.':'Payouts open once you pass the challenge and start a funded account.'):S.pay=='paid'?`Paid. $${f2(S.net)} was sent to you.near.`:`Your request is ${S.pay=='review'?'in review':S.pay=='approved'?'approved and waiting for you to confirm':'being sent'}.`,['Rules v1']]
];
const ask=i=>{const[q,a,c]=QA[i];sheet(`${AIL}<div class="t2">${q}</div><p class="mu" style="margin:0">${a()}</p>${chips(c)}`)};
const askT=()=>{
 const t=($('#q').value||'').toLowerCase().trim();if(!t)return;
 const i=/(daily|limit|loss|room)/.test(t)?0:/(pass|need|target|days|profit)/.test(t)?1:/(payout|paid|reward|money|wallet)/.test(t)?2:-1;
 if(i>=0)return ask(i);
 sheet(`${AIL}<div class="t2">I can't answer that from your account</div><p class="mu" style="margin:0">Your numbers are still live. I've passed your question to the team.</p><div class="chips"><span class="mu">Status</span><span>Waiting for the Berry team</span></div>`)};
V.help=()=>{
 const reqs=[];
 if(S.appeal)reqs.push(['Challenge review','Waiting for the Berry team','am']);
 if(S.pay!='idle')reqs.push(['Payout request',S.pay=='paid'?'Paid':S.pay=='review'?'In review':S.pay=='approved'?'Approved':'Sending',S.pay=='paid'?'gn':'am']);
 return`${hdr(1)}<h1>Help</h1>${two(`<form class="in" onsubmit="askT();return false">${I('search',20)}<input id="q" placeholder="Ask about your account" autocomplete="off" enterkeyhint="send" aria-label="Ask about your account"><button type="submit" aria-label="Ask">${I('chev',20)}</button></form>
<div class="sec">Try asking</div>${QA.map((q,i)=>R(q[0],'','',`ask(${i})`,1)).join('')}`,`<div class="sec">My requests</div>${reqs.length?reqs.map(r=>R(r[0],TG(r[2],r[1]))).join(''):`<div class="mu" style="padding:16px 0">No open requests.</div>`}
${R('Contact the team','','',"toast('Passed to the team','info')",1)}`)}`};
/* ---------- Profile ---------- */
const how=()=>sheet(`<div class="t2">How reviews work</div><p class="mu" style="margin:6px 0 0">Rules decide.<br>Berry AI explains.<br>A person handles exceptions.</p><p class="mu">Berry AI can't set amounts, change rules, sign payments or trade for you.</p>`);
const demo=k=>{S.preview=true;S.challengeId=null;S.apiPayout=null;S.apiDecision=null;S.rail='mock';S.settlementNetwork='Demo mode';const actions={start:()=>go('start'),active:()=>{PRE.active();go('home')},fresh:()=>{PRE.fresh();go('home')},passed:()=>{PRE.passed();go('passed')},failed:()=>{S.appeal=0;go('failed')},funded:()=>{PRE.funded();go('pay')},locked:()=>{PRE.active();go('pay')},flow:()=>{PRE.funded();startPay()},pool:()=>go('pool',{from:'me'}),ledger:()=>go('ledger',{from:'pool'}),owner:()=>go('owner'),markets:()=>{PRE.active();go('markets')}};actions[k]?.()};
const runDemo=()=>{S.preview=false;if(serverNeeded())return;if(BerryAPI.online)return BerryAPI.seed();PRE.funded();go('pay');toast('Sample payout demo','info')};
V.me=()=>`${hdr()}${two(`<div class="pf">${AVI(0,'l')}<div><h1 style="margin:0">${BERRY.user.name}</h1><div class="mu">${SZ()} ${S.stage=='funded'?'Funded account':'Challenge'}</div></div></div>
${L('file','Rules accepted','v1','rules()')+R('Payout wallet',BERRY.user.name+' · '+USDCN())+L('shield','How reviews work','','how()')+L('help','Help and support','',"go('help')")+(BERRY.user.role==='owner'?L('layers','Operator console','',"go('owner')"): '')}`,BERRY.demo?`<div class="sec">Demo mode</div><div class="mu sm" style="margin:-8px 0 12px">Free test account · no payment.</div><button class="btn" onclick="runDemo()">Run payout demo</button><div class="sec">Sample screens</div><div class="mu sm" style="margin:-8px 0 12px">Local preview data</div><div class="grid">${[['start','Start','Offer and rules'],['active','Active','2 of 3 days done'],['fresh','New','No trades yet'],['passed','Passed','Target met'],['failed','Failed','Limit reached'],['locked','Payouts locked','Before funded'],['funded','Funded','Payout ready'],['flow','Payout flow','Sample only'],['markets','Markets','12 markets'],['pool','Payout pool','Public page'],['ledger','Ledger','Public page'],['owner','Operator','Back office']].map(([k,t,s])=>`<button class="tile" onclick="demo('${k}')">${t}<small>${s}</small></button>`).join('')}</div>`:'')}
<div class="ctr" style="margin:30px 0 6px"><span class="lock" style="justify-content:center">${LG(36)}<span class="wm">berry firm</span></span></div>`;
