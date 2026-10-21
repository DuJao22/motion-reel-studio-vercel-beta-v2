import { ReelDNA, SceneData, ShowreelItem, GenerationEvent } from '../types';
import { saveReelToDatabase } from './storage';

// -------------------------------------------------------------
// HTML5 Standalone Player Template with Motion Engine (M)
// -------------------------------------------------------------
export const HTML_TEMPLATE = `<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Motion Showreel</title>
<style>
:root{--bg:#07070b;--fg:#eeeef5;--muted:#9a9ab0;--bd:#33334a;--bw:1px;--rad:10px;--sh:none;--ac:#c0284d;--acfg:#fff;
  --btn:#1b1b28;--btnfg:#fff;--font:system-ui,Roboto,Arial,sans-serif;--cvsh:0 0 40px rgba(0,0,0,.7)}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--bg);background-attachment:fixed;color:var(--fg);font-family:var(--font);overflow:hidden}
#app{display:flex;flex-direction:column;height:100%;height:100dvh;gap:8px;
  padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))}
#stage{flex:1 1 auto;min-height:0;min-width:0;display:flex;justify-content:center;align-items:center}
canvas{background:#000;border-radius:var(--rad);box-shadow:var(--cvsh);border:var(--bw) solid var(--bd);flex:none}
#panel{display:flex;flex-direction:column;gap:8px;min-width:0;flex:none}
#top{display:flex;gap:4px 12px;align-items:baseline;justify-content:space-between;flex-wrap:wrap;font-size:13px}
#top b{font-size:15px;overflow-wrap:anywhere}#hud{color:var(--muted);overflow-wrap:anywhere}
#seek{width:100%;accent-color:var(--ac)}
#bar{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
button{flex:1 1 auto;min-width:0;background:var(--btn);color:var(--btnfg);border:var(--bw) solid var(--bd);border-radius:var(--rad);
  box-shadow:var(--sh);padding:10px 12px;font:inherit;font-size:15px;cursor:pointer}
button.rec{background:var(--ac);color:var(--acfg)}button:disabled{opacity:.5}
#dl:empty{display:none}
#dl a{display:block;text-align:center;background:var(--ac);color:var(--acfg);padding:12px 18px;border-radius:var(--rad);text-decoration:none;font-weight:700;overflow-wrap:anywhere}
details{font-size:12px;color:var(--muted)}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:4px 0;max-height:22vh;overflow:auto}
@media (orientation:landscape) and (min-width:640px){
  #app{flex-direction:row;gap:14px}#panel{width:clamp(240px,34vw,380px);justify-content:center;overflow:auto;max-height:100%}}
@media (max-width:360px){button{font-size:13px;padding:9px 8px}}
</style></head><body>
<div id="app">
  <div id="stage"><canvas id="cv"></canvas></div>
  <div id="panel">
    <div id="top"><b id="ttl"></b><span id="hud"></span></div>
    <input type="range" id="seek" min="0" max="1000" value="0">
    <div id="bar">
      <button id="bPlay">&#9654; Play</button><button id="bRest">&#9198;</button>
      <button id="bSnd">&#128266; Som</button><button id="bRec" class="rec">&#9210; Gravar v&iacute;deo</button>
      <button id="bCode">&#128190; Salvar c&oacute;digo</button><button id="bHtml">&#128196; Salvar HTML</button>
    </div>
    <div id="dl"></div>
    <details><summary>Cenas / status</summary><pre id="log"></pre></details>
  </div>
</div>
<script>
const D=/*__DATA__*/null;
const $=id=>document.getElementById(id);
if(D.ui)Object.keys(D.ui).forEach(k=>document.documentElement.style.setProperty(k,D.ui[k]));
const logEl=$('log');function log(m){logEl.textContent+=m+'\\n'}
const W=D.W,H=D.H,DUR=D.duration,BPM=D.dna.bpm,EN=D.dna.energy,PAL=D.dna.pal,KIND=D.dna.transition,TR=0.32;
const cv=$('cv');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
const co=document.createElement('canvas'),cn=document.createElement('canvas');
co.width=cn.width=W;co.height=cn.height=H;
const cxo=co.getContext('2d'),cxn=cn.getContext('2d');
$('ttl').textContent=D.title;

/* ====================== M : biblioteca de movimento ====================== */
const M={};
M.W=W;M.H=H;
M.font=(D.dna.fonte&&D.dna.fonte.stack)||'system-ui,Roboto,Arial,sans-serif';
M.weight=(D.dna.fonte&&D.dna.fonte.weight)||800;
M.clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
M.lerp=(a,b,t)=>a+(b-a)*t;
M.map=(x,a,b,c,d)=>c+(d-c)*M.clamp((x-a)/(b-a));
M.p=(ts,start,dur)=>M.clamp((ts-start)/dur);
M.stagger=(ts,i,start,gap,dur)=>M.p(ts,start+i*gap,dur);
M.ease={
  outExpo:x=>x>=1?1:1-Math.pow(2,-10*x),
  outCubic:x=>1-Math.pow(1-x,3),
  inCubic:x=>x*x*x,
  inOutCubic:x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,
  inOutQuint:x=>x<.5?16*x*x*x*x*x:1-Math.pow(-2*x+2,5)/2,
  outBack:x=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)},
  outElastic:x=>x<=0?0:x>=1?1:Math.pow(2,-10*x)*Math.sin((x*10-.75)*(2*Math.PI/3))+1
};
M.spring=(x,k=7,w=14)=>{x=M.clamp(x);return 1-Math.exp(-k*x)*Math.cos(w*x)};
M.rgb=h=>{h=String(h).replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255]};
M.col=(h,a=1)=>{const c=M.rgb(h);return 'rgba('+c[0]+','+c[1]+','+c[2]+','+M.clamp(a)+')'};
M.mixc=(h1,h2,t)=>{const a=M.rgb(h1),b=M.rgb(h2);t=M.clamp(t);return 'rgb('+Math.round(M.lerp(a[0],b[0],t))+','+Math.round(M.lerp(a[1],b[1],t))+','+Math.round(M.lerp(a[2],b[2],t))+')'};
M.rng=seed=>{let a=(seed|0)||1;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}};
M.lines=(s,max=11)=>{const w=String(s).split(/\\s+/).filter(Boolean),L=[];let cur='';
  w.forEach(x=>{if(cur&&(cur+' '+x).length>max){L.push(cur);cur=x}else cur=(cur?cur+' ':'')+x});
  if(cur)L.push(cur);return L.slice(0,4).length?L.slice(0,4):['']};
M.fit=(ctx,s,maxW,size,weight)=>{ctx.save();size=Math.round(size);
  while(size>12){ctx.font=(weight||M.weight)+' '+size+'px '+M.font;if(ctx.measureText(s).width<=maxW)break;size-=4}
  ctx.restore();return size};
M.LAYOUTS={centro:{main:[.07,.30,.86,.34],art:[0,0,1,1]},arte_cima:{main:[.08,.60,.84,.20],art:[.06,.06,.88,.50]},
  texto_cima:{main:[.08,.08,.84,.20],art:[.06,.32,.88,.50]},meio:{main:[.08,.47,.84,.24],art:[.06,.07,.88,.37]}};
M.zones=(W,H,name)=>{const L=M.LAYOUTS[name]||M.LAYOUTS.centro;
  const r=a=>({x:a[0]*W,y:a[1]*H,w:a[2]*W,h:a[3]*H,cx:(a[0]+a[2]/2)*W,cy:(a[1]+a[3]/2)*H});
  return{name:name,main:r(L.main),art:r(L.art),safe:r([.05,.04,.9,.8]),sub:{cx:W/2,cy:H*.87,w:W*.86,h:H*.07}}};
M._boxes=[];M.shifts=0;
M.text=(ctx,s,x,y,size,o={})=>{
  s=String(s);const al=o.align||'center',a=o.alpha===undefined?1:M.clamp(o.alpha),fam=o.font||M.font,wt=o.weight||M.weight;
  ctx.save();ctx.font=wt+' '+Math.round(size)+'px '+fam;
  if(!o.layer&&!o.rot&&a>=.25&&size>=M.W*.035){
    let w=ctx.measureText(s).width;
    if(w>M.W*.94){size=size*M.W*.94/w;ctx.font=wt+' '+Math.round(size)+'px '+fam;w=ctx.measureText(s).width}
    const h=size*1.1;let x0=al==='left'?x:al==='right'?x-w:x-w/2,y0=y-h/2;
    if(x0<M.W*.02){const d=M.W*.02-x0;x+=d;x0+=d}
    if(x0+w>M.W*.98){const d=x0+w-M.W*.98;x-=d;x0-=d}
    for(let it=0;it<4;it++){
      const hit=M._boxes.find(q=>{const ox=Math.min(x0+w,q.x1)-Math.max(x0,q.x0),oy=Math.min(y0+h,q.y1)-Math.max(y0,q.y0);
        return ox>0&&oy>h*.2&&ox*oy>.15*Math.min(w*h,(q.x1-q.x0)*(q.y1-q.y0))});
      if(!hit)break;
      const oy=Math.min(y0+h,hit.y1)-Math.max(y0,hit.y0),dir=(y0+h/2)>=(hit.y0+hit.y1)/2?1:-1,dy=dir*(oy+size*.12);
      y+=dy;y0+=dy;M.shifts++}
    if(y0<M.H*.03){y+=M.H*.03-y0;y0=M.H*.03}
    if(y0+h>M.H*.97){y-=y0+h-M.H*.97;y0=M.H*.97-h}
    M._boxes.push({x0:x0,x1:x0+w,y0:y0,y1:y0+h})}
  ctx.globalAlpha=a;ctx.textAlign=al;ctx.textBaseline='middle';
  if('letterSpacing' in ctx&&o.spacing)ctx.letterSpacing=o.spacing+'px';
  if(o.rot){ctx.translate(x,y);ctx.rotate(o.rot);x=0;y=0}
  if(o.shadow!==false){ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillText(s,x+size*.03,y+size*.03)}
  if(o.stroke){ctx.lineWidth=o.strokeW||size*.04;ctx.strokeStyle=o.stroke;ctx.strokeText(s,x,y)}
  ctx.fillStyle=o.color||'#fff';
  if(o.glow){ctx.shadowColor=o.glow;ctx.shadowBlur=size*.4}
  ctx.fillText(s,x,y);ctx.restore()};
M.rot3=(p,ax,ay,az)=>{let x=p[0],y=p[1],z=p[2],c=Math.cos(ax),s=Math.sin(ax),t;
  t=y*c-z*s;z=y*s+z*c;y=t;c=Math.cos(ay);s=Math.sin(ay);t=x*c+z*s;z=-x*s+z*c;x=t;
  c=Math.cos(az);s=Math.sin(az);t=x*c-y*s;y=x*s+y*c;x=t;return[x,y,z]};
M.proj=(p,W,H,fov=900,cx=W/2,cy=H/2)=>{const s=fov/Math.max(60,fov+p[2]);return{x:cx+p[0]*s,y:cy+p[1]*s,s:s}};
M.bg=(ctx,W,H,P,v=0)=>{
  const g=v%2?ctx.createLinearGradient(W,0,0,H):ctx.createLinearGradient(0,0,W*.3,H);
  g.addColorStop(0,P.pal.bg1);g.addColorStop(1,P.pal.bg2);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  const r=ctx.createRadialGradient(W/2,H/2,H*.25,W/2,H/2,H*.75);
  r.addColorStop(0,'rgba(0,0,0,0)');r.addColorStop(1,'rgba(0,0,0,.55)');ctx.fillStyle=r;ctx.fillRect(0,0,W,H)};
M.deco=(ctx,W,H,P,ts)=>{const R=M.rng(P.seed*7+1);
  for(let k=0;k<26;k++){const x=R()*W,y=R()*H,r=2+R()*4,vx=(R()-.5)*80,vy=-10-R()*50;
    const px=((x+vx*ts)%W+W)%W,py=((y+vy*ts)%H+H)%H;
    ctx.fillStyle=M.col(k%2?P.pal.acc:P.pal.acc2,.45);ctx.beginPath();ctx.arc(px,py,r*(1+P.pulse*.6),0,7);ctx.fill()}
  const m=W*.06,L=W*.08*M.ease.outExpo(M.p(ts,0,.5));
  ctx.strokeStyle=M.col(P.pal.dim,.6);ctx.lineWidth=3;ctx.beginPath();
  [[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]].forEach(c=>{ctx.moveTo(c[0]+c[2]*L,c[1]);ctx.lineTo(c[0],c[1]);ctx.lineTo(c[0],c[1]+c[3]*L)});
  ctx.stroke()};
M.hash=n=>{n=Math.sin(n*127.1+311.7)*43758.5453;return n-Math.floor(n)};
M.noise=(x,y=0)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),h=(a,b)=>M.hash(a*57+b*131);
  return M.lerp(M.lerp(h(xi,yi),h(xi+1,yi),u),M.lerp(h(xi,yi+1),h(xi+1,yi+1),u),v)*2-1};
M.shake=(ts,amp=1,freq=14)=>({x:M.noise(ts*freq,1.7)*amp,y:M.noise(ts*freq,9.3)*amp});
M.count=(ts,start,dur,from,to,ease='outExpo')=>M.lerp(from,to,(M.ease[ease]||M.ease.outExpo)(M.p(ts,start,dur)));
M.glow=(ctx,color,blur)=>{ctx.shadowColor=color;ctx.shadowBlur=blur};
M.rrect=(ctx,x,y,w,h,r)=>{r=Math.max(0,Math.min(r,Math.abs(w)/2,Math.abs(h)/2));ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()};
M.poly=(ctx,cx,cy,r,n,rot=0)=>{ctx.beginPath();for(let i=0;i<n;i++){const a=rot+i/n*Math.PI*2,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()};
M.star=(ctx,cx,cy,r,n,inner=.45,rot=0)=>{ctx.beginPath();for(let i=0;i<n*2;i++){const a=rot+i/(n*2)*Math.PI*2,rr=i%2?r*inner:r,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()};
M.blob=(ctx,cx,cy,r,ts,seed=1,amt=.25,pts=64)=>{ctx.beginPath();for(let i=0;i<=pts;i++){const a=i/pts*Math.PI*2,
  k=1+amt*M.noise(Math.cos(a)*1.3+seed*7+ts*.6,Math.sin(a)*1.3+seed*3+ts*.5),x=cx+Math.cos(a)*r*k,y=cy+Math.sin(a)*r*k;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()};
M.path=(ctx,pts,p,o={})=>{if(!pts||pts.length<2||p<=0)return;let tot=0;const seg=[];
  for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);seg.push(d);tot+=d}
  let left=tot*M.clamp(p);ctx.save();ctx.lineWidth=o.width||4;ctx.strokeStyle=o.color||'#fff';ctx.lineCap='round';ctx.lineJoin='round';
  if(o.glow){ctx.shadowColor=o.glow;ctx.shadowBlur=(o.width||4)*3}
  ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length&&left>0;i++){const d=seg[i-1]||1e-6,f=Math.min(1,left/d);ctx.lineTo(pts[i-1][0]+(pts[i][0]-pts[i-1][0])*f,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*f);left-=d}
  ctx.stroke();ctx.restore()};
M.arc=(ctx,cx,cy,r,p,o={})=>{ctx.save();ctx.lineWidth=o.width||6;ctx.strokeStyle=o.color||'#fff';ctx.lineCap='round';
  if(o.glow){ctx.shadowColor=o.glow;ctx.shadowBlur=(o.width||6)*3}
  ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*M.clamp(p));ctx.stroke();ctx.restore()};
M.particles=(ctx,W,H,P,ts,o={})=>{const n=o.n||60,R=M.rng((o.seed||P.seed)+11),a=o.area||{x:0,y:0,w:W,h:H},sp=o.speed||1,cols=o.colors||[P.pal.acc,P.pal.acc2,P.pal.fg];
  for(let i=0;i<n;i++){const z=.3+R()*.7,x0=R(),y0=R(),vx=(R()-.5)*60*sp*z,vy=-(10+R()*50)*sp*z,r=(o.size||5)*z*(.5+R())*(W/720),
    x=a.x+(((x0*a.w+vx*ts)%a.w)+a.w)%a.w,y=a.y+(((y0*a.h+vy*ts)%a.h)+a.h)%a.h,tw=.6+.4*Math.sin(ts*3+i);
    ctx.fillStyle=M.col(cols[i%cols.length],(o.alpha||.7)*z*tw);ctx.beginPath();ctx.arc(x,y,r*(1+P.pulse*.5),0,7);ctx.fill()}};
M.floor=(ctx,W,H,ts,o={})=>{const hz=(o.horizon||.55)*H,L=o.lines||14,sp=o.speed||.5;ctx.save();
  ctx.strokeStyle=o.color||'#fff';ctx.lineWidth=o.width||2;ctx.globalAlpha=o.alpha||.6;
  for(let i=0;i<L;i++){const f=(i/L+ts*sp)%1,y=hz+Math.pow(f,2.2)*(H-hz);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
  for(let i=-L;i<=L;i++){ctx.beginPath();ctx.moveTo(W/2+i*W*.015,hz);ctx.lineTo(W/2+i*W*.25,H);ctx.stroke()}ctx.restore()};
M.textChars=(ctx,s,cx,cy,size,ts,o={})=>{s=String(s);const fam=o.font||M.font,wt=o.weight||M.weight,chars=[...s];
  ctx.save();ctx.font=wt+' '+Math.round(size)+'px '+fam;const sp=o.spacing||0,ws=chars.map(c=>ctx.measureText(c).width+sp),tot=ws.reduce((a,b)=>a+b,0)||1;
  const sc=tot>M.W*.92?M.W*.92/tot:1,fs=size*sc,W2=ws.map(w=>w*sc),T=tot*sc;ctx.font=wt+' '+Math.round(fs)+'px '+fam;ctx.textBaseline='middle';ctx.textAlign='center';
  M._boxes.push({x0:cx-T/2,x1:cx+T/2,y0:cy-fs*.55,y1:cy+fs*.55});
  let x=cx-T/2;const st=o.stagger===undefined?.04:o.stagger,dur=o.dur||.5,eff=o.effect||'rise';
  chars.forEach((ch,i)=>{const p=M.p(ts,(o.start||0)+i*st,dur);
    if(p>0){const e=M.ease.outBack(p);let dy=0,sx=1,rot=0;
      if(eff==='rise')dy=(1-e)*fs*.9;else if(eff==='drop')dy=-(1-e)*fs*.9;else if(eff==='scale')sx=Math.max(0,e);else if(eff==='spin')rot=(1-e)*1.2;
      ctx.save();ctx.globalAlpha=M.clamp(p*3)*(o.alpha===undefined?1:o.alpha);ctx.translate(x+W2[i]/2,cy+dy);ctx.rotate(rot);ctx.scale(sx,sx);
      if(o.glow){ctx.shadowColor=o.glow;ctx.shadowBlur=fs*.3}
      ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillText(ch,fs*.03,fs*.03);
      ctx.fillStyle=(o.colors&&o.colors[i%o.colors.length])||o.color||'#fff';ctx.fillText(ch,0,0);ctx.restore()}
    x+=W2[i]});ctx.restore()};
M.titleChars=(ctx,W,H,P,ts,o={})=>{
  const z=(P.zones&&P.zones.main)||{x:W*.07,y:H*.3,w:W*.86,h:H*.34,cx:W/2,cy:H*.47};
  const L=M.lines(String(P.text).toUpperCase(),o.maxChars||13),long=L.reduce((a,b)=>a.length>b.length?a:b,'');
  let fs=M.fit(ctx,long,z.w*.96,W*.15);fs=Math.min(fs,z.h/(L.length*1.2));const lh=fs*1.2,y0=z.cy-(L.length-1)*lh/2;
  L.forEach((l,i)=>M.textChars(ctx,l,z.cx,y0+i*lh,fs*(1+P.pulse*.04+(P.voice||0)*.04),ts,
    Object.assign({color:(i===L.length-1&&L.length>1)?P.pal.acc:P.pal.fg,glow:P.pal.acc,start:.2+i*.18,stagger:.03},o)))};
M.mainText=(ctx,W,H,P,ts,o={})=>{
  const z=(P.zones&&P.zones.main)||{x:W*.07,y:H*.3,w:W*.86,h:H*.34,cx:W/2,cy:H*.47};
  const L=M.lines(String(P.text).toUpperCase(),11),long=L.reduce((a,b)=>a.length>b.length?a:b,'');
  let fs=M.fit(ctx,long,z.w,W*.17);fs=Math.min(fs,z.h/(L.length*1.18))*(o.scale||1);
  const lh=fs*1.18,cy=o.cy||z.cy,y0=cy-(L.length-1)*lh/2;
  L.forEach((l,i)=>M.text(ctx,l,W/2,y0+i*lh,fs*(1+P.pulse*.05+(P.voice||0)*.04),
    {color:(i===L.length-1&&L.length>1)?P.pal.acc:P.pal.fg,alpha:o.alpha===undefined?1:o.alpha,glow:P.pal.acc}))};
M.sub=(ctx,W,H,P,ts)=>{const s=String(P.sub||'').trim();if(!s)return;const a=M.p(ts,P.subAt===undefined?.55:P.subAt,.35);if(a<=0)return;
  const z=(P.zones&&P.zones.sub)||{cy:H*.87,w:W*.86,h:H*.07},L=M.lines(s,s.length>36?Math.ceil(s.length/2)+4:60).slice(0,2),
    long=L.reduce((x,y)=>x.length>y.length?x:y,''),sz=Math.min(M.fit(ctx,long,z.w,W*.045,600),z.h*1.15/(L.length*1.2)),lh=sz*1.22;
  L.forEach((l,i)=>M.text(ctx,l,W/2,z.cy+(i-(L.length-1)/2)*lh+(1-a)*20,sz,{color:P.pal.dim,alpha:a,weight:600}))};

/* ====================== cenas prontas (fallback) ====================== */
const FB={},FBL={cube:'arte_cima'};
FB.kinetic=(ctx,t,ts,W,H,P,M)=>{M.deco(ctx,W,H,P,ts);const R=M.rng(P.seed),dir=R()<.5?-1:1,z=P.zones.main;
  const L=M.lines(String(P.text).toUpperCase(),11),long=L.reduce((a,b)=>a.length>b.length?a:b,'');
  const fs=Math.min(M.fit(ctx,long,z.w,W*.2),z.h/(L.length*1.18)),lh=fs*1.18,y0=z.cy-(L.length-1)*lh/2;
  L.forEach((l,i)=>{const p=M.p(ts,.08+i*.13,.5),e=M.ease.outBack(p);
    M.text(ctx,l,W/2+(1-M.ease.outCubic(p))*dir*W*.3,y0+i*lh+(1-e)*lh*.5,fs*(.6+.4*e)*(1+P.pulse*.05),
      {color:(i===L.length-1&&L.length>1)?P.pal.acc:P.pal.fg,alpha:p*2.5,glow:P.pal.acc})});
  const bw=W*.5*M.ease.outExpo(M.p(ts,.5,.5)),y=Math.min(y0+(L.length-1)*lh+fs*.78,z.y+z.h+H*.02);
  ctx.fillStyle=P.pal.acc2;ctx.fillRect(W/2-bw/2,y,bw,Math.max(4,W*.009))};
FB.burst=(ctx,t,ts,W,H,P,M)=>{const R=M.rng(P.seed),cx=W/2,cy=H*.46,g=M.ease.outExpo(M.p(ts,0,.9)),n=24+Math.floor(R()*16),spin=(R()-.5)*1.4;
  ctx.lineCap='round';
  for(let k=0;k<n;k++){const a=Math.PI*2*k/n+ts*spin,ln=.45+R()*.55,r0=W*(.16+P.pulse*.03),r1=W*(.18+.55*g*ln);
    ctx.strokeStyle=M.col(k%2?P.pal.acc:P.pal.acc2,.4+.6*g);ctx.lineWidth=3+(k%3)*2;ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r1);ctx.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.stroke()}
  M.deco(ctx,W,H,P,ts);M.mainText(ctx,W,H,P,ts,{scale:.7+.3*M.ease.outBack(M.p(ts,.1,.5)),alpha:M.p(ts,.05,.3)})};
FB.tunnel=(ctx,t,ts,W,H,P,M)=>{const R=M.rng(P.seed),cx=W/2,cy=H*.46,round=R()<.5,sp=.8+R()*.6;
  for(let k=0;k<12;k++){const z=(k/12+ts*.4*sp)%1,s=Math.pow(z,2.2)*W*1.7;
    ctx.strokeStyle=M.col(k%2?P.pal.acc:P.pal.acc2,z);ctx.lineWidth=2+z*9;ctx.beginPath();
    if(round)ctx.arc(cx,cy,s/2,0,Math.PI*2);else ctx.rect(cx-s/2,cy-s/2,s,s);ctx.stroke()}
  M.deco(ctx,W,H,P,ts);M.mainText(ctx,W,H,P,ts,{scale:.75+.25*M.ease.outExpo(M.p(ts,0,.6)),alpha:M.p(ts,0,.3)})};
FB.grid=(ctx,t,ts,W,H,P,M)=>{const R=M.rng(P.seed),cols=[5,6,8][Math.floor(R()*3)],cs=W/cols,rows=Math.ceil(H/cs),ox=R()*W,oy=R()*H,wp=ts*2.2*(.8+R()*.6);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=c*cs,y=r*cs,d=Math.hypot(x+cs/2-ox,y+cs/2-oy)/W,glow=M.clamp(1-Math.abs(d-wp)*3),pad=cs*(.06+.2*(1-glow));
    ctx.fillStyle=M.mixc(P.pal.bg2,(r+c)%2?P.pal.acc:P.pal.acc2,glow);ctx.fillRect(x+pad,y+pad,cs-pad*2,cs-pad*2)}
  const a=M.p(ts,.3,.3),z=P.zones.main;
  if(a>0){ctx.fillStyle=P.pal.bg1;ctx.fillRect(z.x-W*.02,z.y-H*.01,z.w+W*.04,z.h+H*.02);
    M.mainText(ctx,W,H,P,ts,{scale:.8+.2*M.ease.outBack(a),alpha:a})}};
FB.orbit=(ctx,t,ts,W,H,P,M)=>{const R=M.rng(P.seed),cx=W/2,cy=H*.46,spin=.4+R()*.8;
  for(let ring=0;ring<3;ring++){const r=W*(.22+ring*.13)*M.ease.outExpo(M.p(ts,0,.8));
    ctx.strokeStyle=M.col(P.pal.dim,.35);ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
    const n=3+ring*2;
    for(let k=0;k<n;k++){const a=ts*spin*(1+ring*.5)*(ring%2?1:-1)+Math.PI*2*k/n,px=cx+Math.cos(a)*r,py=cy+Math.sin(a)*r;
      ctx.fillStyle=k%2?P.pal.acc:P.pal.acc2;ctx.beginPath();ctx.arc(px,py,W*.016*(1+P.pulse*.3),0,7);ctx.fill()}}
  M.deco(ctx,W,H,P,ts);M.mainText(ctx,W,H,P,ts,{scale:.6+.4*M.ease.outBack(M.p(ts,0,.6)),alpha:M.p(ts,0,.3)})};
FB.cube=(ctx,t,ts,W,H,P,M)=>{const R=M.rng(P.seed),a0=P.zones.art,cx=a0.cx,cy=a0.cy,s=Math.min(W*.2,a0.h*.2)*M.ease.outBack(M.p(ts,0,.7)),V=[];
  for(let x=-1;x<=1;x+=2)for(let y=-1;y<=1;y+=2)for(let z=-1;z<=1;z+=2)V.push([x*s,y*s,z*s]);
  const E=[[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const ax=ts*.9+R()*3,ay=ts*1.3,az=ts*.4,Q=V.map(v=>M.proj(M.rot3(v,ax,ay,az),W,H,900,cx,cy));
  ctx.lineWidth=5;ctx.lineCap='round';
  E.forEach((e,i)=>{ctx.strokeStyle=M.col(i%2?P.pal.acc:P.pal.acc2,.95);ctx.beginPath();ctx.moveTo(Q[e[0]].x,Q[e[0]].y);ctx.lineTo(Q[e[1]].x,Q[e[1]].y);ctx.stroke()});
  Q.forEach(p=>{ctx.fillStyle=P.pal.fg;ctx.beginPath();ctx.arc(p.x,p.y,6*p.s,0,7);ctx.fill()});
  M.deco(ctx,W,H,P,ts);M.mainText(ctx,W,H,P,ts,{alpha:M.p(ts,.2,.4)})};
FB.closing=(ctx,t,ts,W,H,P,M)=>{const cx=W/2,cy=H*.46,r=W*.34*M.ease.outExpo(M.p(ts,0,1));
  ctx.strokeStyle=M.col(P.pal.acc,.8);ctx.lineWidth=4;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
  M.deco(ctx,W,H,P,ts);M.mainText(ctx,W,H,P,ts,{scale:.85+.15*M.ease.outExpo(M.p(ts,0,.9)),alpha:M.p(ts,0,.6)});
  const bw=W*.4*M.ease.outExpo(M.p(ts,.4,.6));ctx.fillStyle=P.pal.acc2;ctx.fillRect(cx-bw/2,P.zones.main.y+P.zones.main.h+H*.01,bw,5)};

/* ====================== montagem das cenas ====================== */
function compile(code){
  const src=String(code||'').trim();if(!src)throw new Error('código vazio');
  const fn=/^(async\\s+)?function\\b|^\\(\\s*[\\w\\s,]*\\)\\s*=>/.test(src)?new Function('return ('+src+')')():new Function('ctx','t','ts','W','H','P','M',src);
  if(typeof fn!=='function')throw new Error('não é função');return fn}
const SC=D.scenes.map((s,i)=>{let fn=null,origem='fallback',layout=s.layout||'centro';
  if(s.code){try{fn=compile(s.code);origem=s.origem||'gemini'}catch(e){fn=null;log('cena '+(i+1)+': erro de sintaxe -> fallback ('+e.message+')')}}
  if(!fn){fn=FB[s.fb]||FB.kinetic;layout=FBL[s.fb]||'centro'}
  return Object.assign({},s,{fn:fn,origem:origem,layout:layout,start:0})});
let _acc=0;SC.forEach(s=>{s.start=_acc;_acc+=s.dur});

function degrade(i,e){const s=SC[i];log('cena '+(i+1)+': '+(e&&e.message||e)+' -> fallback');s.fn=FB[s.fb]||FB.kinetic;s.origem='fallback';s.layout=FBL[s.fb]||'centro'}
function pulseAt(gt){const f=(gt*BPM/60)%1;return Math.pow(1-f,4)*(.35+.13*EN)}
function resetCtx(c){if(c.reset)c.reset();else{c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.shadowBlur=0;c.globalCompositeOperation='source-over'}}
function voiceAt(s,ts){if(!s.env||!s.env.length)return 0;const k=(ts-(s.voice_at||0))*25;if(k<0)return 0;const i=Math.floor(k);if(i>=s.env.length)return 0;
  const a=s.env[i]/100,b=(s.env[i+1]===undefined?s.env[i]:s.env[i+1])/100;return a+(b-a)*(k-i)}
function mkP(s,i,gt,ts){return{pal:PAL,bpm:BPM,energy:EN,text:s.text,sub:s.sub,role:s.role,dur:s.dur,seed:s.seed,pulse:pulseAt(gt),gt:gt,i:i,layout:s.layout,zones:M.zones(W,H,s.layout),
  voice:voiceAt(s,ts||0),say:s.fala||'',subAt:s.sub_at}}
const FX=Object.assign({grain:.04,push:.03,shake:.004,bars:0},D.dna.fx||{});

function camera(c,s,ts,gt,P){const k=1+FX.push*M.ease.outCubic(M.clamp(ts/s.dur)),sh=M.shake(gt,FX.shake*W*(.3+P.pulse),11);
  c.translate(W/2+sh.x,H/2+sh.y);c.scale(k,k);c.translate(-W/2,-H/2)}
function runScene(c,s,ts,gt,P){c.save();camera(c,s,ts,gt,P);try{s.fn(c,M.clamp(ts/s.dur),ts,W,H,P,M)}finally{c.restore()}}
function paint(c,i,ts,gt,strict){
  const s=SC[i];resetCtx(c);M._boxes.length=0;
  let P=mkP(s,i,gt,ts);
  M.bg(c,W,H,P,i);
  try{runScene(c,s,ts,gt,P)}
  catch(e){if(strict)throw e;degrade(i,e);resetCtx(c);M._boxes.length=0;P=mkP(s,i,gt,ts);M.bg(c,W,H,P,i);runScene(c,s,ts,gt,P)}
  try{M.sub(c,W,H,P,ts)}catch(e){}
}

/* ====================== Motor de áudio (batida sintetizada + narração TTS humana) ====================== */
let AC=null,master=null,beatG=null,vG=null,adest=null,muted=false,playing=false,gt=0,t0=0,lastHalf=-1,voiceScene=-1,needVoice=true;
let VB=[],voicesReady=null,curV=null;
let mr=null,chunks=[],recording=false,mimeT='';

function decodeVoices(){
  return Promise.all(SC.map(async(s,i)=>{
    if(!s.audio)return;
    try{
      const bin=atob(s.audio),u=new Uint8Array(bin.length);
      for(let k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);
      VB[i]=await AC.decodeAudioData(u.buffer.slice(0));
    }catch(e){
      log('voz cena '+(i+1)+': decodificação de áudio ('+e.message+')');
    }
  }));
}

function stopVoice(){
  if(curV){try{curV.src.stop()}catch(e){}curV=null}
  if(typeof window!=='undefined'&&window.speechSynthesis)window.speechSynthesis.cancel();
}

function startVoice(i,ts){
  stopVoice();
  const s=SC[i];
  if(!s)return;
  const buf=VB[i];
  const at=s.voice_at||0.45;

  if(AC&&buf){
    if(ts>=at+buf.duration)return;
    const src=AC.createBufferSource();
    src.buffer=buf;
    src.connect(vG);
    const when=AC.currentTime+Math.max(0,at-ts),offset=Math.max(0,ts-at);
    src.start(when,offset);
    curV={src:src,scene:i};
    return;
  }

  // Fallback to Web Speech API if s.audio wasn't generated and text exists
  if(!muted && typeof window!=='undefined' && window.speechSynthesis && s.fala && D.voice!=='none'){
    try {
      const u=new SpeechSynthesisUtterance(s.fala);
      u.lang='pt-BR';
      u.rate=1.05;
      u.pitch=1.0;
      const vs=window.speechSynthesis.getVoices();
      const pt=vs.find(v=>v.lang&&v.lang.startsWith('pt')&&(v.name.includes('Natural')||v.name.includes('Google')||v.name.includes('Luciana')||v.name.includes('Felipe')))||vs.find(v=>v.lang&&v.lang.startsWith('pt'));
      if(pt)u.voice=pt;
      window.speechSynthesis.speak(u);
    }catch(e){}
  }
}

function initAudio(){
  if(AC)return;
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx)return;
  AC=new AudioCtx();
  master=AC.createGain();master.gain.value=muted?0:.9;
  beatG=AC.createGain();beatG.gain.value=.8;beatG.connect(master);
  vG=AC.createGain();vG.gain.value=1.15;vG.connect(master);
  adest=AC.createMediaStreamDestination();
  master.connect(AC.destination);
  master.connect(adest);
  vG.connect(adest);
  voicesReady=decodeVoices();
}

function kick(){
  if(!AC||muted)return;
  const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime;
  o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(32,t+.15);
  g.gain.setValueAtTime(1,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);
  o.connect(g);g.connect(beatG);o.start(t);o.stop(t+.22);
}

function hat(){
  if(!AC||muted)return;
  const buf=AC.createBuffer(1,Math.floor(AC.sampleRate*.05),AC.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(AC.sampleRate*.012));
  const s=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();
  s.buffer=buf;f.type='highpass';f.frequency.value=7500;g.gain.value=.35;
  s.connect(f);f.connect(g);g.connect(beatG);s.start();
}

function whoosh(){
  if(!AC||muted)return;
  const buf=AC.createBuffer(1,Math.floor(AC.sampleRate*.28),AC.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  const s=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter(),t=AC.currentTime;
  s.buffer=buf;f.type='bandpass';f.frequency.setValueAtTime(400,t);f.frequency.exponentialRampToValueAtTime(3200,t+.26);
  g.gain.setValueAtTime(.01,t);g.gain.linearRampToValueAtTime(.4,t+.12);g.gain.linearRampToValueAtTime(.01,t+.28);
  s.connect(f);f.connect(g);g.connect(beatG);s.start(t);s.stop(t+.3);
}

function frame(t){
  t=((t%DUR)+DUR)%DUR;
  for(let i=0;i<SC.length;i++){if(t>=SC[i].start&&t<SC[i].start+SC[i].dur)return i}
  return SC.length-1;
}

let lastScene=-1;
function tick(now){
  if(playing){
    gt=(now-t0)/1000;
    if(gt>=DUR){
      gt=0;t0=now;lastHalf=-1;
      stopVoice();
      if(recording){stopRec();playing=false}
    }
  }
  const i=frame(gt),sc=SC[i],ts=gt-sc.start;
  paint(ctx,i,ts,gt,false);
  if(playing&&AC){
    const h=Math.floor(gt*BPM/60*2);
    if(h!==lastHalf){lastHalf=h;if(h%2===0)kick();else hat()}
    if(lastScene>=0&&i!==lastScene)whoosh();
    if(needVoice||i!==voiceScene){
      needVoice=false;
      voiceScene=i;
      startVoice(i,gt-SC[i].start);
    }
    const sv=SC[i],tv=gt-sv.start,buf=VB[i];
    const isSpeaking=(buf&&tv>=(sv.voice_at||0.45)&&tv<(sv.voice_at||0.45)+buf.duration) || (typeof window!=='undefined'&&window.speechSynthesis&&window.speechSynthesis.speaking);
    beatG.gain.setTargetAtTime(isSpeaking?.22:.8,AC.currentTime,.12);
  }
  lastScene=i;
  $('hud').textContent=(recording?'● GRAVANDO  ':'')+gt.toFixed(1)+'s / '+DUR+'s  ·  cena '+(i+1)+'/'+SC.length+' ('+sc.origem+')'+(VB[i]?'  ·  🎙️ TTS':'');
  if(playing)$('seek').value=Math.round(gt/DUR*1000);
  requestAnimationFrame(tick);
}

function fitCanvas(){
  const st=$('stage'),r=W/H;let w=st.clientWidth,h=st.clientHeight;if(w<=0||h<=0)return;
  if(w/h>r)w=h*r;else h=w/r;cv.style.width=Math.floor(w)+'px';cv.style.height=Math.floor(h)+'px';
}
addEventListener('resize',fitCanvas);
addEventListener('orientationchange',()=>setTimeout(fitCanvas,150));
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitCanvas).observe($('stage'));

async function play(){
  initAudio();
  if(AC&&AC.state==='suspended')await AC.resume();
  try{await voicesReady}catch(e){}
  playing=true;
  t0=performance.now()-gt*1000;
  needVoice=true;
  $('bPlay').innerHTML='&#9208; Pausa';
}
function pause(){
  playing=false;
  stopVoice();
  $('bPlay').innerHTML='&#9654; Play';
}

async function startRec(){
  if(recording)return;initAudio();try{await AC.resume()}catch(e){}try{await voicesReady}catch(e){}
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  mimeT=(window.MediaRecorder&&types.find(t=>MediaRecorder.isTypeSupported(t)))||'';
  if(!mimeT){alert('Este navegador não suporta gravação de vídeo.');return}
  const stream=cv.captureStream(D.fps||30);
  if(adest&&adest.stream)adest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
  chunks=[];mr=new MediaRecorder(stream,{mimeType:mimeT,videoBitsPerSecond:Math.min(20000000,Math.round(W*H*8))});
  mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  mr.onstop=()=>{
    const ext=mimeT.indexOf('mp4')>=0?'mp4':'webm',blob=new Blob(chunks,{type:mimeT.split(';')[0]}),url=URL.createObjectURL(blob);
    const name='showreel_'+Date.now()+'.'+ext;
    $('dl').innerHTML='<a download="'+name+'" href="'+url+'">⬇ Baixar vídeo ('+ext.toUpperCase()+', '+(blob.size/1e6).toFixed(1)+' MB)</a>';
    $('dl').firstChild.click();recording=false;$('bRec').disabled=false;log('gravação pronta: '+ext);
  };
  recording=true;$('bRec').disabled=true;$('dl').innerHTML='';gt=0;mr.start(500);await play();
}
function stopRec(){if(mr&&mr.state!=='inactive')mr.stop()}

$('bPlay').onclick=()=>playing?pause():play();
$('bRest').onclick=()=>{gt=0;stopVoice();lastScene=-1;voiceScene=-1;needVoice=true;if(playing)t0=performance.now();lastHalf=-1};
$('bSnd').onclick=()=>{muted=!muted;initAudio();if(master)master.gain.value=muted?0:.9;$('bSnd').innerHTML=muted?'&#128263; Mudo':'&#128266; Som'};
$('bRec').onclick=startRec;
$('seek').oninput=e=>{pause();stopVoice();lastScene=-1;voiceScene=-1;needVoice=true;gt=e.target.value/1000*DUR};
function saveCode(){
  let out='// Showreel: '+D.title+'\\n// DNA: '+D.dna.estilo+' | '+D.dna.structure+' | '+D.dna.transition+' | '+BPM+' bpm\\n';
  out+='// Cada cena abaixo e o CORPO de uma funcao (ctx, t, ts, W, H, P, M)\\n\\n';
  SC.forEach((s,i)=>{out+='// ===== CENA '+(i+1)+' ['+s.role+'] "'+s.text+'" ('+s.origem+', layout '+s.layout+') =====\\n';
    out+=(s.code?s.code:'// cena pronta (fallback: '+s.fb+'), sem codigo gerado pelo Gemini')+'\\n\\n'});
  const b=new Blob([out],{type:'text/javascript'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='showreel_codigo_'+Date.now()+'.js';
  document.body.appendChild(a);a.click();a.remove();log('código salvo (download)');
}
$('bCode').onclick=saveCode;
async function saveHTML(){
  let src='';
  try{const r=await fetch(location.href);if(r.ok)src=await r.text()}catch(e){}
  if(!src||src.indexOf('const D=')<0){
    const c=document.documentElement.cloneNode(true),q=x=>c.querySelector(x);
    c.removeAttribute('style');if(q('#log'))q('#log').textContent='';if(q('#dl'))q('#dl').innerHTML='';if(q('#hud'))q('#hud').textContent='';if(q('#cv'))q('#cv').removeAttribute('style');
    src='<!doctype html>\\n'+c.outerHTML;
  }
  const b=new Blob([src],{type:'text/html'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download=(D.title||'showreel').replace(/[^\\w\\-]+/g,'_')+'.html';
  document.body.appendChild(a);a.click();a.remove();log('HTML completo salvo (download)');
}
$('bHtml').onclick=saveHTML;
$('seek').oninput=e=>{pause();gt=e.target.value/1000*DUR};
log('DNA: '+D.dna.estilo+' | '+D.dna.structure+' | '+D.dna.transition+' | '+BPM+' bpm | energia '+EN+' | tema '+(D.ui_nome||'-'));
SC.forEach((s,i)=>log((i+1)+'. ['+s.role+'] '+s.text+'  ('+s.origem+', layout '+s.layout+', '+s.dur.toFixed(1)+'s)'));
fitCanvas();requestAnimationFrame(tick);
</script></body></html>`;

// -------------------------------------------------------------
// DNA & Style Presets Matching Python Backend
// -------------------------------------------------------------
const STYLES_INFO: Array<{ name: string; desc: string; structure: string; bpm: [number, number]; energy: [number, number]; trans: string[] }> = [
  { name: 'minimalista e elegante', desc: 'muito espaço vazio, linhas finas, círculos, movimento lento e preciso, tipografia leve', structure: 'uniforme', bpm: [80, 95], energy: [1, 2], trans: ['crossfade', 'wipe_h', 'zoom'] },
  { name: 'cinematográfico e dramático', desc: 'contraste alto, vinheta forte, luz e sombra, letterbox, zoom lento, texto serifado entrando devagar', structure: 'crescendo', bpm: [75, 95], energy: [2, 3], trans: ['crossfade', 'flash', 'zoom'] },
  { name: 'futurista e tecnológico', desc: 'interface HUD, wireframes, grades em perspectiva, scanlines, dados digitais, brilho neon', structure: 'explosao_respiro', bpm: [110, 130], energy: [3, 4], trans: ['glitch', 'wipe_h', 'wipe_v', 'flash'] },
  { name: 'colorido e energético', desc: 'formas vibrantes, cores saturadas, movimento rápido e elástico, círculos em explosão', structure: 'explosao_respiro', bpm: [125, 140], energy: [5, 5], trans: ['wipe_h', 'wipe_v', 'zoom', 'flash'] },
  { name: 'editorial e tipográfico', desc: 'tipografia protagonista, grid editorial, filetes finos, números gigantes, serifa elegante', structure: 'uniforme', bpm: [90, 110], energy: [2, 3], trans: ['wipe_h', 'crossfade', 'wipe_v'] },
  { name: 'surpresa e experimental', desc: 'DNA e estilo combinados de forma imprevisível e artística', structure: 'crescendo', bpm: [95, 125], energy: [3, 4], trans: ['glitch', 'zoom', 'flash'] }
];

const RESOLUTIONS = [
  { width: 540, height: 960 },
  { width: 720, height: 1280 },
  { width: 1080, height: 1920 }
];

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Key manager with cooldown
let keyCooldowns: Record<string, number> = {};
let keyIndex = 0;

function pickAvailableKey(keys: string[]): { key: string; index: number } | null {
  if (!keys || keys.length === 0) return null;
  const now = Date.now();
  for (let i = 0; i < keys.length; i++) {
    const idx = (keyIndex + i) % keys.length;
    const k = keys[idx];
    if (!keyCooldowns[k] || keyCooldowns[k] <= now) {
      keyIndex = (idx + 1) % keys.length;
      return { key: k, index: idx };
    }
  }
  // All in cooldown, pick the earliest to expire
  let bestIdx = 0;
  let minWait = Infinity;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const wait = (keyCooldowns[k] || 0) - now;
    if (wait < minWait) {
      minWait = wait;
      bestIdx = i;
    }
  }
  return { key: keys[bestIdx], index: bestIdx };
}

function markKeyCooldown(key: string, seconds = 60) {
  keyCooldowns[key] = Date.now() + seconds * 1000;
}

// -------------------------------------------------------------
// Gemini API Request via Server-Side Proxy (Avoids CSP & CORS issues)
// -------------------------------------------------------------
async function callGeminiProxy(
  keys: string[],
  prompt: string,
  options: { json?: boolean; temperature?: number } = {},
  onLog?: (msg: string) => void
): Promise<string | null> {
  if (onLog) {
    onLog('Solicitando geração ao modelo Gemini...');
  }

  try {
    const res = await fetch('/api/gemini/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        json: options.json,
        temperature: options.temperature,
        keys
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text) {
        if (onLog && data.model) {
          onLog(`IA respondeu com sucesso (${data.model})`);
        }
        return data.text;
      }
      if (data.offline && onLog) {
        onLog(data.message || 'Chave indisponível. Continuando com renderização procedural.');
      }
    }
  } catch (err: any) {
    console.warn('Erro ao chamar proxy Gemini:', err);
    if (onLog) {
      onLog('Serviço temporariamente indisponível. Usando modo procedural.');
    }
  }

  return null;
}

// -------------------------------------------------------------
// Gemini Text-to-Speech API Request (Humanized Voice Narration)
// -------------------------------------------------------------
async function callGeminiTTS(
  keys: string[],
  text: string,
  voice: string,
  onLog?: (msg: string) => void
): Promise<string | null> {
  if (!text || !text.trim() || voice === 'none') return null;

  try {
    const res = await fetch('/api/gemini/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text.trim(),
        voice,
        keys
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.audioBase64) {
        return data.audioBase64;
      }
    }
  } catch (err: any) {
    console.warn('Erro ao chamar proxy TTS Gemini:', err);
  }

  return null;
}

// -------------------------------------------------------------
// Generation Pipeline Functions
// -------------------------------------------------------------
export interface ReelGeneratorOptions {
  keys: string[];
  styleId: number;
  resolutionId: number;
  fps: number;
  accent: string;
  effort: number;
  voice: string;
}

export async function generateReelClientSide(
  prompt: string,
  options: ReelGeneratorOptions,
  onEvent: (ev: GenerationEvent) => void,
  onLog: (text: string) => void
): Promise<ShowreelItem> {
  const timestamp = Date.now();
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
  const reelId = `${dateStr}_${Math.random().toString(36).substring(2, 6)}`;
  const filename = `showreel_${reelId}.html`;

  onEvent({ step: 'init', message: 'Iniciando gerador universal otimizado para Vercel...' });
  onLog(`Iniciando geração com ${options.keys.length} chave(s) do Gemini salvas`);

  // 1. Setup resolution & DNA
  const resIdx = Math.max(1, Math.min(3, options.resolutionId || 2)) - 1;
  const resolution = RESOLUTIONS[resIdx] || RESOLUTIONS[1];
  const W = resolution.width;
  const H = resolution.height;

  const styleIdx = Math.max(1, Math.min(STYLES_INFO.length, options.styleId || 2)) - 1;
  const styleConfig = STYLES_INFO[styleIdx] || STYLES_INFO[1];

  const rng = Math.random;
  const bpm = Math.floor(styleConfig.bpm[0] + rng() * (styleConfig.bpm[1] - styleConfig.bpm[0]));
  const energy = styleConfig.energy[0] + Math.floor(rng() * (styleConfig.energy[1] - styleConfig.energy[0] + 1));
  const transition = styleConfig.trans[Math.floor(rng() * styleConfig.trans.length)];

  const accentColor = options.accent || '#FFB454';
  const pal = {
    bg1: '#07070d',
    bg2: '#121224',
    acc: accentColor,
    acc2: '#38bdf8',
    fg: '#f5f5f5',
    dim: '#b0b0c0'
  };

  const fonts = [
    { nome: 'moderna', stack: "system-ui,Roboto,'Segoe UI',Arial,sans-serif", weight: 800 },
    { nome: 'serifada', stack: "Georgia,'Noto Serif','Times New Roman',serif", weight: 700 },
    { nome: 'impacto', stack: "Impact,'Arial Narrow',sans-serif", weight: 400 }
  ];
  const chosenFont = fonts[Math.floor(rng() * fonts.length)];

  const dna: ReelDNA = {
    estilo: styleConfig.name,
    estilo_desc: styleConfig.desc,
    structure: styleConfig.structure,
    transition,
    bpm,
    energy,
    pal,
    fonte: chosenFont,
    fx: { grain: 0.04, push: 0.03, shake: 0.004, bars: 0 }
  };

  onEvent({ step: 'dna', message: `DNA Definido: ${dna.estilo} (${dna.bpm} BPM)`, dna });
  onLog(`DNA do showreel gerado: ${dna.estilo} | ${dna.structure} | ${dna.bpm} BPM`);

  // 2. Generate Script (Gemini or Offline Fallback)
  onEvent({ step: 'script_start', message: 'Criando roteiro e coreografia com Gemini...' });

  const scriptPrompt = `Você é um diretor sênior de motion design e showreels verticais 9:16.
Crie um roteiro de showreel dinâmico com 6 a 8 cenas para o seguinte briefing:
"${prompt}"

Estilo visual: ${dna.estilo} (${dna.estilo_desc}).
Estrutura: ${dna.structure}, BPM: ${dna.bpm}.
Para cada cena, responda em JSON com:
- "role": "hook" (cena 1), "body" (cenas 2 a 5), "climax" (penúltima), "closing" (última cena)
- "text": Título curto de impacto em português (máx 5 palavras, maiúsculas)
- "sub": Subtítulo curto em português (máx 10 palavras)
- "idea": Descrição visual da animação (o que se move, formas, fundo, destaque)
- "duracao": Duração de 2.5 a 4.5 segundos
- "fala": Fala conversacional de 1 a 2 frases para narração

Responda APENAS com JSON:
{"title":"...","motivo":"...","scenes":[{"role":"hook","text":"...","sub":"...","idea":"...","duracao":3.5,"fala":"..."}]}`;

  let plan: any = null;
  const scriptRaw = await callGeminiProxy(options.keys, scriptPrompt, { json: true, temperature: 0.9 }, onLog);
  if (scriptRaw) {
    try {
      const clean = scriptRaw.replace(/```json/gi, '').replace(/```/g, '').trim();
      plan = JSON.parse(clean);
    } catch (err) {
      console.warn('Falha no parse do script do Gemini:', err);
    }
  }

  // Fallback plan if Gemini did not respond
  if (!plan || !Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    onLog('Usando roteiro inteligente pré-definido para o tema');
    const words = prompt.toUpperCase().split(/\s+/).filter(w => w.length > 2);
    const kw1 = words[0] || 'INOVAÇÃO';
    const kw2 = words[1] || 'PERFORMANCE';
    const kw3 = words[2] || 'EXPERIÊNCIA';

    plan = {
      title: `${kw1} Showreel`,
      motivo: 'Formas geométricas e anéis de dados que pulsam com a batida',
      scenes: [
        { role: 'hook', text: kw1, sub: 'Uma nova visão de movimento', idea: 'Letras surgindo com explosão de partículas e linhas com glow neon', duracao: 3.5, fala: `${kw1}. Uma nova visão de movimento.` },
        { role: 'body', text: kw2, sub: 'Potência máxima e controle', idea: 'Túnel 3D com dados acelerando em direção à câmera', duracao: 3.0, fala: `${kw2}. Potência máxima e controle visual.` },
        { role: 'body', text: 'DESIGN FLUIDO', sub: 'Geometria adaptativa inteligente', idea: 'Grade digital pulsando em sincronia com o ritmo', duracao: 3.2, fala: 'Design fluido com geometria adaptativa inteligente.' },
        { role: 'climax', text: kw3, sub: 'Impacto total em cada detalhe', idea: 'Cubo 3D wireframe girando com glow e anéis orbitais', duracao: 3.5, fala: `${kw3}. Impacto total em cada detalhe.` },
        { role: 'closing', text: 'EXPERIMENTE AGORA', sub: 'Motion Reel Studio', idea: 'Card final com anel luminoso e assinatura elegante', duracao: 3.0, fala: 'Experimente agora com Motion Reel Studio.' }
      ]
    };
  }

  const rawScenes: SceneData[] = plan.scenes.map((s: any, idx: number) => ({
    role: s.role || (idx === 0 ? 'hook' : idx === plan.scenes.length - 1 ? 'closing' : 'body'),
    text: (s.text || 'MOTION').slice(0, 40),
    sub: (s.sub || '').slice(0, 90),
    dur: Math.max(2, Math.min(6, parseFloat(s.duracao) || 3.2)),
    idea: s.idea || '',
    fala: s.fala || '',
    layout: idx === plan.scenes.length - 1 ? 'centro' : (['arte_cima', 'texto_cima', 'meio', 'centro'][idx % 4]),
    fb: ['kinetic', 'burst', 'tunnel', 'grid', 'orbit', 'cube'][idx % 6]
  }));

  const totalDuration = rawScenes.reduce((acc, sc) => acc + sc.dur, 0);

  onEvent({
    step: 'script_done',
    message: `Roteiro concluído: "${plan.title}" (${rawScenes.length} cenas, ${totalDuration.toFixed(1)}s)`,
    title: plan.title,
    motivo: plan.motivo,
    scenes: rawScenes,
    total_duration: totalDuration
  });
  onLog(`Roteiro pronto: "${plan.title}" com ${rawScenes.length} cenas`);

  // 2.1 Synthesize Humanized Voice Narration (Gemini TTS)
  if (options.voice && options.voice !== 'none') {
    onEvent({
      step: 'voice_start',
      message: `Sintetizando narração humanizada com Gemini TTS (${options.voice})...`
    });
    onLog(`🎙️ Sintetizando narração humanizada com voz "${options.voice}" (Gemini 3.8 TTS)...`);

    for (let i = 0; i < rawScenes.length; i++) {
      const sc = rawScenes[i];
      const speechText = (sc.fala || `${sc.text}. ${sc.sub}`).trim();
      onEvent({
        step: 'voice_progress',
        index: i + 1,
        total: rawScenes.length,
        message: `Sintetizando voz da cena ${i + 1}/${rawScenes.length}: "${sc.text}"...`
      });

      const audioBase64 = await callGeminiTTS(options.keys, speechText, options.voice, onLog);
      if (audioBase64) {
        sc.audio = audioBase64;
        onLog(`🎙️ Áudio da cena ${i + 1}/${rawScenes.length} sintetizado com sucesso (${options.voice})`);
      } else {
        onLog(`Cena ${i + 1}: narração pronta via sintetizador vocal em português.`);
      }
    }
  }

  // 3. Generate Scenes Canvas Code
  const finalScenes: SceneData[] = [];
  const jsCodeBlocks: string[] = [
    `// Showreel: ${plan.title}`,
    `// Prompt: ${prompt}`,
    `// DNA: ${dna.estilo} | ${dna.structure} | ${dna.bpm} BPM`,
    `// Cada função recebe: (ctx, t, ts, W, H, P, M)\n`
  ];

  for (let i = 0; i < rawScenes.length; i++) {
    const sc = rawScenes[i];
    onEvent({
      step: 'scene_start',
      message: `Gerando código da cena ${i + 1}/${rawScenes.length}: "${sc.text}"...`,
      index: i + 1,
      total: rawScenes.length,
      text: sc.text,
      role: sc.role,
      dur: sc.dur
    });

    let generatedCode: string | null = null;

    onEvent({
      step: 'scene_step',
      index: i + 1,
      total: rawScenes.length,
      substep: 'Escrevendo animação Canvas 2D com Gemini...'
    });

    const codePrompt = `Você é um desenvolvedor especialista em HTML5 Canvas 2D e Motion Design.
Escreva APENAS o corpo em JavaScript de uma função que renderiza a cena ${i + 1} de um showreel.
Parâmetros disponíveis:
- ctx: CanvasRenderingContext2D
- t: progresso da cena (0.0 a 1.0)
- ts: tempo decorrido em segundos nesta cena
- W: largura do canvas (${W})
- H: altura do canvas (${H})
- P: { text: "${sc.text}", sub: "${sc.sub}", pal: { bg1, bg2, acc, acc2, fg, dim }, pulse: 0..1, bpm: ${dna.bpm}, zones: { main, art, safe, sub } }
- M: biblioteca com M.titleChars(ctx, W, H, P, ts, {effect:'rise'|'drop'|'scale'}), M.particles, M.arc, M.glow, M.ease, M.stagger, M.col, M.rot3, M.proj, M.rrect, M.poly, M.star.

Cena:
- Papel: ${sc.role}
- Texto: "${sc.text}"
- Ideia visual: ${sc.idea}
- Layout: ${sc.layout}

Regras:
1. Retorne APENAS o código JavaScript executável, sem blocos markdown (\`\`\`), sem declaração de função externa.
2. Não use APIs proibidas (sem fetch, sem window, sem document).
3. Use sempre P.zones.art para elementos visuais e chame M.titleChars(ctx, W, H, P, ts) ou M.mainText(ctx, W, H, P, ts) para o texto.`;

    const geminiCode = await callGeminiProxy(options.keys, codePrompt, { temperature: 0.5 }, onLog);
    if (geminiCode) {
      generatedCode = geminiCode.replace(/```javascript/gi, '').replace(/```js/gi, '').replace(/```/g, '').trim();
    }

    const sceneObj: SceneData = {
      ...sc,
      code: generatedCode || undefined,
      origem: generatedCode ? 'gemini' : 'fallback',
      audio: sc.audio
    };

    finalScenes.push(sceneObj);

    jsCodeBlocks.push(
      `// ===== CENA ${i + 1} [${sc.role}] "${sc.text}" (${sceneObj.origem}, layout: ${sc.layout}) =====\n` +
      (sceneObj.code || `// Cena renderizada com preset paramétrico (${sc.fb})`) + '\n'
    );

    onEvent({
      step: 'scene_done',
      message: `Cena ${i + 1} concluída (${sceneObj.origem}${sc.audio ? ' · voz sincronizada' : ''})`,
      index: i + 1,
      total: rawScenes.length,
      text: sc.text,
      origem: sceneObj.origem,
      has_code: Boolean(sceneObj.code),
      audio: sc.audio
    });
    onLog(`Cena ${i + 1}/${rawScenes.length} pronta (${sceneObj.origem}${sc.audio ? ' · 🎙️ áudio TTS' : ''})`);
  }

  // 4. Assemble the Standalone HTML5 Showreel File
  const reelDataPayload = {
    title: plan.title,
    W,
    H,
    duration: totalDuration,
    fps: options.fps || 24,
    voice: options.voice || 'Kore',
    dna: {
      structure: dna.structure,
      transition: dna.transition,
      estilo: dna.estilo,
      pal: dna.pal,
      bpm: dna.bpm,
      energy: dna.energy,
      fonte: dna.fonte,
      fx: dna.fx
    },
    ui: {
      '--bg': '#07070d',
      '--fg': '#eeeef5',
      '--muted': '#9a9ab0',
      '--bd': '#33334a',
      '--bw': '1px',
      '--rad': '12px',
      '--sh': 'none',
      '--ac': accentColor,
      '--acfg': '#000',
      '--btn': 'rgba(255,255,255,0.08)',
      '--btnfg': '#fff',
      '--font': chosenFont.stack,
      '--cvsh': '0 0 45px rgba(0,0,0,0.8)'
    },
    ui_nome: 'vidro',
    scenes: finalScenes
  };

  const jsonBlob = JSON.stringify(reelDataPayload).replace(/<\//g, '<\\/');
  const fullHtml = HTML_TEMPLATE.replace('/*__DATA__*/null', jsonBlob);
  const fullJsBundle = jsCodeBlocks.join('\n');

  // 5. Create Object URL and Save to IndexedDB
  const htmlBlob = new Blob([fullHtml], { type: 'text/html; charset=utf-8' });
  const htmlBlobUrl = URL.createObjectURL(htmlBlob);

  const newReelItem: ShowreelItem = {
    id: reelId,
    title: plan.title,
    filename,
    createdAt: new Date().toISOString(),
    size: htmlBlob.size,
    htmlUrl: htmlBlobUrl,
    htmlContent: fullHtml,
    scenes: finalScenes,
    dna,
    jsCode: fullJsBundle,
    motivo: plan.motivo,
    prompt
  };

  await saveReelToDatabase(newReelItem);

  onEvent({
    step: 'complete',
    message: 'Showreel gerado com sucesso e salvo permanentemente no seu navegador!',
    result: {
      id: reelId,
      title: plan.title,
      filename,
      html_url: htmlBlobUrl,
      total_duration: totalDuration,
      scenes_count: finalScenes.length,
      dna,
      dados: reelDataPayload,
      codigo_pasta: '',
      created_at: reelId
    }
  });
  onLog(`Showreel finalizado e salvo no IndexedDB local: ${filename} (${(htmlBlob.size / 1024).toFixed(0)} KB)`);

  return newReelItem;
}
