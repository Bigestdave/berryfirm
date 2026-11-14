/* ---------- Account sizes and markets (placeholder prices until a market feed is wired) ---------- */
const SIZES=[5000,10000,25000,50000],CATS=['Crypto','Forex','Metals','Indices','Energy'];
/* p price · cu prefix · dp price decimals · tp level decimals · st stop step · z0 / zs default and step size · sd default stop distance · v, sg chart scale and direction · rs chart seed */
const MK={
 BTC:{n:'Bitcoin',s:'BTC/USD',c:'Crypto',u:'BTC',g:'₿',p:59200,cu:'$',dp:2,tp:0,st:100,z0:.02,zs:.01,sd:700,v:1,sg:1,rs:0},
 ETH:{n:'Ether',s:'ETH/USD',c:'Crypto',u:'ETH',g:'Ξ',p:2480.5,cu:'$',dp:2,tp:0,st:5,z0:.5,zs:.1,sd:40,v:1.4,sg:1,rs:3},
 SOL:{n:'Solana',s:'SOL/USD',c:'Crypto',u:'SOL',g:'S',p:142.3,cu:'$',dp:2,tp:1,st:.5,z0:10,zs:1,sd:3,v:1.9,sg:-1,rs:5},
 XRP:{n:'XRP',s:'XRP/USD',c:'Crypto',u:'XRP',g:'X',p:.524,cu:'$',dp:4,tp:4,st:.005,z0:1000,zs:100,sd:.02,v:.55,sg:-1,rs:8},
 EUR:{n:'Euro / US dollar',s:'EUR/USD',c:'Forex',u:'EUR',g:'€',p:1.084,cu:'',dp:4,tp:4,st:.0005,z0:5000,zs:1000,sd:.004,v:.15,sg:-1,rs:11},
 GBP:{n:'Pound / US dollar',s:'GBP/USD',c:'Forex',u:'GBP',g:'£',p:1.291,cu:'',dp:4,tp:4,st:.0005,z0:5000,zs:1000,sd:.004,v:.12,sg:1,rs:13},
 AUD:{n:'Aussie / US dollar',s:'AUD/USD',c:'Forex',u:'AUD',g:'A$',p:.662,cu:'',dp:4,tp:4,st:.0005,z0:5000,zs:1000,sd:.004,v:.2,sg:1,rs:17},
 XAU:{n:'Gold',s:'XAU/USD',c:'Metals',u:'oz',g:'Au',p:2680.4,cu:'$',dp:2,tp:1,st:1,z0:1,zs:.1,sd:15,v:.6,sg:-1,rs:19},
 XAG:{n:'Silver',s:'XAG/USD',c:'Metals',u:'oz',g:'Ag',p:31.25,cu:'$',dp:3,tp:2,st:.05,z0:50,zs:5,sd:.4,v:1.1,sg:1,rs:23},
 SPX:{n:'US 500',s:'US500',c:'Indices',u:'units',g:'500',p:5830.2,cu:'',dp:1,tp:1,st:1,z0:1,zs:.5,sd:30,v:.45,sg:-1,rs:29},
 NDX:{n:'US Tech 100',s:'NAS100',c:'Indices',u:'units',g:'100',p:20410.5,cu:'',dp:1,tp:1,st:5,z0:.2,zs:.1,sd:100,v:.6,sg:-1,rs:31},
 WTI:{n:'US crude oil',s:'WTI/USD',c:'Energy',u:'bbl',g:'WTI',p:71.4,cu:'$',dp:2,tp:2,st:.1,z0:10,zs:1,sd:1,v:1.3,sg:1,rs:37}
};
const CFG0=()=>({sz:Object.fromEntries(SIZES.map(s=>[s,1])),mk:Object.fromEntries(Object.keys(MK).map(k=>[k,1])),halt:0,lim:{pay:1000,ai:5}});
S.cfg=CFG0();
/* formatting that depends on the market */
const nf=(n,d)=>n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const MP=p=>MK[p.m||'BTC'],held=k=>S.pos.some(p=>(p.m||'BTC')==k),mon=k=>S.cfg.mk[k]!==0||held(k);
const tk=(v,m)=>m.cu+nf(v,m.tp),pf=(v,m)=>m.cu+nf(v,m.dp);
const zf=(z,m)=>(+z.toFixed(4)).toLocaleString('en-US',{maximumFractionDigits:4})+' '+m.u;
const hp=(v,m)=>{const s=nf(Math.abs(v),m.dp),i=m.dp>2?s.indexOf('.')+3:s.indexOf('.');return`${m.cu}${s.slice(0,i)}<span class="dim">${s.slice(i)}</span>`};
const s0f=(m,i)=>m.p+(TFS[i][2]-59200)*(m.p/59200)*m.v*m.sg;
const dchg=k=>{const m=MK[k],o=s0f(m,1),d=m.p-o;return{d,p:d/o*100}};
const dd=(d,m)=>{const a=Math.abs(d);return m.cu+nf(a,a>=10?0:(m.dp>2&&a<1?m.dp:2))};
const chg=k=>{const c=dchg(k);return`<span class="${c.d<0?'rd':'gn'}">${c.d<0?'▼':'▲'} ${Math.abs(c.p).toFixed(1)}%</span>`};
/* ---------- Logos ----------
   Forex pairs show their two flags, drawn here. Crypto keeps its glyph disc, and when BERRY.logos points at a folder
   (see scripts/fetch-logos.mjs) the real logo sits on top of it, so a missing file just leaves the glyph. */
const star=(cx,cy,R,r,n)=>{let d='';for(let i=0;i<2*n;i++){const a=Math.PI*i/n-Math.PI/2,q=i%2?r:R;d+=(i?'L':'M')+(cx+q*Math.cos(a)).toFixed(2)+' '+(cy+q*Math.sin(a)).toFixed(2)}return d+'Z'};
const UJ='<rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#c8102e" stroke-width="2.4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/>';
const FLG={
 us:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#fff"/>${[0,2,4,6,8,10,12].map(i=>`<rect y="${(i*24/13).toFixed(2)}" width="24" height="${(24/13).toFixed(2)}" fill="#b22234"/>`).join('')}<rect width="12.4" height="12.92" fill="#3c3b6e"/>${[0,1,2,3].map(r=>[0,1,2].map(c=>`<circle cx="${(2.4+c*3.8).toFixed(1)}" cy="${(2.2+r*2.9).toFixed(1)}" r=".7" fill="#fff"/>`).join('')).join('')}</svg>`,
 eu:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#039"/>${Array.from({length:12},(_,i)=>{const a=Math.PI*i/6;return`<path d="${star(12+7.2*Math.sin(a),12-7.2*Math.cos(a),1.7,.7,5)}" fill="#fc0"/>`}).join('')}</svg>`,
 gb:`<svg viewBox="15 0 30 30" aria-hidden="true">${UJ}</svg>`,
 au:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#012169"/><svg width="13" height="13" viewBox="15 0 30 30">${UJ}</svg><path d="${star(6,18.2,4.4,1.9,7)}" fill="#fff"/><path d="${star(18.3,4.6,1.9,.8,7)}" fill="#fff"/><path d="${star(14.6,11.2,1.9,.8,7)}" fill="#fff"/><path d="${star(21,9.6,1.9,.8,7)}" fill="#fff"/><path d="${star(18.3,18.6,1.9,.8,7)}" fill="#fff"/><path d="${star(17.8,12.6,1.2,.5,5)}" fill="#fff"/></svg>`
};
const FXP={EUR:['eu','us'],GBP:['gb','us'],AUD:['au','us']};
const mi=(k,s=44,v=0)=>{
 const m=MK[k],g=m.g,p=FXP[k],vf=v?`<span class="vf">${I('check',10)}</span>`:'';
 if(p){const d=Math.round(s*.68);return`<span class="mi fxp k-${k}" style="width:${s}px;height:${s}px" aria-hidden="true"><span class="fg a" style="width:${d}px;height:${d}px">${FLG[p[0]]}</span><span class="fg b" style="width:${d}px;height:${d}px">${FLG[p[1]]}</span>${vf}</span>`}
 const fs=Math.round(s*(g.length>2?.28:g.length>1?.36:.54)),img=BERRY.logos&&m.c=='Crypto'?`<img src="${BERRY.logos}${k.toLowerCase()}.svg" alt="" loading="lazy" onerror="this.remove()">`:'';
 return`<span class="mi k-${k}" style="width:${s}px;height:${s}px;font-size:${fs}px" aria-hidden="true">${g}${img}${vf}</span>`};
/* candlestick chart for one market; BTC at its defaults draws exactly what it always did */
function candles(o={}){
 const km=o.m||S.m,m=MK[km],P=m.p,[,n0,,vb]=TFS[S.tf],VW=o.vw||390,W=VW-68,n=Math.round(n0*W/322),sc=P/59200,s0=s0f(m,S.tf),vol=vb*sc*m.v,H=o.h||280,st=W/n,r=rnd(7+S.tf*13+m.rs),w=[0];
 for(let i=1;i<n;i++)w.push(w[i-1]+(r()-.5)*vol*2.4);
 const c=w.map((v,i)=>s0+(P-s0)*i/(n-1)+v-w[n-1]*i/(n-1));
 const k=c.map((x,i)=>{const a=i?c[i-1]:s0;return{a,x,hi:Math.max(a,x)+r()*vol*.8,lo:Math.min(a,x)-r()*vol*.8}});
 let lo=Math.min(...k.map(q=>q.lo)),hi=Math.max(...k.map(q=>q.hi));
 [o.sl,o.tp].forEach(v=>{if(v!=null){lo=Math.min(lo,v-vol*1.5);hi=Math.max(hi,v+vol*1.5)}});
 const pd=(hi-lo)*.05;lo-=pd;hi+=pd;
 const y=v=>10+(H-30)*(1-(v-lo)/(hi-lo)),nd=s=>{let d=0;while(d<6&&Math.abs(s*10**d-Math.round(s*10**d))>1e-9)d++;return d};
 let g='';
 const raw=(hi-lo)/6,mag=10**Math.floor(Math.log10(raw)),step=[1,2,2.5,5,10].map(x=>x*mag).find(s=>s>=raw),ad=nd(step),tags=[P,o.sl,o.tp].filter(v=>v!=null).map(y);
 for(let v=Math.ceil(lo/step)*step;v<=hi;v+=step){const yy=y(v);g+=`<line class="gl" x1="0" x2="${W}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}"/>${tags.some(t=>Math.abs(t-yy)<(VW>390?17:13))?'':`<text class="ax" x="${W+8}" y="${(yy+4).toFixed(1)}">${m.cu+nf(v,ad)}</text>`}`}
 const bars=k.map((q,i)=>{const up=q.x>=q.a,col=up?'#19d46a':'#ff5a1f',cx=(i+.5)*st,bw=Math.max(1.6,st*.6),t=y(Math.max(q.a,q.x)),b=y(Math.min(q.a,q.x));return`<line x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${y(q.hi).toFixed(1)}" y2="${y(q.lo).toFixed(1)}" stroke="${col}" stroke-width="1.2"/><rect x="${(cx-bw/2).toFixed(1)}" y="${t.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1,b-t).toFixed(1)}" rx=".8" fill="${col}"/>`}).join('');
 const tag=(v,txt,bg,fg,da)=>`<line x1="0" x2="${W}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${bg}" stroke-dasharray="${da}"/><rect x="${W+2}" y="${(y(v)-10).toFixed(1)}" width="66" height="20" rx="6" fill="${bg}"/><text class="tx2" style="font-size:${txt.length>9?9.5:11}px" x="${W+35}" y="${(y(v)+4).toFixed(1)}" text-anchor="middle" fill="${fg}">${txt}</text>`;
 return`<svg class="cht" viewBox="0 0 ${VW} ${H}" role="img" aria-label="${m.s} ${TFS[S.tf][0]} candlestick chart">${g}${bars}${o.sl!=null?tag(o.sl,'SL '+nf(o.sl,m.tp),'#ffb020','#1a1200','6 5'):''}${o.tp!=null?tag(o.tp,'TP '+nf(o.tp,m.tp),'#19d46a','#04140a','6 5'):''}${tag(P,tk(P,m),s0>P?'#ff5a1f':'#19d46a','#fff','2 4')}</svg>`}
