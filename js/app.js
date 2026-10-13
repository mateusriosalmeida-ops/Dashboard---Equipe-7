const R=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const N=v=>v.toLocaleString("pt-BR");
const D=s=>new Date(s+"T00:00").toLocaleDateString("pt-BR");
const P=v=>Math.round(v*100)+"%";
const tot=c=>{const l=ETAPAS[c.id];return{v:l.reduce((a,x)=>a+x.c*x.p,0),m:l.reduce((a,x)=>a+x.m*x.p,0)}};
const alerts=x=>{const a=[];
  if(x.m>x.c)a.push(["crit","Medido acima do contratado"]);
  if((x.e-x.m)/x.c>0.03)a.push(["warn","Executado em campo maior que o medido"]);
  if(x.pend&&!x.ev)a.push(["warn","Medição sem evidência anexada"]);return a;};
const badge=s=>`<span class="b ${{"Ativo":"ok","Em atraso":"crit","Concluído":"neu"}[s]}">${s}</span>`;
const rule=(m,e,sm)=>`<div class="rule${sm?" sm":""}"><i style="width:${Math.min(m,1)*100}%"></i>${e==null?"":`<s style="left:${Math.min(e,1)*100}%"></s>`}</div>`;

// ---------- contratos adicionados pelo usuário (salvos só neste navegador) ----------
const KC="sgf-contratos";
try{JSON.parse(localStorage.getItem(KC)||"[]").forEach(o=>{CONTRATOS.push(o.c);ETAPAS[o.c.id]=o.e})}catch(e){}
const saveC=()=>{try{localStorage.setItem(KC,JSON.stringify(CONTRATOS.filter(c=>c.novo).map(c=>({c,e:ETAPAS[c.id].map(x=>({n:x.n,un:x.un,c:x.c,m:0,e:0,p:x.p}))}))))}catch(e){}};

// ---------- medições registradas ficam salvas só neste navegador (localStorage) ----------
const KEY="sgf-medicoes";
try{Object.entries(JSON.parse(localStorage.getItem(KEY)||"{}")).forEach(([k,v])=>{const[i,j]=k.split("-");if(ETAPAS[i]&&ETAPAS[i][j])Object.assign(ETAPAS[i][j],v)})}catch(e){}
const save=()=>{try{const s={};for(const i in ETAPAS)ETAPAS[i].forEach((x,j)=>{if(x.ult!=null)s[i+"-"+j]={m:x.m,pend:x.pend,ult:x.ult}});localStorage.setItem(KEY,JSON.stringify(s))}catch(e){}};

const page=document.body.dataset.page;
const NAV=[["index.html","Dashboard","dashboard"],["contratos.html","Contratos","contratos"],["etapas.html","Etapas e medições","etapas"]];
document.body.insertAdjacentHTML("afterbegin",`
<header class="top"><button id="mb" aria-label="Abrir menu" aria-expanded="false"><span></span><span></span><span></span></button>
<strong class="brand">Contratos de Subempreiteiras</strong>
<div class="user"><span class="av"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span><span class="un">Perfil</span></div></header>
<div id="ov"></div>
<nav id="sb" aria-label="Menu principal"><p>Menu</p>${NAV.map(n=>`<a href="${n[0]}"${n[2]===page?' class="cur" aria-current="page"':""}>${n[1]}</a>`).join("")}</nav>`);
const mb=document.getElementById("mb"),sb=document.getElementById("sb"),ov=document.getElementById("ov");
const tg=o=>{sb.classList.toggle("open",o);ov.classList.toggle("on",o);mb.setAttribute("aria-expanded",o)};
mb.onclick=()=>tg(!sb.classList.contains("open"));ov.onclick=()=>tg(false);
document.addEventListener("keydown",e=>e.key==="Escape"&&tg(false));

// ---------- páginas ----------
const app=document.getElementById("app");
const PAGES={
dashboard(){
  const at=CONTRATOS.filter(c=>c.status!=="Concluído");
  const vt=at.reduce((a,c)=>a+tot(c).v,0);
  const pend=[];CONTRATOS.forEach(c=>ETAPAS[c.id].forEach(x=>x.pend&&pend.push({c,x})));
  const mx=Math.max(...FAT.map(f=>f[1]));
  app.innerHTML=`<h1>Dashboard</h1><p class="sub">Visão geral dos contratos</p>
  <section class="kpis">
   <div class="kpi"><span>Contratos ativos</span><b>${at.length}</b><small>de ${CONTRATOS.length} cadastrados</small></div>
   <div class="kpi"><span>Valor contratado (ativos)</span><b>${R(vt)}</b><small>soma dos itens contratados</small></div>
   <div class="kpi"><span>Medições pendentes</span><b>${pend.length}</b><small>aguardando aprovação</small></div>
   <div class="kpi"><span>Faturamento de outubro</span><b>${R(FAT[FAT.length-1][1])}</b><small>faturado no mês</small></div>
  </section>
  <section class="grid2">
   <div class="card"><h2>Faturamento mensal</h2><div class="bars">${FAT.map(([m,v],i)=>`<div class="bar${i==FAT.length-1?" last":""}"><u>${Math.round(v/1000)}k</u><i style="height:${Math.round(v/mx*150)}px"></i><em>${m}</em></div>`).join("")}</div></div>
   <div class="card"><h2>Medições pendentes</h2><div class="tbl"><table><thead><tr><th>Contrato</th><th>Etapa</th><th>Evidência</th></tr></thead><tbody>
   ${pend.map(({c,x})=>`<tr><td>${c.cod}<br><small>${c.sub}</small></td><td>${x.n}</td><td>${x.ev?'<span class="b ok">Anexada</span>':'<span class="b warn">Faltando</span>'}</td></tr>`).join("")}
   </tbody></table></div></div>
  </section>`;
},
contratos(){
  app.innerHTML=`<h1>Contratos</h1><p class="sub">Subempreiteiras, valores e prazos. Clique em um contrato para ver suas etapas e medições.</p>
  <div class="tools"><input id="q" type="search" placeholder="Buscar por subempreiteira, código ou objeto"><select id="st"><option value="">Todos os status</option><option>Ativo</option><option>Em atraso</option><option>Concluído</option></select></div>
  <div class="card tbl"><table><thead><tr><th>Código</th><th>Subempreiteira</th><th>Valor contratado</th><th>Medido</th><th>Prazo</th><th>Status</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const q_=document.getElementById("q"),st=document.getElementById("st"),tb=document.getElementById("tb");
  const draw=()=>{const q=q_.value.toLowerCase(),s=st.value;
    const l=CONTRATOS.filter(c=>(!s||c.status===s)&&(c.cod+c.sub+c.obj).toLowerCase().includes(q));
    tb.innerHTML=l.length?l.map(c=>{const t=tot(c),d=Math.round((new Date(c.fim+"T00:00")-REF)/864e5);
      const pz=c.status==="Concluído"?"Encerrado":d<0?`<span class="neg">${-d} dias de atraso</span>`:`${d} dias restantes`;
      return `<tr class="go" data-id="${c.id}"><td>${c.cod}</td><td><a href="etapas.html?contrato=${c.id}">${c.sub}</a><br><small>${c.obj}</small></td><td>${R(t.v)}</td>
      <td class="w">${rule(t.m/t.v,null,1)}<small>${R(t.m)} · ${P(t.m/t.v)}</small></td><td>${D(c.ini)} a ${D(c.fim)}<br><small>${pz}</small></td><td>${badge(c.status)}</td></tr>`}).join("")
      :`<tr><td colspan="6">Nenhum contrato encontrado. Ajuste a busca ou o filtro.</td></tr>`;};
  tb.onclick=e=>{const r=e.target.closest("tr[data-id]");if(r&&!e.target.closest("a"))location.href="etapas.html?contrato="+r.dataset.id};
  q_.oninput=st.onchange=draw;draw();
},
etapas(){
  app.innerHTML=`<h1>Etapas e medições</h1><p class="sub">Contratado x medido x executado</p>
  <div class="tools"><select id="ct" aria-label="Contrato">${CONTRATOS.map(c=>`<option value="${c.id}">${c.cod} · ${c.sub}</option>`).join("")}</select><button id="rs" class="lnk" type="button">Restaurar dados de exemplo</button></div><div id="et"></div>`;
  const ct=document.getElementById("ct"),et=document.getElementById("et");
  const qid=new URLSearchParams(location.search).get("contrato");
  if(CONTRATOS.some(c=>c.id==qid))ct.value=qid;
  const draw=()=>{const c=CONTRATOS.find(x=>x.id==ct.value),l=ETAPAS[c.id],t=tot(c);
    const na=l.reduce((a,x)=>a+alerts(x).length,0);
    et.innerHTML=`<div class="card sum"><div><span>Avanço medido</span><b>${P(t.m/t.v)}</b></div><div><span>Valor medido</span><b>${R(t.m)}</b></div><div><span>Alertas de divergência</span><b class="${na?"neg":""}">${na}</b></div></div>
    <p class="lg">Barra azul = medido · marcador âmbar = executado em campo</p>
    ${l.map((x,j)=>`<article class="card st"><div class="hd"><h3>${x.n}</h3>${x.pend?'<span class="b warn">Medição pendente</span>':""}</div>
    ${rule(x.m/x.c,x.e/x.c)}
    <dl><div><dt>Contratada</dt><dd>${N(x.c)} ${x.un}</dd></div><div><dt>Medida</dt><dd>${N(x.m)} ${x.un} · ${P(x.m/x.c)}</dd></div><div><dt>Executada</dt><dd>${N(x.e)} ${x.un}</dd></div><div><dt>Saldo</dt><dd>${N(Math.max(x.c-x.m,0))} ${x.un}</dd></div></dl>
    ${alerts(x).map(([k,m])=>`<p class="al ${k}">${m}</p>`).join("")}
    <form class="reg" data-j="${j}"><label for="q${j}">Registrar medição (quantidade medida agora, em ${x.un})</label>
    <div class="row"><input id="q${j}" type="number" min="0" step="any" inputmode="decimal" placeholder="Ex.: 120"><span>${x.un}</span><button type="submit">Registrar medição</button></div>
    <div class="ev"><button type="button" disabled>Anexar evidência</button><small>Em breve: anexar foto ou arquivo que comprove a medição.</small></div>
    ${x.ult!=null?`<p class="okm">Última medição registrada: ${N(x.ult)} ${x.un}, aguardando aprovação.</p>`:""}</form></article>`).join("")}`;};
  et.onsubmit=e=>{e.preventDefault();const f=e.target,x=ETAPAS[ct.value][+f.dataset.j],v=parseFloat(f.querySelector("input").value);
    if(!(v>0)){f.querySelector("input").focus();return}
    x.m=Math.round((x.m+v)*100)/100;x.ult=v;x.pend=1;save();draw();};
  document.getElementById("rs").onclick=()=>{try{localStorage.removeItem(KEY)}catch(e){}location.reload()};
  ct.onchange=draw;draw();
}};
PAGES[page]();
