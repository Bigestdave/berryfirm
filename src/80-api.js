/* ---------- Server adapter ----------
   The UI remains intentionally lightweight; this adapter is the only browser
   entry point for state-changing actions when BERRY.api is enabled. */
const BerryAPI=(()=>{
 let online=false,loading=false;
 const fail=e=>{console.warn('Berry API',e);const message=String(e?.message||'');const copy=/ai api key|berry ai.*key/i.test(message)?'Add the AI key and restart.':/treasury.*insufficient|insufficient.*usdc/i.test(message)?'Treasury needs funding.':/paused/i.test(message)?'Payouts are paused.':/already have an active|account already active/i.test(message)?'Account already active. Resume it.':/failed to fetch|network|fetch|connection|reach/i.test(message)?'Server unavailable. Refresh.':'Couldn’t complete that. Try again.';toast(copy,'err')};
 const call=async(path,o={})=>{
  const r=await fetch(path,{credentials:'same-origin',headers:{'content-type':'application/json',...(o.headers||{})},...o});
  const x=await r.json().catch(()=>({}));if(!r.ok)throw new Error(x.error||'Request failed');return x
 };
 const agoAt=at=>Math.max(0,(Date.now()-new Date(at).getTime())/36e5);
 const payState=s=>({requested:'review',approved:'approved',sending:'sending',paid:'paid',rejected:'rejected',escalated:'escalated'})[s]||'idle';
 const setBusiness=(key,b)=>{S.business=S.business||{};S.business[key]={per:key,sold:b.sold,bySize:b.bySize||{},statuses:b.statuses||{},sales:b.sales,pay:b.payouts.amount,np:b.payouts.count,ai:b.ai,host:b.hosting,cost:b.costs,net:b.net,keep:b.sales?b.net/b.sales:0};S.trends=S.trends||{};S.trends[key]=b.series};
 const applyMe=me=>{
  S.preview=false;S.aiReady=!!me.aiReady;BERRY.user.name=me.user.wallet;BERRY.user.role=me.user.role;BERRY.share=me.settings.revenueShare;BERRY.cap=me.settings.accountPayoutCap;BERRY.fees=me.settings.challengeFees;BERRY.treasury=me.treasury||'';S.rail=me.rail||'mock';S.settlementNetwork=me.settlementNetwork||'Treasury rail';
  S.cfg={halt:me.settings.paused?1:0,lim:{pay:me.settings.payoutCap,ai:me.settings.aiCap},sz:Object.fromEntries(Object.entries(me.settings.sizes).map(([k,v])=>[k,v?1:0])),mk:Object.fromEntries(Object.entries(me.settings.markets).map(([k,v])=>[k,v?1:0]))};
  Object.entries(me.prices||{}).forEach(([k,v])=>{if(MK[k])MK[k].p=Number(v)});
  S.pool=me.pool||{inp:0,res:0,snd:0,paid:[]};
  const c=me.challenge;
  if(!c){Object.assign(S,{challengeId:null,stage:'none',bal:0,rl:0,days:0,pos:[],ord:[],pay:'idle',amt:0,net:0,t:{}});return}
  setSize(Number(c.size));
  S.challengeId=c.id;S.stage=c.status==='active'?'challenge':c.status;
  S.bal=Number(c.balance);S.rl=Number(c.realised_loss);S.days=Number(c.trading_days);
  S.pos=(c.positions||[]).map(p=>({id:p.id,m:p.market,side:p.side,z:Number(p.size),e:Number(p.entry_price),sl:p.stop_loss==null?null:Number(p.stop_loss),tp:p.take_profit==null?null:Number(p.take_profit)}));
  S.ord=(c.orders||[]).filter(p=>p.status==='closed').map(p=>[p.side==='Buy'?'Sell':'Buy',Number(p.size),Number(p.close_price||p.entry_price),new Date(p.closed_at||p.opened_at).toLocaleString(),p.market]);
  const p=me.payout;S.pay=p?payState(p.status):'idle';S.amt=p?Number(p.amount):0;S.net=S.amt;S.t=p?{req:p.created_at,ok:p.updated_at,paid:p.status==='paid'?p.updated_at:''}:{};S.apiPayout=p||null;S.apiDecision=p?{by:p.decision_by,reason:p.reason}:null;
 };
 const refresh=async({render=true,ops=true}={})=>{
  const me=await call('/api/me');applyMe(me);
  if(ops&&me.user.role==='owner'){
   const [today,week,all,rows,cases,accounts]=await Promise.all([
    call('/api/ops/business?per=today'),call('/api/ops/business?per=7d'),call('/api/ops/business?per=all'),call('/api/ledger'),call('/api/ops/cases'),call('/api/ops/accounts')
   ]);
   setBusiness('Today',today);setBusiness('7D',week);setBusiness('All',all);
   S.ledger=rows.map(x=>[x.type==='payout'?'pay':x.type,x.label,x.detail,x.amount,x.ref||'',agoAt(x.at),x.metadata||{}]);
   S.caseMap=Object.fromEntries(cases.map(x=>[x.id,x]));S.own={need:cases.map(x=>x.id),done:Math.max(0,all.decisions-cases.length),min:0};
   S.accounts=accounts.map(x=>[x.id,x.size,x.status==='funded'?'Funded':'Challenge',x.balance,x.status==='failed'?'Failed':x.status==='passed'?'Passed':x.status==='funded'?'Active':'Active']);
  }else{S.ledger=(await call('/api/ledger')).map(x=>[x.type==='payout'?'pay':x.type,x.label,x.detail,x.amount,x.ref||'',agoAt(x.at),x.metadata||{}])}
  if(render)draw();return me
 };
 const perform=async(fn)=>{try{return await fn()}catch(e){fail(e);return null}};
 const api={
  get online(){return online&&!S.preview},
  get required(){return BERRY.api!==false&&!S.preview},
  async init(){
   if(BERRY.api===false||location.protocol==='file:')return;
   if(loading)return;loading=true;
   try{await call('/api/auth/session',{method:'POST'});online=true;await refresh({render:true})}
   catch(e){online=false;console.warn('Berry API unavailable.',e);if(BERRY.api!==false)toast('Server unavailable. Refresh.','err')}finally{loading=false}
  },
  refresh,
  createChallenge:size=>perform(async()=>{const result=await call('/api/challenges',{method:'POST',body:JSON.stringify({size})});await refresh({render:false});go('home');toast(result.reused?'Account resumed':'Free test account started')}),
  order:input=>perform(async()=>{await call('/api/orders',{method:'POST',body:JSON.stringify(input)});await refresh({render:false});go('trade');toast('Order filled at the server price')}),
  updatePosition:(id,stopLoss)=>perform(async()=>{await call('/api/positions/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({stopLoss})});await refresh({render:false});shut();draw();toast('Stop loss updated')}),
  closePosition:(id,fraction)=>perform(async()=>{const r=await call('/api/positions/'+encodeURIComponent(id)+'/close',{method:'POST',body:JSON.stringify({fraction})});await refresh({render:false});shut();draw();toast((fraction>=.999?'Closed':'Partly closed')+' position · '+sg(r.pnl))}),
  fund:id=>perform(async()=>{await call('/api/challenges/'+encodeURIComponent(id)+'/fund',{method:'POST'});await refresh({render:false});go('home');toast('Funded account started')}),
  requestPayout:wallet=>perform(async()=>{const r=await call('/api/payouts',{method:'POST',body:JSON.stringify({wallet})});await refresh({render:false});S.apiDecision=r.decision;go('payout');toast(r.payout.status==='approved'?'Payout approved':r.payout.reason||'Payout needs review',r.payout.status==='approved'?'ok':'warn')}),
  reviewPayout:id=>perform(async()=>{const r=await call('/api/payouts/'+encodeURIComponent(id)+'/review',{method:'POST'});await refresh({render:false});S.apiDecision=r.decision;go('payout');toast(r.payout.status==='approved'?'Berry AI approved payout':'Payout needs review',r.payout.status==='approved'?'ok':'warn')}),
  confirmPayout:id=>perform(async()=>{await call('/api/payouts/'+encodeURIComponent(id)+'/confirm',{method:'POST'});await refresh({render:false});draw();toast(S.rail==='testnet'?'Testnet payout settled':'Payout settled')}),
  appeal:message=>perform(async()=>{await call('/api/appeals',{method:'POST',body:JSON.stringify({message})});S.appeal=1;draw();toast('Appeal sent to the owner queue')}),
  updateRules:patch=>perform(async()=>{await call('/api/ops/rules',{method:'PATCH',body:JSON.stringify(patch)});await refresh();}),
  resolveCase:(id,action,reason)=>perform(async()=>{await call('/api/ops/cases/'+encodeURIComponent(id)+'/resolve',{method:'POST',body:JSON.stringify({action,reason})});await refresh({render:false});go('queue');toast('Case updated')}),
  seed:()=>perform(async()=>{await call('/api/demo/seed',{method:'POST'});await refresh({render:false});go('home');toast('Free demo account ready')})
 };
 window.BerryAPI=api;return api;
})();
