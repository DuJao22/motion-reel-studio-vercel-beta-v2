#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MOTION REEL STUDIO v3  -  HTML5, SEM FFMPEG
===========================================
Corrige o erro "No ffmpeg exe could be found": esta versão NÃO usa moviepy, imageio, Pillow nem ffmpeg.
Só Python puro (biblioteca padrão). Flask é opcional.

Fluxo (igual ao v2):  briefing -> estilo -> resolução -> fluidez -> cor -> roteiro (S/R/N)
  1) A Gemini cria o roteiro e depois escreve o CÓDIGO DE CADA CENA (planeja, escreve e revisa; as chaves da lista fazem rodízio).
  2) O Python salva tudo num arquivo HTML5 (.html) na mesma pasta deste script.
  3) Um servidor (Flask, ou o padrão do Python) abre o arquivo no navegador do celular.
  4) No navegador, toque em "Gravar vídeo": ele grava e baixa MP4 (ou WebM) sozinho, sem ffmpeg.
  5) NARRAÇÃO: voz humana (Gemini TTS) falando o roteiro; cada cena dura o que a fala dura, o subtítulo entra quando a
     2ª frase começa e a imagem reage ao volume da voz. A voz também vai gravada no vídeo e salva em .wav.

O .html salvo é um ARQUIVO ÚNICO: todo o JavaScript (player, animação, batida, gravação, salvar código)
está dentro dele, sem servidor e sem internet. Abra direto no Chrome, ou use o botão "Salvar HTML" na página.
"""
import os, sys, re, json, time, random, colorsys, functools, threading, base64, io, math, wave, array
import urllib.request, urllib.error
import http.server, socketserver, webbrowser, socket, logging

# ============================ CONFIGURAÇÃO ============================
# LISTA DE CHAVES DA GEMINI: coloque quantas quiser; cada chamada usa a PRÓXIMA chave da lista (rodízio).
GEMINI_API_KEYS = [
    "AQ.Ab8RN6K7PDbvgxYiO5VWU4s3yV3_Hyo1LJJoSophy3BL_zG0gA",
    "AQ.Ab8RN6LJKX0RG2xCDoE0Rn-_tZQecw7FL0jLxCNiknko_v9wuQ",
    "AIzaSyBZeJ-TQhrDpS0i1YqjSexseVk7E4M91Zk",
    "AIzaSyCxoZ1g1O6AdALqViDnVpbV4_6f04IkATo",
    "AIzaSyBCcMZHG7GFSA_xqMDIBCFpiXuTcnKCWiQ",
    "AIzaSyCSvt0sZfcr0YLNHpTMB9EW0yvEhcvyEEA",
    "AIzaSyAeff_E3hWu6z3LxLLMBwisaNjx3O7A9XY",
    "AIzaSyBDhstVBwY6_J4hlbRBnXhjzDtdOHa-Jr0",
    "AIzaSyC-zLbdhAfEKCLZu2SUWoR2r7mR6QVCV-g",
    "AIzaSyCqLitiUxASbBVDVJa0whABi3LkB2r6zxc",
    "AQ.Ab8RN6Kpba9NaSQ--6oVMokuc1yh_wSWkjdQjO_OJKWnqhTsLw",
    "AIzaSyDkRN631rnapQ675hCYBr1N8Bvoe-IHYAY",
    "AIzaSyB4RrNpjR1Z9oeDf9XyPn7HDYKSgWRYbeU"
]
NIVEL_ESFORCO = 1                # 1 = rápido | 2 = planeja + escreve | 3 = planeja + escreve + refina (melhor)
THINK_BUDGET = 6000                   # "pensar mais" do Gemini (0 desliga; se o modelo não aceitar, ele segue sem)
VOZ_ATIVA = True                      # narração com voz humana (Gemini TTS), sincronizada com as cenas
VOZ_NOME = "Kore"                     # voz padrão (o menu deixa escolher)
VOICE_AT = 0.45                       # a voz começa 0,45s depois do início da cena (junto com o título)
GEMINI_MODEL = "auto"                # "auto" = descobre os modelos da sua chave e usa o melhor disponível.
                                      # Ou fixe um, ex.: "gemini-3.1-flash-lite" (se falhar, ele troca sozinho)

DURATION = 30                         # duração do showreel em segundos
WIDTH, HEIGHT = 720, 1280             # 9:16 (o menu de resolução sobrescreve)
FPS = 24                              # o menu de fluidez sobrescreve
ACCENT_PADRAO = "#FFB454"             # cor de destaque padrão
PROMPT_FIXO = ""                      # se preencher, o script não pergunta nada
REAPROVEITAR = 0.25                   # chance de reusar uma cena já criada antes (poupa API)
PAUSA_ENTRE_CHAMADAS = 1.5            # segundos entre chamadas (evita limite gratuito)
PORTA = 8765
SALVAR_CODIGO = True                  # salva o código de cada cena em arquivos .js
USAR_FLASK = True                     # ao terminar, abre um servidor Flask mostrando o arquivo criado
# ======================================================================

_BASE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else os.getcwd()
OUTPUT_DIR = os.path.join(_BASE, "output_reels")
os.makedirs(OUTPUT_DIR, exist_ok=True)

ROLES = ["hook", "body", "climax", "closing"]
FALLBACKS = ["kinetic", "burst", "tunnel", "grid", "orbit", "cube"]
STRUCTURES = ["crescendo", "explosao_respiro", "uniforme"]
TRANSITIONS = ["flash", "wipe_h", "wipe_v", "crossfade", "glitch", "zoom"]
STYLES = [
    ("tipografia cinética", "texto gigante entrando em palavras, cortes rápidos, escalas e rotações com easing forte"),
    ("glitch digital", "fatias deslocadas, aberração cromática, scanlines, ruído, números e código"),
    ("minimalista elegante", "muito espaço vazio, linhas finas, círculos, movimento lento e preciso, tipografia leve"),
    ("3D em perspectiva", "objetos 3D (cubos, esferas de partículas, túneis) projetados com M.rot3 e M.proj"),
    ("grid dinâmico", "grades, painéis, colagem de retângulos que se revelam em onda, barras e blocos"),
    ("líquido orgânico", "blobs, ondas senoidais, metaballs falsas, curvas suaves, movimento fluido"),
    ("neon synthwave", "linhas de horizonte, grade em perspectiva, sol, brilhos (glow), gradientes vibrantes"),
    ("blueprint técnico", "wireframes, medidas, cruzes, linhas de cota, números pequenos, estética de engenharia"),
]

MENU_ESTILOS = [
    {"nome": "minimalista e elegante", "desc": "muito espaço vazio, linhas finas, círculos, movimento lento e preciso, tipografia leve, poucos elementos",
     "estrutura": "uniforme", "fontes": ["moderna", "humanista", "classica"], "bpm": (80, 95), "energia": (1, 2),
     "trans": ["crossfade", "wipe_h", "zoom"]},
    {"nome": "cinematográfico e dramático", "desc": "contraste alto, vinheta forte, luz e sombra, barras de cinema (letterbox), zoom lento, texto serifado grande entrando devagar, poeira em partículas, revelações dramáticas",
     "estrutura": "crescendo", "fontes": ["serifada", "classica"], "bpm": (75, 95), "energia": (2, 3),
     "trans": ["crossfade", "flash", "zoom"]},
    {"nome": "futurista e tecnológico", "desc": "interface HUD, wireframes, grades em perspectiva, linhas de scan, números e dados, brilho (glow) neon, estética de painel de controle",
     "estrutura": "explosao_respiro", "fontes": ["mono", "moderna"], "bpm": (110, 130), "energia": (3, 4),
     "trans": ["glitch", "wipe_h", "wipe_v", "flash"]},
    {"nome": "colorido e energético", "desc": "formas geométricas vibrantes, cores saturadas, movimento rápido e elástico, círculos que explodem, texto grande com overshoot",
     "estrutura": "explosao_respiro", "fontes": ["impacto", "humanista", "moderna"], "bpm": (125, 140), "energia": (5, 5),
     "trans": ["wipe_h", "wipe_v", "zoom", "flash"]},
    {"nome": "editorial e tipográfico", "desc": "tipografia como protagonista, grid editorial, filetes e linhas finas, números grandes, composição assimétrica, serifa elegante",
     "estrutura": "uniforme", "fontes": ["serifada", "classica", "impacto"], "bpm": (90, 110), "energia": (2, 3),
     "trans": ["wipe_h", "crossfade", "wipe_v"]},
]
RESOLUCOES = [(540, 960), (720, 1280), (1080, 1920)]
ROLE_PT = {"hook": "abertura", "body": "conteudo", "climax": "destaque", "closing": "encerramento"}

LAYOUTS = {
    "centro":     {"main": (.07, .30, .86, .34), "art": (0, 0, 1, 1),
                   "desc": "texto no centro; a arte é só FUNDO (atrás do texto, transparência alta, sem formas opacas sobre o texto)"},
    "arte_cima":  {"main": (.08, .60, .84, .20), "art": (.06, .06, .88, .50),
                   "desc": "elemento visual grande em cima, texto embaixo dele"},
    "texto_cima": {"main": (.08, .08, .84, .20), "art": (.06, .32, .88, .50),
                   "desc": "texto em cima, elemento visual grande embaixo dele"},
    "meio":       {"main": (.08, .47, .84, .24), "art": (.06, .07, .88, .37),
                   "desc": "elemento visual no terço de cima, texto no meio"},
}
FONTES = [
    {"nome": "moderna", "stack": "system-ui,Roboto,'Segoe UI',Arial,sans-serif", "weight": 800},
    {"nome": "serifada", "stack": "Georgia,'Noto Serif','Times New Roman',serif", "weight": 700},
    {"nome": "mono", "stack": "'Courier New','Noto Sans Mono',monospace", "weight": 700},
    {"nome": "impacto", "stack": "Impact,'Arial Narrow','Roboto Condensed',sans-serif-condensed,sans-serif", "weight": 400},
    {"nome": "humanista", "stack": "'Trebuchet MS',Verdana,'Noto Sans',sans-serif", "weight": 800},
    {"nome": "classica", "stack": "'Palatino Linotype',Palatino,'Noto Serif',serif", "weight": 600},
]
PRIORIDADES = """PRIORIDADES DO SISTEMA (em ordem, valem mais que qualquer outra instrução):
1. DESIGN ALEATÓRIO E ORIGINAL: cada showreel tem tema, tipografia, paleta e composição novos. Siga o DNA recebido e nunca repita o visual das cenas vizinhas.
2. RESPONSIVO: use SEMPRE medidas relativas a W e H (nunca números fixos em pixels); nada pode ficar cortado fora da tela.
3. SEM SOBREPOSIÇÃO: cada informação no seu lugar. Texto só dentro de P.zones.main, elemento visual principal só dentro de P.zones.art, nada importante fora de P.zones.safe. Dois textos nunca ficam um sobre o outro; formas opacas nunca cobrem texto."""

def descrever_layout(nome):
    L = LAYOUTS.get(nome, LAYOUTS["centro"])
    pc = lambda t: "x %d%%, y %d%%, largura %d%%, altura %d%%" % tuple(round(v * 100) for v in t)
    return ("Layout '%s' (%s):\n  - P.zones.main (TEXTO): %s\n  - P.zones.art (ARTE principal): %s\n"
            "  - P.zones.safe: x 5%%, y 4%%, largura 90%%, altura 80%% (nada importante fora disto)\n"
            "  - P.zones.sub: faixa reservada em y 87%% para o subtítulo (o motor desenha; não use essa faixa)"
            % (nome, L["desc"], pc(L["main"]), pc(L["art"])))

def make_ui(rng, hue, evitar):
    ac = hsl_hex(hue + 0.5, 0.85, 0.58)
    temas = {
        "vidro": {"--bg": "linear-gradient(160deg,%s,%s)" % (hsl_hex(hue, .5, .07), hsl_hex(hue + .08, .55, .17)),
                  "--fg": "#f2f2fa", "--muted": "#a9a9c4", "--btn": "rgba(255,255,255,.10)", "--btnfg": "#ffffff",
                  "--bd": "rgba(255,255,255,.22)", "--bw": "1px", "--rad": "16px", "--sh": "0 4px 20px rgba(0,0,0,.35)",
                  "--ac": ac, "--acfg": "#ffffff", "--font": "system-ui,Roboto,Arial,sans-serif",
                  "--cvsh": "0 10px 50px rgba(0,0,0,.6)"},
        "neon": {"--bg": "#05050a", "--fg": "#eaffff", "--muted": "#7fb6c4", "--btn": "rgba(0,0,0,.45)", "--btnfg": "#eaffff",
                 "--bd": ac, "--bw": "2px", "--rad": "10px", "--sh": "0 0 14px " + ac, "--ac": ac, "--acfg": "#05050a",
                 "--font": "'Courier New','Noto Sans Mono',monospace", "--cvsh": "0 0 34px " + ac},
        "brutal": {"--bg": hsl_hex(hue, .35, .9), "--fg": "#111111", "--muted": "#444444", "--btn": "#ffffff", "--btnfg": "#111111",
                   "--bd": "#111111", "--bw": "3px", "--rad": "0px", "--sh": "4px 4px 0 #111111",
                   "--ac": hsl_hex(hue + .5, .9, .55), "--acfg": "#111111",
                   "--font": "'Arial Black',Impact,Arial,sans-serif", "--cvsh": "6px 6px 0 #111111"},
        "claro": {"--bg": "#f5f6fa", "--fg": "#14141c", "--muted": "#6a6a80", "--btn": "#ffffff", "--btnfg": "#14141c",
                  "--bd": "#d4d6e2", "--bw": "1px", "--rad": "14px", "--sh": "0 2px 8px rgba(0,0,0,.08)",
                  "--ac": hsl_hex(hue, .75, .5), "--acfg": "#ffffff", "--font": "system-ui,Roboto,Arial,sans-serif",
                  "--cvsh": "0 12px 40px rgba(0,0,0,.25)"},
        "terminal": {"--bg": "#021208", "--fg": "#7dffa8", "--muted": "#3fae66", "--btn": "#031d0d", "--btnfg": "#7dffa8",
                     "--bd": "#1f7a3d", "--bw": "1px", "--rad": "2px", "--sh": "none", "--ac": "#1fbf5a", "--acfg": "#021208",
                     "--font": "'Courier New','Noto Sans Mono',monospace", "--cvsh": "0 0 24px rgba(31,191,90,.3)"},
        "por-do-sol": {"--bg": "linear-gradient(180deg,%s,%s)" % (hsl_hex(.97, .7, .14), hsl_hex(.07, .8, .25)),
                       "--fg": "#fff4ec", "--muted": "#f0b79a", "--btn": "rgba(255,255,255,.14)", "--btnfg": "#fff4ec",
                       "--bd": "rgba(255,255,255,.25)", "--bw": "1px", "--rad": "999px", "--sh": "0 6px 20px rgba(0,0,0,.35)",
                       "--ac": hsl_hex(.08, .95, .6), "--acfg": "#1a0a05", "--font": "'Trebuchet MS',Verdana,sans-serif",
                       "--cvsh": "0 10px 40px rgba(0,0,0,.5)"},
    }
    nomes = [n for n in temas if n not in evitar] or list(temas)
    nome = rng.choice(nomes)
    return {"nome": nome, "vars": temas[nome]}

# ---------------------------------------------------------------------
# Biblioteca de movimento (M) e engine que roda NO NAVEGADOR
# ---------------------------------------------------------------------
HTML = r'''<!doctype html>
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
const logEl=$('log');function log(m){logEl.textContent+=m+'\n'}
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
M.lines=(s,max=11)=>{const w=String(s).split(/\s+/).filter(Boolean),L=[];let cur='';
  w.forEach(x=>{if(cur&&(cur+' '+x).length>max){L.push(cur);cur=x}else cur=(cur?cur+' ':'')+x});
  if(cur)L.push(cur);return L.slice(0,4).length?L.slice(0,4):['']};
M.fit=(ctx,s,maxW,size,weight)=>{ctx.save();size=Math.round(size);
  while(size>12){ctx.font=(weight||M.weight)+' '+size+'px '+M.font;if(ctx.measureText(s).width<=maxW)break;size-=4}
  ctx.restore();return size};
/* zonas de layout (frações da tela): texto e arte NUNCA ocupam o mesmo retângulo */
M.LAYOUTS={centro:{main:[.07,.30,.86,.34],art:[0,0,1,1]},arte_cima:{main:[.08,.60,.84,.20],art:[.06,.06,.88,.50]},
  texto_cima:{main:[.08,.08,.84,.20],art:[.06,.32,.88,.50]},meio:{main:[.08,.47,.84,.24],art:[.06,.07,.88,.37]}};
M.zones=(W,H,name)=>{const L=M.LAYOUTS[name]||M.LAYOUTS.centro;
  const r=a=>({x:a[0]*W,y:a[1]*H,w:a[2]*W,h:a[3]*H,cx:(a[0]+a[2]/2)*W,cy:(a[1]+a[3]/2)*H});
  return{name:name,main:r(L.main),art:r(L.art),safe:r([.05,.04,.9,.8]),sub:{cx:W/2,cy:H*.87,w:W*.86,h:H*.07}}};
/* texto: nunca passa da tela e nunca fica por cima de outro texto (a menos que layer:true) */
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
/* ---- utilidades extras para cenas mais ricas ---- */
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
/* texto letra por letra (uma linha); reserva a caixa para o anti-sobreposição */
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
/* título de P.text, letra por letra, dentro da zona de texto (várias linhas se precisar) */
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
  const fn=/^(async\s+)?function\b|^\(\s*[\w\s,]*\)\s*=>/.test(src)?new Function('return ('+src+')')():new Function('ctx','t','ts','W','H','P','M',src);
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
const GRN=128;let GR=null;
try{const g=document.createElement('canvas');g.width=g.height=GRN;const gx=g.getContext('2d'),id=gx.createImageData(GRN,GRN);
  for(let k=0;k<id.data.length;k+=4){const v=Math.random()*255;id.data[k]=id.data[k+1]=id.data[k+2]=v;id.data[k+3]=255}
  gx.putImageData(id,0,0);GR=ctx.createPattern(g,'repeat')}catch(e){GR=null}

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

const cs=document.createElement('canvas');cs.width=24;cs.height=42;const cxs=cs.getContext('2d');
function sig(src){try{cxs.clearRect(0,0,24,42);cxs.drawImage(src,0,0,24,42);return cxs.getImageData(0,0,24,42).data}catch(e){return null}}
function sdiff(a,b){if(!a||!b||!a.length)return null;let d=0;for(let k=0;k<a.length;k+=4)d+=Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2]);return d/(a.length/4)/3}
SC.forEach((s,i)=>{try{M.shifts=0;const t0=performance.now(),S=[];
  [.15,.5,.9].forEach(f=>{paint(cxn,i,s.dur*f,s.start+s.dur*f,true);S.push(sig(cn))});
  const ms=(performance.now()-t0)/3,P0=mkP(s,i,s.start+s.dur*.5,s.dur*.5);resetCtx(cxn);M.bg(cxn,W,H,P0,i);
  const bgS=sig(cn),vazio=sdiff(S[1],bgS),mov=Math.max(sdiff(S[0],S[1])||0,sdiff(S[1],S[2])||0);
  if(ms>120){degrade(i,{message:'muito pesada ('+Math.round(ms)+' ms/frame)'})}
  else if(vazio!==null&&vazio<2){degrade(i,{message:'cena vazia (nada visível)'})}
  else if(vazio!==null&&mov<.8){degrade(i,{message:'cena parada (sem movimento)'})}
  else if(M.shifts>0)log('cena '+(i+1)+': textos se sobrepunham -> reposicionados automaticamente')
}catch(e){degrade(i,e)}});

function composite(kind,p,i){
  resetCtx(ctx);const e=M.ease.inOutCubic(p);
  if(kind==='wipe_h'){ctx.drawImage(co,0,0);const cut=Math.floor(W*e);if(cut>=1)ctx.drawImage(cn,0,0,cut,H,0,0,cut,H);
    ctx.fillStyle=PAL.acc;ctx.fillRect(cut-W*.03,0,W*.03,H)}
  else if(kind==='wipe_v'){ctx.drawImage(co,0,0);const cut=Math.floor(H*e);if(cut>=1)ctx.drawImage(cn,0,0,W,cut,0,0,W,cut);
    ctx.fillStyle=PAL.acc;ctx.fillRect(0,cut-H*.02,W,H*.02)}
  else if(kind==='crossfade'){ctx.drawImage(co,0,0);ctx.globalAlpha=e;ctx.drawImage(cn,0,0);ctx.globalAlpha=1}
  else if(kind==='zoom'){const s2=.88+.12*e;ctx.drawImage(cn,W*(1-s2)/2,H*(1-s2)/2,W*s2,H*s2);
    const s1=1+e*.7;ctx.globalAlpha=1-e;ctx.drawImage(co,W*(1-s1)/2,H*(1-s1)/2,W*s1,H*s1);ctx.globalAlpha=1}
  else if(kind==='glitch'){ctx.drawImage(cn,0,0);const R=M.rng(Math.floor(p*30)+7);
    for(let k=0;k<10;k++){const y=R()*H,h=R()*H*.08+8,dx=(R()-.5)*W*.3*(1-p);ctx.drawImage(cn,0,y,W,h,dx,y,W,h)}
    ctx.fillStyle=M.col(PAL.acc,.25*(1-p));ctx.fillRect(0,R()*H,W,H*.01)}
  else{ctx.drawImage(cn,0,0);ctx.fillStyle='rgba(255,255,255,'+Math.pow(1-p,2)+')';ctx.fillRect(0,0,W,H)}
}
function frame(gt){
  gt=M.clamp(gt,0,DUR-1e-3);let i=0;while(i<SC.length-1&&gt>=SC[i+1].start)i++;
  const ts=gt-SC[i].start;
  if(i>0&&ts<TR){paint(cxn,i,ts,gt);paint(cxo,i-1,SC[i-1].dur+ts,gt);composite(KIND,ts/TR,i)}
  else paint(ctx,i,ts,gt);
  if(FX.grain>0&&GR){ctx.save();ctx.globalAlpha=FX.grain;ctx.translate(M.hash(gt*91)*GRN,M.hash(gt*57)*GRN);ctx.fillStyle=GR;ctx.fillRect(-GRN,-GRN,W+GRN*2,H+GRN*2);ctx.restore()}
  if(FX.bars>0){const b=H*FX.bars;ctx.fillStyle='#000';ctx.fillRect(0,0,W,b);ctx.fillRect(0,H-b,W,b)}
  const f=gt<.4?1-gt/.4:(gt>DUR-.5?1-(DUR-gt)/.5:0);
  if(f>0){ctx.fillStyle='rgba(0,0,0,'+M.clamp(f)+')';ctx.fillRect(0,0,W,H)}
  return i}

/* ====================== áudio (batida sintetizada + voz humana) ====================== */
let AC=null,master=null,adest=null,nbuf=null,muted=false,beatG=null,vG=null,VB=[],voicesReady=null,curV=null,curIdx=0,curTs=0,totalElapsed=0,lastHalf=-1,voiceScene=-1,speechActive=false,lastNow=performance.now();
let _currentUtterance=null,speechFinishedAt=-1,activeSpeechScene=-1;
function isVoiceActive(sceneIdx){
  if(curV&&curV.scene===sceneIdx&&curV.active){if(AC&&curV.endTime&&AC.currentTime<curV.endTime+0.1)return true}
  if(activeSpeechScene===sceneIdx){if(speechActive)return true;if(typeof window!=='undefined'&&window.speechSynthesis&&window.speechSynthesis.speaking)return true;if(speechFinishedAt>0&&(performance.now()-speechFinishedAt)<700)return true}
  return false}
function decodeVoices(){return Promise.all(SC.map(async(s,i)=>{
  if(s.audio){
    try{const bin=atob(s.audio),u=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);VB[i]=await AC.decodeAudioData(u.buffer.slice(0));
      if(VB[i]&&VB[i].duration){const at=s.voice_at||0.5;s.dur=Math.max(s.dur||0,Math.round((at+VB[i].duration+1.5)*10)/10);s.audio_dur=VB[i].duration;}}
    catch(e){log('voz cena '+(i+1)+': decodificação de áudio')}
  } else if(s.fala){
    const words=s.fala.trim().split(/\s+/).filter(Boolean);const puncts=(s.fala.match(/[,.;:!?—]/g)||[]).length;const longW=words.filter(w=>w.length>6).length;
    const est=0.50+(words.length*0.58)+(longW*0.18)+(puncts*0.50)+1.50;s.dur=Math.max(5.5,Math.round(est*10)/10);
  }
})).then(()=>{let acc=0;SC.forEach(s=>{s.start=acc;acc+=s.dur});DUR=acc;D.duration=acc;})}
function stopVoice(){if(curV){try{curV.src.stop()}catch(e){}curV.active=false;curV=null}speechActive=false;activeSpeechScene=-1;speechFinishedAt=-1;_currentUtterance=null;if(typeof window!=='undefined'&&window.speechSynthesis){try{window.speechSynthesis.cancel()}catch(e){}}}
function startVoice(i,ts){stopVoice();const s=SC[i];if(!s)return;voiceScene=i;activeSpeechScene=i;speechFinishedAt=-1;const buf=VB[i];const at=s.voice_at||0.5;
  if(AC&&buf){if(ts>=at+buf.duration)return;const src=AC.createBufferSource();src.buffer=buf;src.connect(vG);
    const when=AC.currentTime+Math.max(0,at-ts),offset=Math.max(0,ts-at),playDur=buf.duration-offset;src.start(when,offset);curV={src:src,scene:i,active:true,endTime:when+playDur};
    src.onended=()=>{if(curV&&curV.src===src){curV.active=false;speechFinishedAt=performance.now()}};return}
  if(!muted&&typeof window!=='undefined'&&window.speechSynthesis&&s.fala&&D.voice!=='none'){
    try{window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(s.fala);window._activeUtterance=u;_currentUtterance=u;u.lang='pt-BR';u.rate=0.98;u.pitch=1.0;
      const vs=window.speechSynthesis.getVoices();const pt=vs.find(v=>v.lang&&v.lang.startsWith('pt')&&(v.name.includes('Natural')||v.name.includes('Google')||v.name.includes('Luciana')||v.name.includes('Felipe')))||vs.find(v=>v.lang&&v.lang.startsWith('pt'));if(pt)u.voice=pt;
      speechActive=true;u.onstart=()=>{speechActive=true};u.onend=()=>{speechActive=false;speechFinishedAt=performance.now()};u.onerror=()=>{speechActive=false;speechFinishedAt=performance.now()};
      setTimeout(()=>{if(playing&&voiceScene===i){try{window.speechSynthesis.speak(u)}catch(e){speechActive=false}}},Math.max(50,Math.round((at-ts)*1000)));
    }catch(e){speechActive=false}}}
function initAudio(){if(AC)return;
  AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=muted?0:.9;
  adest=AC.createMediaStreamDestination();master.connect(AC.destination);master.connect(adest);
  beatG=AC.createGain();beatG.gain.value=.8;beatG.connect(master);vG=AC.createGain();vG.gain.value=1;vG.connect(master);
  nbuf=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;voicesReady=decodeVoices()}
function kick(){const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();
  o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(40,t+.12);
  g.gain.setValueAtTime(.9,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(g);g.connect(beatG);o.start(t);o.stop(t+.3)}
function hat(){const t=AC.currentTime,s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();
  s.buffer=nbuf;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(.22,t);g.gain.exponentialRampToValueAtTime(.001,t+.05);
  s.connect(f);f.connect(g);g.connect(beatG);s.start(t,Math.random()*.5);s.stop(t+.06)}
function whoosh(){const t=AC.currentTime,s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();
  s.buffer=nbuf;f.type='bandpass';f.frequency.setValueAtTime(400,t);f.frequency.exponentialRampToValueAtTime(3500,t+.3);
  g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.35,t+.15);g.gain.exponentialRampToValueAtTime(.001,t+.35);
  s.connect(f);f.connect(g);g.connect(beatG);s.start(t);s.stop(t+.4)}

/* ====================== player ====================== */
let playing=false,recording=false,mr=null,chunks=[],mimeT='',wake=null;
function setPlayLabel(){$('bPlay').innerHTML=playing?'&#9208; Pausar':'&#9654; Play'}
async function keepAwake(){try{if(navigator.wakeLock)wake=await navigator.wakeLock.request('screen')}catch(e){}}
async function play(){initAudio();try{await AC.resume()}catch(e){}try{await voicesReady}catch(e){}
  playing=true;lastNow=performance.now();startVoice(curIdx,curTs);setPlayLabel();keepAwake()}
function pause(){playing=false;stopVoice();setPlayLabel()}
function onEnd(){playing=false;stopVoice();setPlayLabel();if(recording)setTimeout(stopRec,500)}
function tick(now){
  now=now||performance.now();const dt=Math.max(0,Math.min(0.1,(now-lastNow)/1000));lastNow=now;
  if(playing){
    curTs+=dt;totalElapsed+=dt;const curSc=SC[curIdx];const isSpeaking=isVoiceActive(curIdx);
    if(curTs>=curSc.dur){
      if(isSpeaking){curSc.dur=Math.max(curSc.dur,curTs+0.8);DUR=SC.reduce((a,s)=>a+s.dur,0)}
      else{
        curIdx++;curTs=0;
        if(curIdx>=SC.length){curIdx=0;curTs=0;totalElapsed=0;stopVoice();if(recording){stopRec();playing=false}}
        else{whoosh();startVoice(curIdx,0)}
      }
    }
  }
  paint(ctx,curIdx,curTs,totalElapsed);
  if(playing&&AC){
    const h=Math.floor(totalElapsed*BPM/60*2);if(h!==lastHalf){lastHalf=h;if(h%2===0)kick();else hat()}
    const isSpeaking=isVoiceActive(curIdx);beatG.gain.setTargetAtTime(isSpeaking?.2:.8,AC.currentTime,.12)}
  const curSc=SC[curIdx];const totalReelDur=SC.reduce((a,s)=>a+s.dur,0);
  $('hud').textContent=(recording?'● GRAVANDO  ':'')+totalElapsed.toFixed(1)+'s / '+totalReelDur.toFixed(1)+'s  ·  cena '+(curIdx+1)+'/'+SC.length+' ('+curSc.origem+')'+(VB[curIdx]?'  ·  🎙️ TTS':'');
  if(playing)$('seek').value=Math.min(1000,Math.round(totalElapsed/Math.max(0.1,totalReelDur)*1000));
  requestAnimationFrame(tick)}

function fitCanvas(){const st=$('stage'),r=W/H;let w=st.clientWidth,h=st.clientHeight;if(w<=0||h<=0)return;
  if(w/h>r)w=h*r;else h=w/r;cv.style.width=Math.floor(w)+'px';cv.style.height=Math.floor(h)+'px'}
addEventListener('resize',fitCanvas);addEventListener('orientationchange',()=>setTimeout(fitCanvas,150));
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitCanvas).observe($('stage'));

async function startRec(){
  if(recording)return;initAudio();try{await AC.resume()}catch(e){}
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  mimeT=(window.MediaRecorder&&types.find(t=>MediaRecorder.isTypeSupported(t)))||'';
  if(!mimeT){alert('Este navegador não suporta gravação. Use o Chrome atualizado.');return}
  const stream=cv.captureStream(D.fps||30);adest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
  chunks=[];mr=new MediaRecorder(stream,{mimeType:mimeT,videoBitsPerSecond:Math.min(20000000,Math.round(W*H*8))});
  mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  mr.onstop=()=>{const ext=mimeT.indexOf('mp4')>=0?'mp4':'webm',blob=new Blob(chunks,{type:mimeT.split(';')[0]}),url=URL.createObjectURL(blob);
    const name='showreel_'+Date.now()+'.'+ext;$('dl').innerHTML='<a download="'+name+'" href="'+url+'">⬇ Baixar vídeo ('+ext.toUpperCase()+', '+(blob.size/1e6).toFixed(1)+' MB)</a>';
    $('dl').firstChild.click();recording=false;$('bRec').disabled=false;log('gravação pronta: '+ext)};
  recording=true;$('bRec').disabled=true;$('dl').innerHTML='';gt=0;mr.start(500);await play()}
function stopRec(){if(mr&&mr.state!=='inactive')mr.stop()}

$('bPlay').onclick=()=>playing?pause():play();
$('bRest').onclick=()=>{curIdx=0;curTs=0;totalElapsed=0;lastHalf=-1;stopVoice();if(playing)startVoice(0,0)};
$('bSnd').onclick=()=>{muted=!muted;initAudio();master.gain.value=muted?0:.9;$('bSnd').innerHTML=muted?'&#128263; Mudo':'&#128266; Som'};
$('bRec').onclick=startRec;
function saveCode(){
  let out='// Showreel: '+D.title+'\n// DNA: '+D.dna.estilo+' | '+D.dna.structure+' | '+D.dna.transition+' | '+BPM+' bpm\n';
  out+='// Cada cena abaixo e o CORPO de uma funcao (ctx, t, ts, W, H, P, M)\n\n';
  SC.forEach((s,i)=>{out+='// ===== CENA '+(i+1)+' ['+s.role+'] "'+s.text+'" ('+s.origem+', layout '+s.layout+') =====\n';
    out+=(s.code?s.code:'// cena pronta (fallback: '+s.fb+'), sem codigo gerado pelo Gemini')+'\n\n'});
  const b=new Blob([out],{type:'text/javascript'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='showreel_codigo_'+Date.now()+'.js';
  document.body.appendChild(a);a.click();a.remove();log('código salvo (download)')}
$('bCode').onclick=saveCode;
async function saveHTML(){
  let src='';
  try{const r=await fetch(location.href);if(r.ok)src=await r.text()}catch(e){}
  if(!src||src.indexOf('const D=')<0){
    const c=document.documentElement.cloneNode(true),q=x=>c.querySelector(x);
    c.removeAttribute('style');q('#log').textContent='';q('#dl').innerHTML='';q('#hud').textContent='';q('#cv').removeAttribute('style');
    src='<!doctype html>\n'+c.outerHTML}
  const b=new Blob([src],{type:'text/html'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download=(D.title||'showreel').replace(/[^\w\-]+/g,'_')+'.html';
  document.body.appendChild(a);a.click();a.remove();log('HTML completo salvo (download)')}
$('bHtml').onclick=saveHTML;
$('seek').oninput=e=>{
  pause();const p=Number(e.target.value)/1000,total=SC.reduce((a,s)=>a+s.dur,0),tgt=p*total;let acc=0;
  for(let k=0;k<SC.length;k++){if(tgt>=acc&&tgt<acc+SC[k].dur||k===SC.length-1){curIdx=k;curTs=tgt-acc;totalElapsed=tgt;stopVoice();break}acc+=SC[k].dur}
};
log('DNA: '+D.dna.estilo+' | '+D.dna.structure+' | '+D.dna.transition+' | '+BPM+' bpm | energia '+EN+' | tema '+(D.ui_nome||'-')+' | fonte '+(D.dna.fonte&&D.dna.fonte.nome||'-'));
SC.forEach((s,i)=>log((i+1)+'. ['+s.role+'] '+s.text+'  ('+s.origem+', layout '+s.layout+', '+s.dur.toFixed(1)+'s)'));
fitCanvas();requestAnimationFrame(tick);
</script></body></html>
'''

def hsl_hex(h, s, l):
    r, g, b = colorsys.hls_to_rgb(h % 1.0, l, s)
    return "#%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255))

def pasta_saida():
    global OUTPUT_DIR
    for cand in (OUTPUT_DIR, "/tmp/output_reels", "/tmp", os.path.join(os.getcwd(), "output_reels"), "/tmp/showreels"):
        try:
            os.makedirs(cand, exist_ok=True)
            t = os.path.join(cand, ".t")
            open(t, "w").close()
            os.remove(t)
            OUTPUT_DIR = cand
            return cand
        except Exception:
            continue
    raise SystemExit("Não consegui criar uma pasta para salvar os arquivos.")

def ler_json(nome, padrao):
    try:
        with open(os.path.join(OUTPUT_DIR, nome), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return padrao

def gravar_json(nome, dados):
    try:
        with open(os.path.join(OUTPUT_DIR, nome), "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=1)
    except Exception as ex:
        print("(aviso) não consegui salvar", nome, ex)

def make_dna(rng, runs, cfg=None, accent=None):
    ultimos = runs[-2:]
    if cfg:
        structure, trans = cfg["estrutura"], rng.choice(cfg["trans"])
        estilo = (cfg["nome"], cfg["desc"])
        fontes = [f for f in FONTES if f["nome"] in cfg["fontes"]] or FONTES
        bpm, energia = rng.randint(*cfg["bpm"]), rng.randint(*cfg["energia"])
    else:
        structure = rng.choice([x for x in STRUCTURES if x not in [r.get("structure") for r in ultimos]] or STRUCTURES)
        trans = rng.choice([t for t in TRANSITIONS if t not in [r.get("transition") for r in ultimos]] or TRANSITIONS)
        estilo = rng.choice([x for x in STYLES if x[0] not in [r.get("estilo") for r in ultimos]] or STYLES)
        fontes = [f for f in FONTES if f["nome"] not in [r.get("fonte") for r in ultimos]] or FONTES
        bpm, energia = rng.randint(90, 140), rng.randint(2, 5)
    hue = rng.random()
    if runs:
        for _ in range(30):
            if abs(hue - runs[-1].get("hue", 0)) > 0.15:
                break
            hue = rng.random()
    if accent:
        r, g, b = (int(accent[i:i + 2], 16) / 255.0 for i in (1, 3, 5))
        hue = colorsys.rgb_to_hls(r, g, b)[0]
    off = rng.choice([0.5, 0.12, 0.33])
    pal = {"bg1": hsl_hex(hue, 0.55, 0.045), "bg2": hsl_hex(hue + 0.05, 0.6, 0.15),
           "acc": accent or hsl_hex(hue + off, 0.9, 0.58),
           "acc2": hsl_hex(hue + off, 0.85, 0.62) if accent else hsl_hex(hue + off / 2 + 0.08, 0.85, 0.62),
           "fg": "#f5f5f5", "dim": "#b0b0c0"}
    fonte = rng.choice(fontes)
    ui = make_ui(rng, hue, [r_.get("ui") for r_ in ultimos])
    fx = dict(FX_POR_ESTILO.get(estilo[0], FX_PADRAO))
    return {"structure": structure, "transition": trans, "estilo": estilo[0], "estilo_desc": estilo[1],
            "pal": pal, "bpm": bpm, "energy": energia, "hue": hue, "fonte": fonte, "ui": ui, "fx": fx}

CHAVES = []

def _limpar_chave(k):
    return str(k).strip().strip("\"'").strip()

def obter_chaves(chaves_custom=None):
    global CHAVES
    achadas = list(chaves_custom or []) if chaves_custom else list(GEMINI_API_KEYS)
    env = os.environ.get("GEMINI_API_KEYS") or os.environ.get("GEMINI_API_KEY") or ""
    achadas += re.split(r"[,\s;]+", env)
    for cand_file in (os.path.join(_BASE, "chaves.txt"), os.path.join(OUTPUT_DIR, "chaves.txt")):
        try:
            with open(cand_file, "r", encoding="utf-8") as f:
                for linha in f:
                    achadas += re.split(r"[,\s;]+", linha.split("#")[0])
        except Exception:
            pass
    CHAVES = []
    for k in achadas:
        k = _limpar_chave(k)
        if len(k) >= 20 and k not in CHAVES:
            CHAVES.append(k)
    return CHAVES

_rr = 0
_frios = {}

def _escolher_chave(inicio, k):
    n, agora = len(CHAVES), time.time()
    for j in range(n):
        idx = (inicio + k + j) % n
        if _frios.get(idx, 0) <= agora:
            return idx
    idx = min(range(n), key=lambda i: _frios.get(i, 0))
    espera = _frios.get(idx, 0) - agora
    if espera > 0:
        print("  Todas as chaves estão no limite. Aguardando %ds..." % int(espera + 1))
        time.sleep(min(espera + 1, 65))
    return idx

MODELOS = []
_mi = 0
_EXCLUI = ("image", "tts", "live", "audio", "embedding", "computer", "robotics", "vision", "aqa",
           "learnlm", "gemma", "imagen", "veo", "dialog", "customtools", "-exp")

def descobrir_modelos():
    global _TTS_ACHADOS
    nomes, token, tts = [], "", []
    if not CHAVES:
        return []
    for _ in range(5):
        url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200" + (("&pageToken=" + token) if token else "")
        req = urllib.request.Request(url, headers={"x-goog-api-key": CHAVES[0]})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as ex:
            print("  (não consegui listar os modelos: %s)" % ex)
            break
        for m in data.get("models", []):
            nome = str(m.get("name", "")).split("/")[-1]
            if ("generateContent" in m.get("supportedGenerationMethods", []) and nome.startswith("gemini-")
                    and "tts" in nome and not any(x in nome for x in ("live", "dialog"))):
                tts.append(nome)
            if ("generateContent" in m.get("supportedGenerationMethods", []) and nome.startswith("gemini-")
                    and "flash" in nome and not any(x in nome for x in _EXCLUI)):
                nomes.append(nome)
        token = data.get("nextPageToken", "")
        if not token:
            break

    def ordem(n):
        mv = re.match(r"gemini-(\d+(?:\.\d+)?)", n)
        ver = float(mv.group(1)) if mv else 0.0
        return (-ver, "lite" in n, "preview" in n, n)
    _TTS_ACHADOS = sorted(set(tts), key=ordem)
    return sorted(set(nomes), key=ordem)

def preparar_modelos():
    global MODELOS, _mi, MODELOS_TTS, _ti
    _mi = 0
    _ti = 0
    achados = descobrir_modelos() if CHAVES else []
    if achados:
        print("Modelos Gemini disponíveis na sua chave:", ", ".join(achados[:12]))
    padrao = ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-2.5-flash"]
    base = achados[:8] if achados else padrao
    if GEMINI_MODEL and GEMINI_MODEL.lower() != "auto":
        MODELOS = [GEMINI_MODEL] + [m for m in base if m != GEMINI_MODEL]
    else:
        MODELOS = base
    print("Modelo em uso:", MODELOS[0], "(se falhar, troca sozinho)")
    MODELOS_TTS = list(_TTS_ACHADOS) or ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview"]
    if VOZ_ATIVA:
        print("Modelo de voz:", MODELOS_TTS[0], "(se falhar, troca sozinho)")

_PENSAR = True

def gemini(prompt, json_mode=False, temperature=0.9, tries=4, chave=None, pensar=False):
    global _mi, _PENSAR, _rr
    if not CHAVES or not MODELOS:
        return None
    usar_pensar = bool(pensar and _PENSAR and THINK_BUDGET > 0)
    n, k = len(CHAVES), 0
    inicio = (_rr % n) if chave is None else chave
    _rr += 1
    tries = max(tries, min(n + 1, 8))
    while k < tries:
        cfg = {"temperature": temperature, "maxOutputTokens": 24000 if usar_pensar else 8192}
        if usar_pensar:
            cfg["thinkingConfig"] = {"thinkingBudget": THINK_BUDGET}
        if json_mode:
            cfg["responseMimeType"] = "application/json"
        body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": cfg}
        modelo = MODELOS[min(_mi, len(MODELOS) - 1)]
        idx = _escolher_chave(inicio, k)
        print("    (chave %d de %d, modelo %s%s)" % (idx + 1, n, modelo, ", pensando mais" if usar_pensar else ""))
        url = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % modelo
        req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"),
                                     headers={"Content-Type": "application/json",
                                              "x-goog-api-key": CHAVES[idx]})
        try:
            with urllib.request.urlopen(req, timeout=240 if usar_pensar else 120) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            parts = data["candidates"][0]["content"]["parts"]
            txt = "".join(p.get("text", "") for p in parts if not p.get("thought"))
            if txt.strip():
                return txt
            k += 1
        except urllib.error.HTTPError as ex:
            msg = ex.read().decode("utf-8", "ignore")[:1200]
            if ex.code == 400 and usar_pensar and "think" in msg.lower():
                _PENSAR, usar_pensar = False, False
                print("  (este modelo não aceita o modo 'pensar mais'; seguindo sem ele)")
                continue
            sem_modelo = ex.code == 404 or (ex.code == 429 and re.search(r"limit:\s*0\b", msg))
            if sem_modelo and _mi < len(MODELOS) - 1:
                _mi += 1
                print("  Modelo %s indisponível (%s). Trocando para %s" % (modelo, ex.code, MODELOS[_mi]))
                continue
            if ex.code == 429 or ex.code >= 500:
                _frios[idx] = time.time() + 60
                print("  Chave %d ocupada/limite (%s). %s" % (idx + 1, ex.code, "Passando para a próxima chave..." if n > 1 else "Aguardando..."))
                time.sleep(2 if n > 1 else 25 * (k + 1))
                k += 1
                continue
            print("  Erro Gemini (chave %d) %s: %s" % (idx + 1, ex.code, msg[:300]))
            if n > 1 and k < n - 1:
                k += 1
                continue
            return None
        except Exception as ex:
            print("  Erro Gemini:", ex)
            time.sleep(3)
            k += 1
    return None

def pedir_roteiro(user_prompt, dna, runs):
    evitar = "; ".join(str(r.get("title", "")) for r in runs[-3:]) or "nenhum"
    fala_regra = ('- "fala": o que o narrador DIZ nesta cena, em português do Brasil, natural e conversacional, em EXATAMENTE 2 frases curtas: '
                  'a 1ª fala o título (pode reformular) e a 2ª fala o subtítulo/complemento; cerca de 2,4 palavras por segundo (cabe na duração); '
                  'sem siglas difíceis, sem emojis, sem aspas, sem símbolos como < > |\n') if VOZ_ATIVA else ""
    fala_ex = ',"fala":"..."' if VOZ_ATIVA else ""
    p = f"""Você é um diretor de motion design sênior e roteirista de showreels.
{PRIORIDADES}
Crie o roteiro de um showreel vertical (9:16) com duração total entre 18 e 40 segundos para o briefing abaixo.
Estilo visual obrigatório: {dna['estilo']} - {dna['estilo_desc']}.
Estrutura: {dna['structure']}. Energia {dna['energy']}/5. BPM {dna['bpm']}.
Regras: gancho forte na 1ª cena; alterne respiro e explosão; clímax perto do fim; a última cena é o card final.
Use de 7 a 9 cenas. Cada cena tem:
- "role": hook, body, climax ou closing (closing só na última)
- "text": título CURTO em português (máx. 5 palavras, impactante)
- "sub": subtítulo em português (máx. 12 palavras)
- "idea": descrição visual ESPECÍFICA e diferente das outras: herói + como se move + camada de fundo + um detalhe memorável (2-3 frases)
- "duracao": duração da cena em segundos (2 a 5)
{fala_regra}Evite repetir estes títulos recentes: {evitar}.
- "motivo" (campo do JSON principal): um motivo visual recorrente (ex.: "anéis que se expandem") que reaparece, de forma nova, em TODAS as cenas, dando unidade ao reel.
Responda APENAS com JSON: {{"title":"...","motivo":"...","scenes":[{{"role":"hook","text":"...","sub":"...","idea":"...","duracao":3{fala_ex}}}]}}
BRIEFING: {user_prompt}"""
    txt = gemini(p, json_mode=True, temperature=1.0, pensar=True)
    if not txt:
        return None
    try:
        txt = txt.strip().strip("`")
        if txt.lower().startswith("json"):
            txt = txt[4:]
        plan = json.loads(txt)
        return plan if isinstance(plan, dict) and plan.get("scenes") else None
    except Exception as ex:
        print("  Roteiro inválido:", ex)
        return None

M_API = """M (biblioteca pronta, NÃO redefina):
 MATEMÁTICA: M.clamp(x,a,b) M.lerp(a,b,t) M.map(x,a,b,c,d) M.p(ts,início,duração)->0..1  M.stagger(ts,i,início,intervalo,duração)->0..1
   M.count(ts,início,dur,de,para,'outExpo')->número  M.noise(x,y)->-1..1  M.shake(ts,amp,freq)->{x,y}  M.rng(seed)->função 0..1 determinística
 EASING (entrada 0..1; use M.p antes): M.ease.outExpo|outCubic|inCubic|inOutCubic|inOutQuint|outBack|outElastic   M.spring(x)
 COR: M.col(hex,alpha)->'rgba()'  M.mixc(hex1,hex2,t)->'rgb()'  M.glow(ctx,cor,blur) (use dentro de ctx.save()/ctx.restore())
 FORMAS (montam o caminho; depois use ctx.fill()/ctx.stroke()): M.rrect(ctx,x,y,w,h,r) M.poly(ctx,cx,cy,r,lados,rot) M.star(ctx,cx,cy,r,pontas,interno,rot) M.blob(ctx,cx,cy,r,ts,seed,amt)
 DESENHO PROGRESSIVO: M.path(ctx,[[x,y],...],progresso0a1,{width,color,glow})  M.arc(ctx,cx,cy,r,progresso0a1,{width,color,glow})
 AMBIENTE: M.particles(ctx,W,H,P,ts,{n,size,speed,alpha,area:{x,y,w,h},colors,seed})  M.floor(ctx,W,H,ts,{horizon:0..1,color,alpha,speed,lines})  M.deco(ctx,W,H,P,ts)
 3D: M.rot3([x,y,z],ax,ay,az)->[x,y,z]   M.proj([x,y,z],W,H,fov,cx,cy)->{x,y,s}
 TEXTO: M.text(ctx,str,x,y,size,{color,alpha,weight,align,rot,glow,stroke,spacing,shadow:false,layer:true})  M.fit(ctx,str,maxW,tamanhoMax)->tamanho  M.lines(str,maxChars)->linhas
   M.titleChars(ctx,W,H,P,ts,{effect:'rise'|'drop'|'scale'|'spin',stagger,start,color,glow})  (RECOMENDADO: escreve P.text letra por letra na zona de texto, em várias linhas se preciso)
   M.mainText(ctx,W,H,P,ts,{scale,alpha})  (P.text na zona de texto, sem animação por letra)   M.textChars(ctx,str,cx,cy,size,ts,{effect,start,stagger,dur,color,colors,glow}) (uma linha)
   M.text/M.titleChars já impedem texto fora da tela e texto sobre texto; layer:true só para duplicar de propósito (ex.: glitch RGB)
 P: {text, role, seed, pulse (batida 0..1 agora), voice (volume da narração agora 0..1: reaja a ele), say (texto falado), bpm, energy 1-5, layout, pal:{bg1,bg2,acc,acc2,fg,dim}, zones:{main,art,safe,sub} cada {x,y,w,h,cx,cy} em pixels}.  Batida = 60/P.bpm segundos."""

GUIA_MOTION = """GUIA DE QUALIDADE (trabalhe como um motion designer sênior de estúdio; esforce-se ao máximo):
- HIERARQUIA: 1 elemento HERÓI grande (cerca de 50% da zona de arte), 2-4 elementos de apoio menores, e detalhes finos (linhas, pontos, números, marcas de registro). Contraste de escala de pelo menos 5:1 entre herói e detalhes.
- MOVIMENTO: nunca linear. Entrada com antecipação (recuo curto antes de avançar) e overshoot (M.ease.outBack, M.spring, M.ease.outElastic). Use M.stagger entre elementos de um grupo. Movimento secundário: elementos de apoio seguem o herói com atraso (use ts-0.08). Combine pelo menos 3 tipos de movimento (translação, escala, rotação, traço que se desenha, opacidade).
- VIDA ATÉ O FIM: a cena nunca congela. Mantenha deriva lenta, rotação lenta ou respiração de escala (1±0.02) até o último frame. NÃO faça fade-out no fim (o motor faz a transição).
- RITMO: acentue a batida com P.pulse (escala/brilho/anel que expande) e organize as fases em múltiplos de 60/P.bpm segundos.
- PROFUNDIDADE: 3 planos: fundo (lento, translúcido), meio (herói), frente (rápido, nítido). Parallax por velocidades diferentes, glow nos destaques, escala por profundidade (M.proj).
- TIPOGRAFIA: título com M.titleChars (ou M.mainText); uma palavra/linha na cor de destaque; legendas e números pequenos como acabamento; texto sempre legível (contraste, sombra).
- COR: só a paleta e transparências; cor de destaque (acc) em no máximo 15% da área; fundo escuro mantém contraste.
- COMPOSIÇÃO: assimetria equilibrada, espaço negativo, regra dos terços; nada encostando nas bordas da zona segura.
- ACABAMENTO: micro-detalhes (cantos, marcas, partículas M.particles, linhas M.path/M.arc que se desenham), variações determinísticas com M.rng(P.seed).
- ZONAS: o herói fica em P.zones.art e o texto em P.zones.main. Se P.layout==='centro', a arte é só fundo translúcido atrás do texto.
- NARRAÇÃO: quando P.voice existe (>0 durante a fala), faça o herói pulsar/brilhar com ele (ex.: escala 1+P.voice*0.06) para a imagem "falar" junto com a voz; acentue visualmente a palavra-chave quando ela é dita.
- O motor já aplica câmera (push-in lento e tremor na batida) e grão de filme: NÃO faça zoom global nem ruído global.
ERROS COMUNS (evite): círculo parado com texto; elementos que aparecem sem easing; cena que só faz fade; muitos retângulos iguais; tudo centralizado e simétrico; copiar o exemplo; texto sobre texto; pixels fixos."""

RECEITAS = {
    "tipografia cinética": "palavras gigantes entrando em cascata (M.titleChars), troca dramática de escala entre palavras, números que contam (M.count), palavra-chave em cor de destaque com glow, filetes e setas que se desenham (M.path)",
    "glitch digital": "fatias horizontais deslocadas, aberração cromática (o mesmo texto em 3 cores, layer:true, levemente deslocado), scanlines, blocos de ruído que piscam em cortes curtos, contadores e códigos hexadecimais, o sinal 'quebra' no clímax",
    "minimalista elegante": "muito espaço negativo, linhas finíssimas que se desenham (M.path/M.arc), um único herói com movimento lento e preciso (inOutQuint), círculos concêntricos suaves, tipografia leve e espaçada, micro-detalhes discretos",
    "3D em perspectiva": "objetos 3D com M.rot3/M.proj (cubos, esfera de pontos, túneis, anéis), câmera orbitando, profundidade por tamanho e alpha em z, brilho (glow), piso em perspectiva (M.floor)",
    "grid dinâmico": "painéis que se revelam em onda (M.stagger), colagem assimétrica de blocos de tamanhos diferentes, barras e gráficos que crescem, grade fina, números e legendas pequenas nos cantos de cada bloco",
    "líquido orgânico": "blobs com ruído (M.blob) sobrepostos e translúcidos, ondas senoidais com fase animada, gotas que se fundem, movimento fluido com spring/outElastic, gradientes suaves, partículas lentas",
    "neon synthwave": "sol listrado no horizonte, piso de grade (M.floor), linhas neon com glow forte, formas wireframe, estrelas/partículas, texto com glow e contorno",
    "blueprint técnico": "wireframes, linhas de cota com setas e medidas, cruzes de registro, círculos tracejados, anotações pequenas, formas desenhadas traço a traço (M.path), números técnicos animados",
    "minimalista e elegante": "muito espaço negativo, linhas finíssimas que se desenham (M.path/M.arc), um único herói com movimento lento e preciso (inOutQuint), círculos concêntricos suaves, tipografia leve e espaçada, micro-detalhes discretos",
    "cinematográfico e dramático": "contraste forte de luz e sombra, poeira em partículas lentas, formas grandes que se revelam devagar (inOutQuint), feixe de luz que varre a cena, tipografia enorme entrando com calma, uma quebra de ritmo no clímax",
    "futurista e tecnológico": "interface HUD com anéis (M.arc) e marcações, esfera de pontos 3D girando, linhas de scan, painéis com dados que contam (M.count), brilho neon, elementos que se montam peça por peça",
    "colorido e energético": "formas geométricas vibrantes explodindo em stagger (star/poly/rrect), elasticidade (outElastic/outBack), anéis de batida, confete/partículas rápidas, cortes rápidos de escala, texto grande com overshoot",
    "editorial e tipográfico": "tipografia como protagonista, grid editorial com filetes, números gigantes, composição assimétrica, legendas pequenas em caixa-alta espaçada, movimento preciso e elegante",
}
EX_POR_ESTILO = {
    "tipografia cinética": "tipografia", "editorial e tipográfico": "tipografia", "minimalista elegante": "tipografia",
    "minimalista e elegante": "tipografia", "3D em perspectiva": "hud3d", "blueprint técnico": "hud3d", "neon synthwave": "hud3d",
    "futurista e tecnológico": "hud3d", "glitch digital": "hud3d", "grid dinâmico": "geometria", "líquido orgânico": "geometria",
    "colorido e energético": "geometria", "cinematográfico e dramático": "geometria",
}
EXEMPLOS = {
    "tipografia": r"""const z=P.zones,A=z.art,R=M.rng(P.seed);
M.particles(ctx,W,H,P,ts,{n:60,size:4,alpha:.45});
for(let i=0;i<5;i++){const y=A.y+A.h*(i/4),p=M.stagger(ts,i,.05,.07,.6),w=A.w*M.ease.outExpo(p)*(.45+R()*.55);
  ctx.fillStyle=M.col(i%2?P.pal.acc:P.pal.acc2,.2+.5*p);ctx.fillRect(A.x,y,w,Math.max(3,H*.004));}
const n=Math.round(M.count(ts,.1,1.4,0,97)),big=M.fit(ctx,n+'%',A.w*.8,A.h*.5),sh=M.shake(ts,W*.004*P.pulse);
M.text(ctx,n+'%',A.cx+sh.x,A.cy+sh.y+(1-M.ease.outBack(M.p(ts,0,.6)))*H*.05,big*(1+P.pulse*.04),{color:P.pal.acc,glow:P.pal.acc,alpha:M.p(ts,0,.25)});
M.arc(ctx,A.cx,A.cy,Math.min(A.w,A.h)*.46,M.ease.inOutCubic(M.p(ts,.2,1.2)),{width:W*.006,color:P.pal.fg,glow:P.pal.acc});
M.titleChars(ctx,W,H,P,ts,{effect:'rise'});""",
    "hud3d": r"""const z=P.zones,A=z.art,R=M.rng(P.seed),e=M.ease.outExpo(M.p(ts,0,.9)),cx=A.cx,cy=A.cy,s=Math.min(A.w,A.h)*.2*e;
M.floor(ctx,W,H,ts,{horizon:(A.y+A.h*.62)/H,color:P.pal.acc2,alpha:.3,speed:.4});
const pts=[];for(let i=0;i<140;i++){const u=R()*Math.PI*2,v=Math.acos(2*R()-1);pts.push([Math.sin(v)*Math.cos(u),Math.sin(v)*Math.sin(u),Math.cos(v)]);}
const ry=ts*.7+P.pulse*.2,rx=.5+Math.sin(ts*.5)*.2;
pts.map(p=>{const q=M.rot3([p[0]*s*1.6,p[1]*s*1.6,p[2]*s*1.6],rx,ry,0);return{q:q,pr:M.proj(q,W,H,900,cx,cy)};})
  .sort((a,b)=>b.q[2]-a.q[2]).forEach((o,i)=>{const d=M.clamp(1-(o.q[2]+s*1.6)/(s*3.2));
    ctx.fillStyle=M.col(i%7?P.pal.fg:P.pal.acc,.25+.75*d);ctx.beginPath();ctx.arc(o.pr.x,o.pr.y,(2+4*d)*o.pr.s*(W/720),0,7);ctx.fill();});
for(let k=0;k<3;k++)M.arc(ctx,cx,cy,s*(2.1+k*.35),M.ease.inOutCubic(M.p(ts,.15+k*.12,1)),{width:W*.004,color:k%2?P.pal.acc:P.pal.acc2,glow:P.pal.acc});
for(let k=0;k<8;k++){const a=k/8*Math.PI*2+ts*.3,r1=s*2.55,r2=s*(2.55+(k%2?.12:.2));
  ctx.strokeStyle=M.col(P.pal.dim,.7);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);ctx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2);ctx.stroke();}
M.text(ctx,'SYS '+String(Math.floor(M.count(ts,0,1.5,0,9999))).padStart(4,'0'),A.x+A.w*.08,A.y+A.h*.06,W*.032,{color:P.pal.dim,align:'left',shadow:false,weight:600});
M.titleChars(ctx,W,H,P,ts,{effect:'scale'});""",
    "geometria": r"""const z=P.zones,A=z.art,R=M.rng(P.seed),beat=60/P.bpm,bp=(ts%beat)/beat,m=Math.min(A.w,A.h);
for(let i=0;i<3;i++){M.blob(ctx,A.cx+(R()-.5)*A.w*.5,A.cy+(R()-.5)*A.h*.4,m*(.28+i*.08),ts+i*3,P.seed+i,.3);ctx.fillStyle=M.col(i%2?P.pal.acc:P.pal.acc2,.16);ctx.fill();}
const n=9;
for(let i=0;i<n;i++){const a=i/n*Math.PI*2+ts*.4,p=M.stagger(ts,i,0,.06,.7),e=M.ease.outBack(p),r=m*(.12+.3*e)*(1+P.pulse*.05),
    x=A.cx+Math.cos(a)*r*1.1,y=A.cy+Math.sin(a)*r*1.1,sz=m*.07*Math.max(0,e);
  ctx.save();ctx.translate(x,y);ctx.rotate(a*2+ts);ctx.fillStyle=M.col(i%2?P.pal.acc:P.pal.acc2,.95);
  if(i%3===0)M.star(ctx,0,0,sz,5,.45,0);else if(i%3===1)M.rrect(ctx,-sz/2,-sz/2,sz,sz,sz*.25);else M.poly(ctx,0,0,sz*.8,3,0);
  ctx.fill();ctx.restore();}
const core=m*.14*M.ease.outElastic(M.p(ts,.05,.8))*(1+P.pulse*.12+P.voice*.1);
ctx.save();M.glow(ctx,P.pal.acc,core*.6);ctx.fillStyle=P.pal.acc;ctx.beginPath();ctx.arc(A.cx,A.cy,core,0,7);ctx.fill();ctx.restore();
ctx.strokeStyle=M.col(P.pal.fg,.6*(1-bp));ctx.lineWidth=W*.004;ctx.beginPath();ctx.arc(A.cx,A.cy,core*(1.4+bp*2.4),0,7);ctx.stroke();
M.particles(ctx,W,H,P,ts,{n:40,size:5,speed:1.5,area:A});
M.titleChars(ctx,W,H,P,ts,{effect:'spin',glow:P.pal.acc2});""",
}
FX_PADRAO = {"grain": .04, "push": .03, "shake": .004, "bars": 0}
FX_POR_ESTILO = {
    "minimalista e elegante": {"grain": .02, "push": .02, "shake": .0015, "bars": 0},
    "minimalista elegante": {"grain": .02, "push": .02, "shake": .0015, "bars": 0},
    "cinematográfico e dramático": {"grain": .07, "push": .06, "shake": .003, "bars": .065},
    "futurista e tecnológico": {"grain": .04, "push": .035, "shake": .005, "bars": 0},
    "colorido e energético": {"grain": .02, "push": .04, "shake": .008, "bars": 0},
    "editorial e tipográfico": {"grain": .03, "push": .015, "shake": .002, "bars": 0},
    "glitch digital": {"grain": .06, "push": .03, "shake": .009, "bars": 0},
    "neon synthwave": {"grain": .05, "push": .04, "shake": .004, "bars": 0},
    "blueprint técnico": {"grain": .03, "push": .02, "shake": .002, "bars": 0},
}

PROIBIDO = ["fetch(", "XMLHttpRequest", "document.", "window.", "eval(", "import(", "localStorage",
            "WebSocket", "navigator.", "require(", "Function("]

VOZES = [("Kore", "firme e clara"), ("Puck", "animada"), ("Charon", "informativa e grave"),
         ("Aoede", "leve e suave"), ("Sulafat", "calorosa")]
MODELOS_TTS = []
_ti = 0
_TTS_ACHADOS = []
ESTILO_VOZ = {
    "minimalista e elegante": "calm, soft and elegant, unhurried",
    "minimalista elegante": "calm, soft and elegant, unhurried",
    "cinematográfico e dramático": "deep, dramatic and measured, with gravitas",
    "futurista e tecnológico": "confident, crisp and modern",
    "colorido e energético": "upbeat, energetic and enthusiastic",
    "editorial e tipográfico": "clear, articulate and refined, like a magazine narrator",
}
ESTILO_VOZ_PADRAO = "natural, warm and engaging, like a professional narrator"

def _tts_schema_novo(modelo):
    m = re.match(r"gemini-(\d+)(?:\.(\d+))?", modelo)
    return bool(m) and (int(m.group(1)), int(m.group(2) or 0)) >= (3, 8)

def _corpo_tts(frases, estilo, novo):
    if novo:
        return {"contents": [{"role": "user", "parts": [{"text": " <short pause> ".join(frases),
                                                          "speech_metadata": {"style": estilo}}]}],
                "generationConfig": {"responseModalities": ["AUDIO"],
                                     "speechConfig": {"voiceConfig": {"voice": VOZ_NOME}}}}
    texto = "Say in Brazilian Portuguese, in a %s tone: %s" % (estilo, " ".join(frases))
    return {"contents": [{"parts": [{"text": texto}]}],
            "generationConfig": {"responseModalities": ["AUDIO"],
                                 "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOZ_NOME}}}}}

def _pcm_de_resposta(mime, b64):
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return None
    rate = 24000
    m = re.search(r"rate=(\d+)", mime or "")
    if m:
        rate = int(m.group(1))
    if raw[:4] == b"RIFF":
        try:
            with wave.open(io.BytesIO(raw)) as w:
                ch, sw, rate = w.getnchannels(), w.getsampwidth(), w.getframerate()
                pcm = w.readframes(w.getnframes())
            if sw != 2:
                return None
            if ch == 2:
                a = array.array("h")
                a.frombytes(pcm[: len(pcm) // 4 * 4])
                pcm = a[::2].tobytes()
            return pcm, rate
        except Exception:
            i = raw.find(b"data")
            return (raw[i + 8:], rate) if i >= 0 else None
    return raw, rate

def gemini_tts(frases, estilo):
    global _ti, _rr
    if not CHAVES or not MODELOS_TTS:
        return None
    n, k = len(CHAVES), 0
    inicio = _rr % n
    _rr += 1
    tries, inverte = max(4, min(n + 1, 8)), False
    while k < tries:
        modelo = MODELOS_TTS[min(_ti, len(MODELOS_TTS) - 1)]
        novo = _tts_schema_novo(modelo) != inverte
        idx = _escolher_chave(inicio, k)
        print("    (voz: chave %d de %d, modelo %s)" % (idx + 1, n, modelo))
        url = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % modelo
        req = urllib.request.Request(url, data=json.dumps(_corpo_tts(frases, estilo, novo)).encode("utf-8"),
                                     headers={"Content-Type": "application/json", "x-goog-api-key": CHAVES[idx]})
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            for part in data["candidates"][0]["content"]["parts"]:
                inl = part.get("inlineData") or part.get("inline_data")
                if inl:
                    r = _pcm_de_resposta(inl.get("mimeType") or inl.get("mime_type"), inl.get("data", ""))
                    if r:
                        return r
            k += 1
        except urllib.error.HTTPError as ex:
            msg = ex.read().decode("utf-8", "ignore")[:1200]
            if ex.code == 400 and not inverte:
                inverte = True
                print("  (formato do pedido de voz não aceito; tentando o formato alternativo)")
                continue
            sem_modelo = ex.code == 404 or (ex.code == 429 and re.search(r"limit:\s*0\b", msg))
            if sem_modelo and _ti < len(MODELOS_TTS) - 1:
                _ti += 1
                inverte = False
                print("  Modelo de voz %s indisponível (%s). Trocando para %s" % (modelo, ex.code, MODELOS_TTS[_ti]))
                continue
            if ex.code == 429 or ex.code >= 500:
                _frios[idx] = time.time() + 60
                print("  Chave %d ocupada/limite (%s). Passando para a próxima..." % (idx + 1, ex.code))
                time.sleep(2 if n > 1 else 25 * (k + 1))
                k += 1
                continue
            print("  Erro na voz (chave %d) %s: %s" % (idx + 1, ex.code, msg[:200]))
            k += 1
        except Exception as ex:
            print("  Erro na voz:", ex)
            time.sleep(3)
            k += 1
    return None

def analisar_voz(pcm, rate, n_frases):
    a = array.array("h")
    a.frombytes(pcm[: len(pcm) // 2 * 2])
    if sys.byteorder == "big":
        a.byteswap()
    win = max(1, int(rate * 0.02))
    n = len(a) // win
    if n < 5:
        return None
    rms = [math.sqrt(sum(x * x for x in a[i * win:(i + 1) * win]) / win) for i in range(n)]
    p95 = sorted(rms)[int(0.95 * (n - 1))] or 1.0
    thr = max(0.07 * p95, 25.0)
    voz = [i for i, v in enumerate(rms) if v > thr]
    if not voz:
        return None
    ini, fim = max(0, voz[0] - 3), min(n, voz[-1] + 9)
    rms_t, m = rms[ini:fim], fim - ini
    seg = a[ini * win:fim * win]
    if sys.byteorder == "big":
        seg.byteswap()
    gaps, i = [], 0
    while i < m:
        if rms_t[i] <= thr:
            j = i
            while j < m and rms_t[j] <= thr:
                j += 1
            if i > 2 and j < m - 2 and (j - i) >= 7:
                gaps.append((i, j - i))
            i = j
        else:
            i += 1
    cortes = []
    if n_frases > 1 and gaps:
        top = sorted(sorted(gaps, key=lambda g: -g[1])[: n_frases - 1])
        cortes = [(g[0] + g[1]) * 0.02 - 0.05 for g in top]
    env = []
    for q in range(0, m, 2):
        v = (rms_t[q] + (rms_t[q + 1] if q + 1 < m else rms_t[q])) / 2.0
        env.append(int(max(0.0, min(1.0, v / p95)) * 100))
    return {"pcm": seg.tobytes(), "dur": m * win / float(rate), "env": env, "cortes": cortes}

def pcm_para_wav(pcm, rate):
    buf = io.BytesIO()
    w = wave.open(buf, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(rate)
    w.writeframes(pcm)
    w.close()
    return buf.getvalue()

def gerar_narracao(dna, scenes, callback=None):
    audios = {}
    estilo = ESTILO_VOZ.get(dna["estilo"], ESTILO_VOZ_PADRAO)
    print("\nGerando a narração (voz %s)..." % VOZ_NOME)
    if callback:
        callback({"step": "tts_start", "voice": VOZ_NOME, "total": len(scenes)})
    for i, sc in enumerate(scenes):
        frases = [f.strip() for f in re.split(r"(?<=[.!?…])\s+", sc.get("fala") or "") if f.strip()]
        if not frases:
            continue
        print("Narração %d/%d: %s" % (i + 1, len(scenes), " ".join(frases)[:80]))
        if callback:
            callback({"step": "tts_scene", "index": i + 1, "total": len(scenes), "text": " ".join(frases)[:80]})
        r = gemini_tts(frases, estilo)
        info = analisar_voz(r[0], r[1], len(frases)) if r else None
        if not info:
            print("  (sem áudio nesta cena)")
            continue
        dur, cortes = info["dur"], info["cortes"]
        if len(frases) > 1 and len(cortes) < len(frases) - 1:
            total, acum, cortes = float(sum(len(f) for f in frases)), 0, []
            for f in frases[:-1]:
                acum += len(f)
                cortes.append(dur * acum / total)
        sc["voice_at"] = VOICE_AT
        sc["audio_dur"] = round(dur, 2)
        sc["env"] = info["env"]
        sc["audio"] = base64.b64encode(pcm_para_wav(info["pcm"], r[1])).decode("ascii")
        sc["sub_at"] = round(max(VOICE_AT + 0.3, VOICE_AT + (cortes[0] - 0.1 if cortes else dur * 0.55)), 2)
        sc["dur"] = round(max(sc["dur"], VOICE_AT + dur + 0.55), 2)
        audios[i] = {"pcm": info["pcm"], "rate": r[1]}
        _pausa()
    return audios

def montar_trilha(scenes, audios):
    taxas = {a["rate"] for a in audios.values()}
    if not audios or len(taxas) != 1:
        return None
    rate = taxas.pop()
    buf = bytearray(int(sum(sc["dur"] for sc in scenes) * rate) * 2 + 4)
    t = 0.0
    for i, sc in enumerate(scenes):
        a = audios.get(i)
        if a:
            off = int((t + sc.get("voice_at", VOICE_AT)) * rate) * 2
            seg = a["pcm"][: max(0, len(buf) - off)]
            buf[off:off + len(seg)] = seg
        t += sc["dur"]
    return pcm_para_wav(bytes(buf), rate)

def _linha_voz(sc):
    if not sc.get("audio"):
        return ""
    return ('- Narração (voz humana) desta cena: "%s" - a voz começa em %.2fs e dura %.1fs; o subtítulo aparece quando a 2ª frase começa (~%.2fs). '
            'Sincronize a coreografia com a fala: momentos-chave nas palavras importantes e use P.voice para pulsar o herói junto com a voz.'
            % (sc.get("fala", ""), sc["voice_at"], sc["audio_dur"], sc["sub_at"]))

def _fmt(tpl, **kw):
    for k, v in kw.items():
        tpl = tpl.replace("<<%s>>" % k, str(v))
    return tpl

def _pausa():
    time.sleep(PAUSA_ENTRE_CHAMADAS / max(1, len(CHAVES)))

def _balanceado(code):
    pilha, i, n = [], 0, len(code)
    par = {")": "(", "]": "[", "}": "{"}
    while i < n:
        c = code[i]
        if c in "'\"`":
            q = c
            i += 1
            while i < n and code[i] != q:
                i += 2 if code[i] == "\\" else 1
        elif c == "/" and i + 1 < n and code[i + 1] == "/":
            while i < n and code[i] != "\n":
                i += 1
        elif c == "/" and i + 1 < n and code[i + 1] == "*":
            j = code.find("*/", i + 2)
            i = n if j < 0 else j + 1
        elif c in "([{":
            pilha.append(c)
        elif c in ")]}":
            if not pilha or pilha.pop() != par[c]:
                return False
        i += 1
    return not pilha

def extrair_codigo(txt):
    if not txt:
        return None
    m = re.search(r"```(?:javascript|js)?\s*\n(.*?)```", txt, re.S)
    code = m.group(1) if m else txt
    code = re.sub(r"^\s*```[a-zA-Z]*\s*\n", "", code.strip())
    code = re.sub(r"\n```\s*$", "", code).strip()
    if len(code) < 40 or len(code) > 30000:
        return None
    if any(b in code for b in PROIBIDO):
        print("  (código com chamada proibida, descartado)")
        return None
    if not _balanceado(code):
        print("  (código veio cortado/desbalanceado, descartado)")
        return None
    return code

def _json_de(txt):
    try:
        t = txt.strip().strip("`")
        if t.lower().startswith("json"):
            t = t[4:]
        return json.loads(t)
    except Exception:
        return None

def pedir_briefing(dna, sc, idx, total, anterior):
    tpl = """Você é diretor de arte de motion design. Crie o BRIEFING DE COREOGRAFIA de UMA cena de showreel (NÃO escreva código).
<<PRIORIDADES>>
- Estilo: <<estilo>> - <<estilo_desc>>.
- Receita do estilo: <<receita>>
- Motivo visual recorrente do reel (deve reaparecer, de forma nova): <<motivo>>
- Cena <<n>> de <<total>>, papel: <<role>>. Duração <<dur>>s. BPM <<bpm>> (uma batida = <<beat>>s). Texto principal: "<<text>>".
- Ideia inicial: <<idea>>
<<voz>>
- <<layout>>
- Cena anterior (não repita): <<anterior>>
Papéis: hook = impacto nos primeiros 0,5s; body = desenvolve com clareza e ritmo; climax = maior energia, quebra de escala ou de ritmo; closing = assinatura final elegante e mais calma.
Seja específico e original: nada de "círculo com texto". Pense em um momento memorável.
Responda APENAS com JSON:
{"conceito":"1-2 frases","heroi":"elemento principal e como se move","apoio":["2-4 elementos de apoio e seus movimentos"],"fundo":"camada de fundo lenta e translúcida","detalhes":["3-5 micro-detalhes de acabamento"],"coreografia":[{"t":"0.0-0.4s","acao":"..."},{"t":"0.4-1.2s","acao":"..."},{"t":"1.2s-fim","acao":"..."}],"ritmo":"como a batida é usada","surpresa":"um momento memorável"}"""
    p = _fmt(tpl, PRIORIDADES=PRIORIDADES, estilo=dna["estilo"], estilo_desc=dna["estilo_desc"],
             receita=RECEITAS.get(dna["estilo"], ""), motivo=dna.get("motivo") or "livre", n=idx + 1, total=total,
             role=sc["role"], dur="%.1f" % sc["dur"], bpm=dna["bpm"], beat="%.2f" % (60.0 / dna["bpm"]),
             text=sc["text"], idea=sc.get("idea") or "livre", layout=descrever_layout(sc.get("layout", "centro")),
             anterior=anterior or "nenhuma", voz=_linha_voz(sc))
    brief = _json_de(gemini(p, json_mode=True, temperature=1.0, pensar=True) or "")
    return brief if isinstance(brief, dict) else None

def pedir_cena(dna, sc, idx, total, anterior, brief=None):
    pal = dna["pal"]
    exemplo = EXEMPLOS[EX_POR_ESTILO.get(dna["estilo"], "geometria")]
    brief_txt = ("BRIEFING DE COREOGRAFIA (implemente fielmente, cada fase no tempo indicado):\n"
                 + json.dumps(brief, ensure_ascii=False, indent=1)) if brief else ""
    tpl = """Você é um motion designer sênior que escreve JavaScript para Canvas 2D.
<<PRIORIDADES>>
Escreva SOMENTE o CORPO de uma função (sem a palavra function, sem markdown, sem explicações), com estes parâmetros disponíveis:
(ctx, t, ts, W, H, P, M)
- ctx: CanvasRenderingContext2D, tela vertical W x H (<<W>>x<<H>>). O fundo em gradiente JÁ foi pintado.
- t: progresso da cena 0..1. ts: segundos desde o início da cena. P.dur: duração da cena em segundos.
- Paleta (hex): bg1=<<bg1>> bg2=<<bg2>> acc=<<acc>> acc2=<<acc2>> fg=<<fg>> dim=<<dim>>  (use via P.pal.*)
- <<M_API>>
REGRAS TÉCNICAS:
1. A cena é uma função PURA de ts: sem estado, sem Date/performance.now, sem Math.random (use M.rng(P.seed)).
2. Toda posição/tamanho vem de W, H ou das zonas P.zones (nunca pixels fixos). Desenhe o texto POR ÚLTIMO.
3. NÃO desenhe o subtítulo (o motor desenha). O texto principal "<<text>>" (P.text) DEVE aparecer legível via M.titleChars/M.mainText/M.text.
4. Só as cores da paleta (e transparências). Mantenha ctx.save()/ctx.restore() equilibrados.
5. Leve: no máximo ~1500 formas por frame. Sem imagens, DOM, rede ou bibliotecas.
<<GUIA>>
RECEITAS DO ESTILO (<<estilo>>): <<receita>>
<<brief>>
CONTEXTO:
- Estilo do reel: <<estilo>> - <<estilo_desc>>. Tipografia do reel: <<fonte>> (M.text já usa).
- Motivo visual recorrente do reel (reapareça com ele de forma nova): <<motivo>>
- Cena <<n>> de <<total>>, papel: <<role>>. Duração aprox. <<dur>>s. BPM <<bpm>>.
- Ideia visual desta cena: <<idea>>
<<voz>>
- <<layout>>
- Se a ideia conflitar com as zonas, ADAPTE a ideia às zonas (as zonas mandam).
- Cena anterior (NÃO repita): <<anterior>>
EXEMPLO DE NÍVEL DE ACABAMENTO (outro conceito; NÃO copie: iguale ou supere):
<<exemplo>>
EXIGÊNCIAS FINAIS: entre 45 e 140 linhas, rico em detalhes, reagindo à batida, com herói, apoio, fundo e acabamento. Esforce-se ao máximo: a cena precisa parecer feita por um estúdio profissional.
Agora escreva o corpo da função da cena."""
    p = _fmt(tpl, PRIORIDADES=PRIORIDADES, W=WIDTH, H=HEIGHT, bg1=pal["bg1"], bg2=pal["bg2"], acc=pal["acc"], acc2=pal["acc2"],
             fg=pal["fg"], dim=pal["dim"], M_API=M_API, text=sc["text"], GUIA=GUIA_MOTION, estilo=dna["estilo"],
             estilo_desc=dna["estilo_desc"], receita=RECEITAS.get(dna["estilo"], ""), brief=brief_txt,
             fonte=dna["fonte"]["nome"], motivo=dna.get("motivo") or "livre", n=idx + 1, total=total, role=sc["role"],
             dur="%.1f" % sc["dur"], bpm=dna["bpm"], idea=sc.get("idea") or "livre",
             layout=descrever_layout(sc.get("layout", "centro")), anterior=anterior or "nenhuma", exemplo=exemplo, voz=_linha_voz(sc))
    return extrair_codigo(gemini(p, temperature=0.8, pensar=True))

def refinar_cena(dna, sc, code, brief=None):
    tpl = """Você é um revisor sênior de motion design e de JavaScript Canvas 2D. Abaixo está o código (corpo de função com parâmetros ctx, t, ts, W, H, P, M) de uma cena de showreel.
Devolva a VERSÃO FINAL COMPLETA, melhorada: SOMENTE o corpo da função, sem markdown e sem explicações.
<<PRIORIDADES>>
CHECKLIST (corrija e melhore tudo que falhar):
1. Erros de sintaxe/execução; valores NaN; uso de variáveis inexistentes; uso de funções que não estão na API abaixo.
2. Pixels fixos (use W, H, P.zones); elementos fora das zonas/zona segura; texto sobre texto; formas opacas cobrindo texto.
3. Movimentos lineares ou sem easing; falta de antecipação/overshoot; falta de stagger; momentos em que a cena fica parada.
4. Falta de camadas (fundo, herói, apoio, acabamento); contraste fraco; pouca hierarquia de escala.
5. Não reage à batida (P.pulse); sem micro-detalhes; sem um momento memorável.
6. O título (P.text) precisa estar legível; não desenhe o subtítulo; sem fade-out no fim.
Mantenha o que já funciona e enriqueça com polimento. Estilo: <<estilo>>. Papel da cena: <<role>>. Duração <<dur>>s.
<<brief>>
API disponível:
<<M_API>>
CÓDIGO ATUAL:
<<code>>"""
    brief_txt = ("COREOGRAFIA PEDIDA (garanta que está implementada):\n" + json.dumps(brief, ensure_ascii=False)) if brief else ""
    p = _fmt(tpl, PRIORIDADES=PRIORIDADES, estilo=dna["estilo"], role=sc["role"], dur="%.1f" % sc["dur"],
             brief=brief_txt, M_API=M_API, code=code)
    return extrair_codigo(gemini(p, temperature=0.4, pensar=True))

def gerar_cena_com_esforco(dna, sc, idx, total, anterior, callback=None):
    etapas = 3 if NIVEL_ESFORCO >= 3 else (2 if NIVEL_ESFORCO == 2 else 1)
    brief, passo = None, 1
    if etapas >= 2:
        print("  %d/%d planejando a coreografia..." % (passo, etapas))
        if callback:
            callback({"step": "scene_step", "index": idx + 1, "total": total, "substep": "planejando coreografia"})
        brief = pedir_briefing(dna, sc, idx, total, anterior)
        sc["brief"] = brief
        if brief is None:
            print("    (sem briefing; seguindo só com a ideia da cena)")
        _pausa()
        passo += 1
    print("  %d/%d escrevendo o código..." % (passo, etapas))
    if callback:
        callback({"step": "scene_step", "index": idx + 1, "total": total, "substep": "escrevendo código canvas"})
    code = pedir_cena(dna, sc, idx, total, anterior, brief)
    if code and etapas >= 3:
        _pausa()
        print("  3/3 revisando e polindo...")
        if callback:
            callback({"step": "scene_step", "index": idx + 1, "total": total, "substep": "revisando e refinando"})
        melhor = refinar_cena(dna, sc, code, brief)
        if melhor:
            code = melhor
        else:
            print("    (revisão inválida; mantendo a versão anterior)")
    return code

def offline_plan(user_prompt, rng):
    words = [w for w in user_prompt.upper().replace(",", " ").split() if len(w) > 2][:12] or ["MOTION"]
    ideias = ["MOVIMENTO", "RITMO", "IMPACTO", "DETALHE", "ENERGIA", "FLUXO", "FOCO"]
    scenes = [{"role": "hook", "text": " ".join(words[:4]), "sub": "showreel", "idea": "", "weight": 2}]
    for i in range(1, 7):
        scenes.append({"role": "climax" if i == 5 else "body",
                       "text": rng.choice(ideias) + (" " + words[i % len(words)] if i % 2 else ""),
                       "sub": "", "idea": "", "weight": rng.choice([1, 1, 2])})
    scenes.append({"role": "closing", "text": " ".join(words[:3]), "sub": "obrigado", "idea": "", "weight": 2})
    return {"title": " ".join(words[:3]).title(), "scenes": scenes}

def clean_plan(plan, rng):
    scenes = []
    for s in plan.get("scenes", [])[:10]:
        if not isinstance(s, dict):
            continue
        role = s.get("role") if s.get("role") in ROLES else "body"
        scenes.append({"role": role, "text": str(s.get("text", "") or "MOTION")[:40],
                       "sub": str(s.get("sub", "") or "")[:90], "idea": str(s.get("idea", "") or "")[:300],
                       "weight": s.get("weight", 1), "duracao": s.get("duracao"),
                       "fala": re.sub(r"[<>|]", "", str(s.get("fala", "") or ""))[:300]})
    if not scenes:
        scenes = [{"role": "hook", "text": "MOTION", "sub": "", "idea": "", "weight": 1}]
    if len(scenes) == 1:
        scenes.append({"role": "closing", "text": "FIM", "sub": "", "idea": "", "weight": 1})
    scenes[0]["role"] = "hook"
    for s in scenes[1:-1]:
        if s["role"] in ("hook", "closing"):
            s["role"] = "body"
    scenes[-1]["role"] = "closing"
    for s in scenes:
        if not s.get("fala"):
            t, sb = s["text"].strip().capitalize(), s["sub"].strip()
            s["fala"] = (t if t[-1:] in ".!?" else t + ".") + ((" " + (sb if sb[-1:] in ".!?" else sb + ".")) if sb else "")
    prev = None
    for s in scenes:
        if s["role"] == "closing":
            s["fb"] = "closing"
        else:
            op = [f for f in FALLBACKS if f != prev] or FALLBACKS
            s["fb"] = rng.choice(op)
        prev = s["fb"]
    prev_l = None
    for s in scenes:
        if s["role"] == "closing":
            s["layout"] = "centro"
        else:
            s["layout"] = rng.choice([l for l in LAYOUTS if l != prev_l and l != "centro"])
        prev_l = s["layout"]
    return {"title": str(plan.get("title", "showreel"))[:60], "motivo": str(plan.get("motivo", "") or "")[:200], "scenes": scenes}

def schedule(scenes, structure, total):
    n = len(scenes)
    ws = []
    for i, s in enumerate(scenes):
        try:
            base = max(0.5, min(3.0, float(s.get("weight", 1))))
        except Exception:
            base = 1.0
        if structure == "crescendo":
            f = 1.7 - 1.2 * i / max(1, n - 1)
        elif structure == "explosao_respiro":
            f = 0.7 if i % 2 else 1.3
        else:
            f = 1.0
        ws.append(base * f)
    durs = [max(1.6, total * w / sum(ws)) for w in ws]
    k = total / sum(durs)
    return [d * k for d in durs]

def calcular_duracoes(scenes, structure):
    ds = []
    for sc in scenes:
        try:
            ds.append(float(sc.get("duracao")))
        except Exception:
            ds.append(None)
    if all(d is not None for d in ds):
        ds = [max(1.6, min(7.0, d)) for d in ds]
    else:
        ds = list(schedule(scenes, structure, DURATION))
    if VOZ_ATIVA and CHAVES:
        ds = [max(d, VOICE_AT + len(str(sc.get("fala", "")).split()) / 2.4 + 0.55) for d, sc in zip(ds, scenes)]
    return [round(d, 2) for d in ds], round(sum(ds), 2)

def salvar_codigo(dados, stamp, user_prompt, html, audios=None):
    pasta = os.path.join(OUTPUT_DIR, "codigo_" + stamp)
    cenas = os.path.join(pasta, "cenas")
    os.makedirs(cenas, exist_ok=True)
    d = dados["dna"]
    todas = ["// Showreel: %s" % dados["title"],
             "// Prompt: %s" % user_prompt,
             "// DNA: %s | %s | %s | %d bpm" % (d["estilo"], d["structure"], d["transition"], d["bpm"]),
             "// Cada cena abaixo é o CORPO de uma função (ctx, t, ts, W, H, P, M)", ""]
    for i, s in enumerate(dados["scenes"], 1):
        cab = ["// CENA %d [%s] \"%s\" - origem: %s" % (i, s["role"], s["text"], s["origem"]),
               "// Ideia: %s" % (s.get("idea") or "-"),
               "// Layout: %s | Duração: %.1fs | seed: %s" % (s.get("layout"), s["dur"], s["seed"]), ""]
        if s.get("fala"):
            cab.insert(3, "// Fala: %s" % s["fala"])
        if s.get("brief"):
            cab.insert(3, "// Conceito: %s" % str(s["brief"].get("conceito", ""))[:240])
        corpo = s.get("code") or ("// cena pronta (fallback '%s'), sem código gerado pelo Gemini" % s.get("fb"))
        texto = "\n".join(cab) + corpo + "\n"
        nome = "cena_%02d_%s.js" % (i, s["role"])
        with open(os.path.join(cenas, nome), "w", encoding="utf-8") as f:
            f.write(texto)
        todas.append("// " + "=" * 60)
        todas.append(texto)
    with open(os.path.join(pasta, "todas_as_cenas.js"), "w", encoding="utf-8") as f:
        f.write("\n".join(todas))
    with open(os.path.join(pasta, "plano.json"), "w", encoding="utf-8") as f:
        limpo = dict(dados)
        limpo["scenes"] = [{k: v for k, v in sc.items() if k not in ("audio", "env")} for sc in dados["scenes"]]
        json.dump({"prompt": user_prompt, "dados": limpo}, f, ensure_ascii=False, indent=1)
    with open(os.path.join(pasta, "showreel.html"), "w", encoding="utf-8") as f:
        f.write(html)
    if audios:
        os.makedirs(os.path.join(pasta, "narracao"), exist_ok=True)
        for i, a in audios.items():
            with open(os.path.join(pasta, "narracao", "cena_%02d.wav" % (i + 1)), "wb") as f:
                f.write(pcm_para_wav(a["pcm"], a["rate"]))
        trilha = montar_trilha(dados["scenes"], audios)
        if trilha:
            with open(os.path.join(pasta, "narracao_completa.wav"), "wb") as f:
                f.write(trilha)
    return pasta

def executar_geracao(briefing, options=None, callback=None):
    """
    Função principal de geração programática para o frontend React
    options pode conter:
      - keys: list de chaves do Gemini
      - style_idx: 1 a 6
      - resolution_idx: 1 (540x960), 2 (720x1280), 3 (1080x1920)
      - fps: 24 ou 30
      - accent: hex (#FFB454)
      - effort: 1, 2 ou 3
      - voice: nome da voz ('Kore', 'Puck', etc.) ou 'none'
    """
    global WIDTH, HEIGHT, FPS, DURATION, NIVEL_ESFORCO, VOZ_ATIVA, VOZ_NOME
    pasta_saida()
    opts = options or {}
    chaves_fornecidas = opts.get("keys") or []
    obter_chaves(chaves_fornecidas)

    # Configurar parâmetros
    style_idx = int(opts.get("style_idx", 2))
    cfg = MENU_ESTILOS[style_idx - 1] if 1 <= style_idx <= len(MENU_ESTILOS) else None
    res_idx = int(opts.get("resolution_idx", 2))
    if 1 <= res_idx <= len(RESOLUCOES):
        WIDTH, HEIGHT = RESOLUCOES[res_idx - 1]
    FPS = int(opts.get("fps", 24))
    accent_usado = opts.get("accent", ACCENT_PADRAO)
    NIVEL_ESFORCO = int(opts.get("effort", 2))
    voz_opt = opts.get("voice", "Kore")
    if voz_opt == "none" or not voz_opt:
        VOZ_ATIVA = False
    else:
        VOZ_ATIVA = True
        VOZ_NOME = voz_opt

    if callback:
        callback({"step": "init", "message": "Iniciando Motion Reel Studio v3...", "keys_count": len(CHAVES)})

    tem_chave = len(CHAVES) > 0
    if tem_chave:
        preparar_modelos()

    rng = random.Random(int.from_bytes(os.urandom(4), "big"))
    runs = ler_json("historico_planos.json", {"runs": []}).get("runs", [])
    dna = make_dna(rng, runs, cfg, accent_usado)

    if callback:
        callback({
            "step": "dna",
            "message": "DNA gerado",
            "dna": {
                "estilo": dna["estilo"],
                "estilo_desc": dna["estilo_desc"],
                "structure": dna["structure"],
                "transition": dna["transition"],
                "bpm": dna["bpm"],
                "energy": dna["energy"],
                "pal": dna["pal"],
                "fonte": dna["fonte"],
                "ui_nome": dna["ui"]["nome"]
            }
        })

    # Roteiro
    if callback:
        callback({"step": "script_start", "message": "Criando roteiro do showreel..."})

    plan = None
    if tem_chave:
        plan = pedir_roteiro(briefing, dna, runs)
    if plan is None:
        plan = offline_plan(briefing, rng)
    plan = clean_plan(plan, rng)
    scenes = plan["scenes"]
    durs, total = calcular_duracoes(scenes, dna["structure"])
    DURATION = total
    dna["motivo"] = plan.get("motivo", "")
    for sc, d in zip(scenes, durs):
        sc["dur"] = d
        sc["seed"] = rng.randint(1, 10 ** 6)

    if callback:
        callback({
            "step": "script_done",
            "message": "Roteiro pronto",
            "title": plan["title"],
            "motivo": dna["motivo"],
            "total_duration": total,
            "scenes": [{
                "role": s["role"],
                "text": s["text"],
                "sub": s["sub"],
                "dur": s["dur"],
                "idea": s["idea"],
                "layout": s.get("layout", "centro"),
                "fala": s.get("fala", "")
            } for s in scenes]
        })

    # Narração (voz)
    audios = {}
    if VOZ_ATIVA and tem_chave:
        audios = gerar_narracao(dna, scenes, callback=callback)
        DURATION = round(sum(sc["dur"] for sc in scenes), 2)
    elif VOZ_ATIVA:
        print("\nA narração precisa de chave da Gemini; seguindo sem voz.")

    # Geração do código das cenas
    biblioteca = ler_json("biblioteca_cenas.json", [])
    novos, anterior = 0, ""
    for i, sc in enumerate(scenes):
        sc["code"], sc["origem"] = None, "fallback"
        if callback:
            callback({
                "step": "scene_start",
                "index": i + 1,
                "total": len(scenes),
                "text": sc["text"],
                "role": sc["role"],
                "dur": sc["dur"]
            })

        reuso = [e for e in biblioteca if e.get("role") == sc["role"]]
        if reuso and rng.random() < REAPROVEITAR:
            e = rng.choice(reuso)
            sc["code"], sc["origem"] = e["code"], "biblioteca"
            sc["layout"] = e.get("layout", "centro")
        elif tem_chave:
            code = gerar_cena_com_esforco(dna, sc, i, len(scenes), anterior, callback=callback)
            if code:
                sc["code"], sc["origem"] = code, "gemini"
                biblioteca.append({"role": sc["role"], "idea": sc["idea"], "estilo": dna["estilo"],
                                   "layout": sc["layout"], "code": code})
                novos += 1
            _pausa()
        anterior = sc["idea"] or sc["text"]

        if callback:
            callback({
                "step": "scene_done",
                "index": i + 1,
                "total": len(scenes),
                "text": sc["text"],
                "origem": sc["origem"],
                "has_code": bool(sc.get("code"))
            })

    if novos:
        gravar_json("biblioteca_cenas.json", biblioteca[-80:])

    # Montagem do HTML5
    dados = {
        "title": plan["title"], "W": WIDTH, "H": HEIGHT, "duration": DURATION, "fps": FPS,
        "dna": {
            "structure": dna["structure"], "transition": dna["transition"], "estilo": dna["estilo"],
            "pal": dna["pal"], "bpm": dna["bpm"], "energy": dna["energy"], "fonte": dna["fonte"], "fx": dna["fx"]
        },
        "ui": dna["ui"]["vars"], "ui_nome": dna["ui"]["nome"], "scenes": scenes
    }
    blob = json.dumps(dados, ensure_ascii=False).replace("</", "<\\/")
    html = HTML.replace("/*__DATA__*/null", blob, 1)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    nome = "showreel_%s.html" % stamp
    html_path = os.path.join(OUTPUT_DIR, nome)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html)

    runs.append({"title": plan["title"], "structure": dna["structure"], "transition": dna["transition"],
                 "estilo": dna["estilo"], "hue": dna["hue"], "ui": dna["ui"]["nome"], "fonte": dna["fonte"]["nome"]})
    gravar_json("historico_planos.json", {"runs": runs[-30:]})

    codigo_pasta = ""
    if SALVAR_CODIGO:
        try:
            codigo_pasta = salvar_codigo(dados, stamp, briefing, html, audios)
        except Exception as ex:
            print("(aviso) erro salvando código:", ex)

    # Dados limpos para devolver na API
    dados_limpos = dict(dados)
    dados_limpos["scenes"] = [{k: v for k, v in sc.items() if k not in ("audio", "env")} for sc in dados["scenes"]]

    resumo = {
        "id": stamp,
        "title": plan["title"],
        "filename": nome,
        "html_url": "/api/reels/%s/html" % stamp,
        "total_duration": DURATION,
        "scenes_count": len(scenes),
        "dna": dados["dna"],
        "dados": dados_limpos,
        "codigo_pasta": codigo_pasta,
        "created_at": stamp
    }

    if callback:
        callback({"step": "complete", "message": "Showreel gerado com sucesso!", "result": resumo})

    return resumo, html

# Suporte a CLI tradicional ou chamada com JSON
if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--api":
        # Modo API stdin / stdout para integração com Node/Express
        try:
            input_data = json.loads(sys.stdin.read())
            briefing = input_data.get("prompt", "Showreel motion design")
            options = input_data.get("options", {})
            
            def emit_event(ev):
                sys.stdout.write("EVENT:" + json.dumps(ev, ensure_ascii=False) + "\n")
                sys.stdout.flush()

            res, _ = executar_geracao(briefing, options, callback=emit_event)
            sys.stdout.write("FINAL:" + json.dumps(res, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as e:
            sys.stderr.write("ERRO: " + str(e) + "\n")
            sys.exit(1)
    else:
        # Modo interativo padrão do script original
        print("Executando em modo interativo...")
        pasta_saida()
        executar_geracao("showreel de motion design moderno", callback=lambda ev: print("Progresso:", ev.get("step")))
