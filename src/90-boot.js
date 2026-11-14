/* ---------- Boot: #hash opens a screen directly ----------
   With BERRY.demo on (this preview) every route can load a ready-made state. With it off, only the real screens open
   and nothing is pre-filled: your backend supplies the state. */
const pre=n=>{if(BERRY.demo)PRE[n]()};
const ROUTES={start:()=>go('start'),home:()=>{pre('active');go('home')},markets:()=>{pre('active');go('markets')},trade:()=>{pre('active');go('trade',{m:'BTC'})},order:()=>{pre('active');S.m='BTC';openOrder('Buy')},passed:()=>{pre('passed');go('passed')},failed:()=>go('failed'),payouts:()=>{pre('funded');go('pay')},locked:()=>{pre('active');go('pay')},payout:()=>{pre('funded');startPay()},pool:()=>go('pool'),help:()=>{pre('active');go('help')},profile:()=>go('me'),owner:()=>go('owner'),business:()=>go('owner'),ledger:()=>go('ledger',{from:'owner'}),queue:()=>go('queue'),accounts:()=>go('accts'),rules:()=>go('orules')};
const LIVE=['start','home','markets','payouts','pool','help','profile','owner','business','ledger','queue','accounts','rules'];
const route=first=>{const k=location.hash.slice(1),f=ROUTES[k];if(f&&(BERRY.demo||LIVE.includes(k)))f();else if(first)ROUTES.start()};
addEventListener('hashchange',()=>route());route(1);
if(typeof BerryAPI!='undefined')BerryAPI.init();
