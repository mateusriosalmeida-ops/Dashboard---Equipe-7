// ===== utilitários =====
const R=v=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const N=v=>v.toLocaleString("pt-BR");
const D=s=>new Date(s.length>10?s:s+"T00:00").toLocaleDateString("pt-BR");
const DT=s=>new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const P=v=>Math.round(v*100)+"%";
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>{const n=typeof v==="number"?v:parseFloat(String(v).trim().replace(",","."));return Number.isFinite(n)?n:NaN};

// ===== sessão e permissões =====
const page=document.body.dataset.page;
const USER=JSON.parse(sessionStorage.getItem("sgf-user")||"null");
if(!USER){location.replace("login.html");throw 0}
const can=p=>ROLES[USER.papel].perm.includes(p);
if(page==="dashboard"&&!can("ver_fin")){location.replace("etapas.html");throw 0}
if(page==="relatorios"&&!can("relatorios")){location.replace("index.html");throw 0}

// ===== dados: salvos no localStorage do navegador =====
const KEY="sgf-db-v2";
let DB=null;try{DB=JSON.parse(localStorage.getItem(KEY))}catch(e){}
if(!DB||!DB.contratos||!DB.etapas||!DB.medicoes)DB={...JSON.parse(JSON.stringify(SEED)),log:[]};
DB.log=DB.log||[];
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(DB));return true}catch(e){toast("Não foi possível salvar: o navegador bloqueou o armazenamento local.");return false}};
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
const log=m=>{DB.log.unshift({em:new Date().toISOString(),por:USER.nome,m});DB.log.length=Math.min(DB.log.length,50)};

const tot=c=>{const l=DB.etapas[c.id]||[];return{v:l.reduce((a,x)=>a+x.c*x.p,0),m:l.reduce((a,x)=>a+x.m*x.p,0)}};
const pc=t=>t.v?t.m/t.v:0;
const pend=(ct,j)=>DB.medicoes.filter(m=>m.ct==ct&&m.et==j&&m.st==="Pendente").reduce((a,m)=>a+m.q,0);
const alerts=x=>{const a=[];
  if(x.m>x.c)a.push(["crit","Medido acima do contratado"]);
  if((x.e-x.m)/x.c>0.03)a.push(["warn","Executado em campo maior que o medido"]);return a};
const badge=s=>`<span class="b ${{"Ativo":"ok","Em atraso":"crit","Concluído":"neu","Pendente":"warn","Aprovada":"ok","Rejeitada":"crit"}[s]}">${s}</span>`;
const rule=(m,e,sm)=>`<div class="rule${sm?" sm":""}"><i style="width:${Math.min(m,1)*100}%"></i>${e==null?"":`<s style="left:${Math.min(e,1)*100}%"></s>`}</div>`;

// ===== REGRAS DE NEGÓCIO =====
const ERR=m=>{throw new Error(m)};
const filled=(v,n)=>{if(!String(v??"").trim())ERR(`Campo obrigatório não preenchido: ${n}.`)};
const cont=id=>DB.contratos.find(c=>c.id==id)||ERR("Contrato inexistente: não é possível vincular serviços ou medições a ele.");
const need=p=>can(p)||ERR("Seu perfil não tem permissão para realizar esta ação.");
const RN={
  medicao(ct,j,q,foto){const c=cont(ct),x=(DB.etapas[c.id]||[])[j]||ERR("Etapa inexistente neste contrato.");
    if(c.status==="Concluído")ERR("Contrato concluído não aceita novas medições.");           // RN06
    filled(q,"Quantidade medida");                                                            // RN02
    q=num(q);if(!(q>0))ERR("A quantidade medida deve ser um número maior que zero.");         // RN01
    const saldo=x.c-x.m-pend(c.id,j);
    if(q>saldo+1e-9)ERR(`A medição excede o saldo disponível (${N(Math.max(saldo,0))} ${x.un}).`); // RN05
    if(!(typeof foto==="string"&&foto.startsWith("data:image/")))ERR("Anexe uma foto como evidência da medição."); // RN12
    return q},
  item(c,o){if(c.status==="Concluído")ERR("Contrato concluído não aceita novos serviços.");   // RN06
    filled(o.n,"Nome do serviço");filled(o.c,"Quantidade contratada");filled(o.p,"Preço unitário");
    const q=num(o.c),p=num(o.p);
    if(!(q>0))ERR("A quantidade contratada deve ser um número maior que zero.");
    if(!(p>0))ERR("O preço unitário deve ser um número maior que zero.");
    if((DB.etapas[c.id]||[]).some(x=>x.n.trim().toLowerCase()===o.n.trim().toLowerCase()))ERR("Este serviço já existe neste contrato."); // RN07
    return{n:o.n.trim(),un:o.un,c:q,m:0,e:0,p}},
  contrato(o,id){filled(o.sub,"Subempreiteira");filled(o.obj,"Objeto do contrato");filled(o.ini,"Data de início");filled(o.fim,"Data de término");
    if(o.fim<o.ini)ERR("O término deve ser igual ou posterior ao início.");                      // RN03
    if(DB.contratos.some(c=>c.id!=id&&c.sub.trim().toLowerCase()===o.sub.trim().toLowerCase()&&c.obj.trim().toLowerCase()===o.obj.trim().toLowerCase()))
      ERR("Já existe um contrato com esta subempreiteira e este objeto.")}                      // RN04
};
const ACT={
  medir(ct,j,qq,foto){need("medir");const q=RN.medicao(ct,j,qq,foto),x=DB.etapas[ct][j];
    DB.medicoes.push({id:Math.max(0,...DB.medicoes.map(m=>m.id))+1,ct:+ct,et:j,q,foto,por:USER.nome,em:new Date().toISOString(),st:"Pendente"});
    log(`Registrou medição de ${N(q)} ${x.un} em "${x.n}" (${cont(ct).cod})`)},
  decidir(id,ok,motivo){need("aprovar");const m=DB.medicoes.find(x=>x.id==id);
    if(!m||m.st!=="Pendente")ERR("Medição não encontrada ou já decidida.");
    const x=DB.etapas[m.ct][m.et],c=cont(m.ct);
    if(ok){if(x.m+m.q>x.c+1e-9)ERR("Aprovar excederia a quantidade contratada.");x.m=Math.round((x.m+m.q)*100)/100;m.st="Aprovada"}
    else{filled(motivo,"Motivo da rejeição");m.st="Rejeitada";m.mot=motivo.trim()}                // RN08
    m.apr=USER.nome;m.dec=new Date().toISOString();
    log(`${ok?"Aprovou":"Rejeitou"} medição de ${N(m.q)} ${x.un} em "${x.n}" (${c.cod})`)},
  novoContrato(o){need("contrato_criar");RN.contrato(o);
    const id=Math.max(0,...DB.contratos.map(c=>c.id))+1;
    const c={id,cod:"CT-2026-"+String(id).padStart(3,"0"),sub:o.sub.trim(),obj:o.obj.trim(),ini:o.ini,fim:o.fim,status:new Date(o.fim+"T00:00")<REF?"Em atraso":"Ativo"};
    const it=RN.item(c,o);DB.contratos.push(c);DB.etapas[id]=[it];log(`Criou o contrato ${c.cod} (${c.sub})`)},
  editarContrato(id,o){need("contrato_editar");const c=cont(id);RN.contrato(o,id);
    if(o.status==="Concluído"&&DB.medicoes.some(m=>m.ct==c.id&&m.st==="Pendente"))ERR("Há medições pendentes: aprove ou rejeite antes de concluir o contrato.");
    Object.assign(c,{sub:o.sub.trim(),obj:o.obj.trim(),ini:o.ini,fim:o.fim,status:o.status||c.status});log(`Alterou o contrato ${c.cod}`)},
  novoItem(ct,o){need("contrato_editar");const c=cont(ct);DB.etapas[c.id].push(RN.item(c,o));log(`Adicionou o serviço "${o.n.trim()}" ao contrato ${c.cod}`)},
  editarItem(ct,j,qq,pp){need("contrato_editar");const c=cont(ct),x=(DB.etapas[c.id]||[])[j]||ERR("Etapa inexistente neste contrato.");
    if(c.status==="Concluído")ERR("Contrato concluído não pode ser alterado.");
    filled(qq,"Quantidade contratada");filled(pp,"Preço unitário");const q=num(qq),p=num(pp);
    if(!(q>0))ERR("A quantidade contratada deve ser um número maior que zero.");
    if(!(p>0))ERR("O preço unitário deve ser um número maior que zero.");
    const usado=x.m+pend(c.id,j);if(q<usado)ERR(`A quantidade contratada não pode ser menor que a já medida ou pendente (${N(usado)} ${x.un}).`);
    x.c=q;x.p=p;log(`Alterou valores do serviço "${x.n}" (${c.cod})`)}
};
const run=(fn,okmsg)=>{try{fn();if(!save())return false;toast(okmsg,1);return true}catch(e){toast(e.message);return false}};

// ===== FOTO DE EVIDÊNCIA: lê a imagem, reduz (máx. 720px, JPEG) e devolve um texto "data:image/jpeg;base64,..." =====
const lerFoto=file=>new Promise((ok,no)=>{if(!file||!file.size)return ok(null);
  if(!file.type.startsWith("image/"))return no(new Error("A evidência precisa ser um arquivo de imagem (foto)."));
  const r=new FileReader();r.onerror=()=>no(new Error("Não foi possível ler a imagem."));
  r.onload=()=>{const im=new Image();im.onerror=()=>no(new Error("Imagem inválida."));
    im.onload=()=>{const k=Math.min(1,720/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
      c.getContext("2d").drawImage(im,0,0,c.width,c.height);const u=c.toDataURL("image/jpeg",.65);
      u.length>400000?no(new Error("A foto ficou grande demais. Tente uma imagem menor.")):ok(u)};im.src=r.result};
  r.readAsDataURL(file)});

// ===== EXPORTAÇÃO: backup (JSON), relatórios em CSV e em PDF =====
// 1) baixar(): transforma um texto em arquivo (Blob), cria um link invisível com "download" e clica nele.
const baixar=(nome,tipo,txt)=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:tipo}));a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
// 2) CSV: cada linha vira texto separado por ";" (padrão do Excel em português); "\uFEFF" no início faz o Excel acertar os acentos.
const cel=v=>{if(typeof v==="number")return String(Math.round(v*100)/100).replace(".",",");v=String(v??"");if(/^[=+\-@]/.test(v))v="'"+v;return `"${v.replace(/"/g,'""')}"`};
const csv=rows=>"\uFEFF"+rows.map(r=>r.map(cel).join(";")).join("\r\n");
// 3) PDF: monta a tabela em HTML, coloca numa página invisível (iframe) e chama a impressão do navegador, onde se escolhe "Salvar como PDF".
const f2=v=>typeof v==="number"?v.toLocaleString("pt-BR",{maximumFractionDigits:2}):esc(v);
const isTot=r=>r[1]==="TOTAL DO CONTRATO"||r[1]==="TOTAL GERAL";
const tabelaHtml=rows=>`<table><thead><tr>${rows[0].map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(r=>`<tr${isTot(r)?' class="tot"':""}>${r.map(v=>`<td${typeof v==="number"?' class="n"':""}>${f2(v)}</td>`).join("")}</tr>`).join("")||`<tr><td colspan="${rows[0].length}">Sem dados.</td></tr>`}</tbody></table>`;
const htmlRel=(arq,titulo,rows,sel)=>{const c=sel&&DB.contratos.find(x=>x.id==sel);
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(arq)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px/1.4 Arial,sans-serif;color:#111}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#444}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#e6e9ec}td.n{text-align:right}tr.tot td{font-weight:bold;background:#f1f3f5}</style></head><body><h1>${esc(titulo)}</h1><p>Contratos de Subempreiteiras · ${c?esc(c.cod+" · "+c.sub):"todos os contratos"} · gerado em ${DT(new Date().toISOString())} por ${esc(ROLES[USER.papel].nome)}</p>${tabelaHtml(rows)}</body></html>`};
const imprimir=(arq,titulo,rows,sel)=>{const f=document.createElement("iframe");f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0";document.body.appendChild(f);
  const d=f.contentWindow.document;d.open();d.write(htmlRel(arq,titulo,rows,sel));d.close();
  setTimeout(()=>{f.contentWindow.focus();f.contentWindow.onafterprint=()=>f.remove();f.contentWindow.print()},300)};
// 4) Os dados dos relatórios saem direto do banco (DB): cada relatório é uma lista de linhas; a primeira é o cabeçalho.
const REL={
  medicoes:{nome:"Relatório de medições",rows:sel=>[["Data","Contrato","Subempreiteira","Serviço","Quantidade","Un.","Registrada por","Situação","Decidida por","Motivo da rejeição","Evidência (foto)"],
    ...DB.medicoes.filter(m=>!sel||m.ct==sel).sort((a,b)=>a.em.localeCompare(b.em)).map(m=>{const c=DB.contratos.find(x=>x.id==m.ct)||{},x=(DB.etapas[m.ct]||[])[m.et]||{};
      return[DT(m.em),c.cod||"-",c.sub||"-",x.n||"-",m.q,x.un||"",m.por,m.st,m.apr||"",m.mot||"",m.foto?"Sim":"Não"]})]},
  faturamento:{nome:"Relatório de faturamento",rows:sel=>{
    const out=[["Contrato","Subempreiteira","Serviço","Un.","Qtd contratada","Qtd medida (aprovada)","Preço unitário (R$)","Valor contratado (R$)","Valor faturável medido (R$)","Saldo a medir (R$)"]];let G=[0,0,0];
    DB.contratos.filter(c=>!sel||c.id==sel).forEach(c=>{let S=[0,0,0];
      (DB.etapas[c.id]||[]).forEach(x=>{const v=[x.c*x.p,x.m*x.p,Math.max(x.c-x.m,0)*x.p];v.forEach((n,i)=>{S[i]+=n;G[i]+=n});out.push([c.cod,c.sub,x.n,x.un,x.c,x.m,x.p,...v])});
      out.push([c.cod,"TOTAL DO CONTRATO","","","","","",...S])});
    if(!sel&&DB.contratos.length>1)out.push(["","TOTAL GERAL","","","","","",...G]);return out}}
};
const exportar=(k,fmt,sel)=>{try{need("relatorios");const r=REL[k],rows=r.rows(sel),arq=`sgf-${k}-${new Date().toISOString().slice(0,10)}`;
  if(fmt==="csv")baixar(arq+".csv","text/csv;charset=utf-8",csv(rows));else imprimir(arq,r.nome,rows,sel);
  log(`Exportou o ${r.nome.toLowerCase()} em ${fmt.toUpperCase()}`);save();
  toast(fmt==="csv"?"CSV gerado. Confira a pasta de downloads.":"Na janela de impressão, escolha “Salvar como PDF”.",1)}catch(e){toast(e.message)}};


// ===== layout: 3 tracinhos, barra lateral, perfil =====
const NAV=[["index.html","Dashboard","dashboard",can("ver_fin")],["contratos.html","Contratos","contratos",1],["etapas.html","Etapas e medições","etapas",1],["relatorios.html","Relatórios","relatorios",can("relatorios")]];
document.body.insertAdjacentHTML("afterbegin",`
<header class="top"><button id="mb" aria-label="Abrir menu" aria-expanded="false"><span></span><span></span><span></span></button>
<strong class="brand">Contratos de Subempreiteiras</strong>
<div class="user"><span class="av"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg></span><span class="un">Perfil: ${ROLES[USER.papel].nome}</span></div></header>
<div id="tt" class="tt" role="alert"></div><div id="lb" hidden><img alt="Evidência da medição ampliada"></div><div id="ov"></div>
<nav id="sb" aria-label="Menu principal"><p>Menu</p>${NAV.filter(n=>n[3]).map(n=>`<a href="${n[0]}"${n[2]===page?' class="cur" aria-current="page"':""}>${n[1]}</a>`).join("")}
<div class="sbf">${can("dados")?'<button id="ex">Exportar dados (backup)</button><button id="im">Importar dados</button><button id="rs">Restaurar dados de exemplo</button><input id="fi" type="file" accept="application/json" hidden>':""}<button id="lo">Sair</button></div></nav>`);
const mb=$("mb"),sb=$("sb"),ov=$("ov");
const tg=o=>{sb.classList.toggle("open",o);ov.classList.toggle("on",o);mb.setAttribute("aria-expanded",o)};
mb.onclick=()=>tg(!sb.classList.contains("open"));ov.onclick=()=>tg(false);
document.addEventListener("keydown",e=>{if(e.key==="Escape"){tg(false);$("lb").hidden=true}});
const toast=(t,ok)=>{const el=$("tt");el.textContent=t;el.className="tt "+(ok?"ok":"err");clearTimeout(toast.h);toast.h=setTimeout(()=>el.className="tt",6000)};
$("lb").onclick=()=>{$("lb").hidden=true};
$("lo").onclick=()=>{sessionStorage.removeItem("sgf-user");location.href="login.html"};
if(can("dados")){
  $("ex").onclick=()=>baixar("sgf-backup-"+new Date().toISOString().slice(0,10)+".json","application/json",JSON.stringify(DB,null,2));
  $("im").onclick=()=>$("fi").click();
  $("fi").onchange=e=>{const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.contratos||!d.etapas||!d.medicoes)throw 0;localStorage.setItem(KEY,JSON.stringify(d));location.reload()}catch(x){toast("Arquivo de backup inválido.")}};r.readAsText(e.target.files[0])};
  $("rs").onclick=()=>{if(confirm("Isso apaga todos os dados salvos e volta aos dados de exemplo. Continuar?")){localStorage.removeItem(KEY);location.reload()}};
}

// ===== formulários =====
const SVC=`<div class="fg"><label>Serviço / etapa<input name="n" maxlength="60" placeholder="Ex.: Tubulação em PVC"></label>
  <label>Unidade<select name="un"><option>m</option><option>m²</option><option>m³</option><option>un</option><option>vb</option></select></label>
  <label>Quantidade contratada<input name="c" inputmode="decimal"></label><label>Preço unitário (R$)<input name="p" inputmode="decimal"></label></div>`;
const FORM=`<form id="nf" class="card nf" hidden novalidate><h2 id="ft">Novo contrato</h2>
  <div class="fg"><label>Subempreiteira<input name="sub" maxlength="60" placeholder="Ex.: Alfa Instalações"></label>
  <label>Objeto do contrato<input name="obj" maxlength="90" placeholder="Ex.: Instalações hidráulicas do bloco B"></label>
  <label>Início<input type="date" name="ini"></label><label>Término previsto<input type="date" name="fim"></label>
  <label id="stw" hidden>Status<select name="status"><option>Ativo</option><option>Em atraso</option><option>Concluído</option></select></label></div>
  <div id="sv"><h3>Primeiro serviço contratado</h3>${SVC}<p class="lg">Valor do contrato: <b id="vp">R$ 0</b></p></div>
  <div class="act"><button type="submit">Salvar contrato</button><button type="button" id="cn" class="lnk">Cancelar</button></div></form>`;

// ===== páginas =====
const app=$("app");
const PAGES={
dashboard(){
  const at=DB.contratos.filter(c=>c.status!=="Concluído"),vt=at.reduce((a,c)=>a+tot(c).v,0);
  const pd=DB.medicoes.filter(m=>m.st==="Pendente"),mx=Math.max(...FAT.map(f=>f[1]));
  app.innerHTML=`<h1>Dashboard</h1><p class="sub">Visão geral dos contratos</p>
  <section class="kpis">
   <div class="kpi"><span>Contratos ativos</span><b>${at.length}</b><small>de ${DB.contratos.length} cadastrados</small></div>
   <div class="kpi"><span>Valor contratado (ativos)</span><b>${R(vt)}</b><small>soma dos itens contratados</small></div>
   <div class="kpi"><span>Medições pendentes</span><b>${pd.length}</b><small>aguardando aprovação</small></div>
   <div class="kpi"><span>Faturamento de outubro</span><b>${R(FAT[FAT.length-1][1])}</b><small>faturado no mês</small></div>
  </section>
  <section class="grid2">
   <div class="card"><h2>Faturamento mensal</h2><div class="bars">${FAT.map(([m,v],i)=>`<div class="bar${i==FAT.length-1?" last":""}"><u>${Math.round(v/1000)}k</u><i style="height:${Math.round(v/mx*150)}px"></i><em>${m}</em></div>`).join("")}</div></div>
   <div class="card"><h2>Medições pendentes</h2><div class="tbl"><table><thead><tr><th>Contrato</th><th>Etapa</th><th>Quantidade</th></tr></thead><tbody>
   ${pd.map(m=>{const c=DB.contratos.find(x=>x.id==m.ct),x=c&&DB.etapas[c.id][m.et];return c&&x?`<tr><td><a href="etapas.html?contrato=${c.id}">${c.cod}</a><br><small>${esc(c.sub)}</small></td><td>${esc(x.n)}</td><td>${N(m.q)} ${x.un}</td></tr>`:""}).join("")||'<tr><td colspan="3">Nenhuma medição pendente.</td></tr>'}
   </tbody></table></div></div>
  </section>
  <div class="card" style="margin-top:14px"><h2>Histórico de ações</h2><ul class="hist">${DB.log.slice(0,8).map(l=>`<li><small>${DT(l.em)}</small> <b>${esc(l.por)}</b>: ${esc(l.m)}</li>`).join("")||"<li>Nenhuma ação registrada ainda.</li>"}</ul></div>`;
},
contratos(){
  const fin=can("ver_fin"),cc=can("contrato_criar"),ce=can("contrato_editar");
  app.innerHTML=`<h1>Contratos</h1><p class="sub">${ce?"Subempreiteiras, valores e prazos. Clique em um contrato para ver suas etapas e medições.":"Consulta dos contratos (somente leitura). Clique em um contrato para registrar medições."}</p>
  <div class="tools"><input id="q" type="search" placeholder="Buscar por subempreiteira, código ou objeto"><select id="st" aria-label="Status"><option value="">Todos os status</option><option>Ativo</option><option>Em atraso</option><option>Concluído</option></select>${cc?'<button id="nb" class="add" type="button">+ Novo contrato</button>':""}</div>
  ${cc||ce?FORM:""}
  <div class="card tbl"><table><thead><tr><th>Código</th><th>Subempreiteira</th>${fin?"<th>Valor contratado</th>":""}<th>Avanço</th><th>Prazo</th><th>Status</th>${ce?"<th></th>":""}</tr></thead><tbody id="tb"></tbody></table></div>`;
  const q_=$("q"),fs=$("st"),tb=$("tb");
  const draw=()=>{const q=q_.value.toLowerCase(),s=fs.value;
    const l=DB.contratos.filter(c=>(!s||c.status===s)&&(c.cod+c.sub+c.obj).toLowerCase().includes(q));
    tb.innerHTML=l.length?l.map(c=>{const t=tot(c),d=Math.round((new Date(c.fim+"T00:00")-REF)/864e5);
      const pz=c.status==="Concluído"?"Encerrado":d<0?`<span class="neg">${-d} dias de atraso</span>`:`${d} dias restantes`;
      return `<tr class="go" data-id="${c.id}"><td>${c.cod}</td><td><a href="etapas.html?contrato=${c.id}">${esc(c.sub)}</a><br><small>${esc(c.obj)}</small></td>${fin?`<td>${R(t.v)}</td>`:""}
      <td class="w">${rule(pc(t),null,1)}<small>${fin?R(t.m)+" · ":""}${P(pc(t))}</small></td><td>${D(c.ini)} a ${D(c.fim)}<br><small>${pz}</small></td><td>${badge(c.status)}</td>${ce?`<td><button class="lnk" data-ed="${c.id}">Editar</button></td>`:""}</tr>`}).join("")
      :`<tr><td colspan="7">Nenhum contrato encontrado. Ajuste a busca ou o filtro.</td></tr>`;};
  tb.onclick=e=>{const b=e.target.closest("[data-ed]");if(b){abrir(b.dataset.ed);return}
    const r=e.target.closest("tr[data-id]");if(r&&!e.target.closest("a"))location.href="etapas.html?contrato="+r.dataset.id};
  q_.oninput=fs.onchange=draw;draw();
  if(!(cc||ce))return;
  const nf=$("nf"),f=nf.elements,vp=$("vp");
  const abrir=id=>{nf.reset();nf.dataset.id=id||"";$("sv").hidden=!!id;$("stw").hidden=!id;$("ft").textContent=id?"Editar contrato":"Novo contrato";
    if(id){const c=DB.contratos.find(x=>x.id==id);f.sub.value=c.sub;f.obj.value=c.obj;f.ini.value=c.ini;f.fim.value=c.fim;f.status.value=c.status}
    vp.textContent=R(0);nf.hidden=false;f.sub.focus();nf.scrollIntoView({block:"nearest"})};
  if(cc)$("nb").onclick=()=>abrir();
  $("cn").onclick=()=>{nf.reset();nf.hidden=true};
  nf.oninput=()=>{vp.textContent=R((num(f.c.value)||0)*(num(f.p.value)||0))};
  nf.onsubmit=e=>{e.preventDefault();const id=nf.dataset.id,o=Object.fromEntries(new FormData(nf));
    if(run(()=>id?ACT.editarContrato(id,o):ACT.novoContrato(o),id?"Contrato atualizado.":"Contrato adicionado com sucesso.")){nf.reset();nf.hidden=true;q_.value="";fs.value="";draw()}};
},
etapas(){
  const fin=can("ver_fin"),med=can("medir"),ce=can("contrato_editar"),ap=can("aprovar");
  app.innerHTML=`<h1>Etapas e medições</h1><p class="sub">${med&&!ap?"Registre o andamento da obra. As medições seguem para aprovação do gestor.":"Contratado x medido x executado"}</p>
  <div class="tools"><select id="ct" aria-label="Contrato">${DB.contratos.map(c=>`<option value="${c.id}">${c.cod} · ${esc(c.sub)}</option>`).join("")}</select>${ce?'<button id="ni" class="add" type="button">+ Adicionar serviço</button>':""}</div>
  ${ce?`<form id="sf" class="card nf" hidden novalidate><h2>Adicionar serviço ao contrato</h2>${SVC}<div class="act"><button type="submit">Salvar serviço</button><button type="button" id="sc" class="lnk">Cancelar</button></div></form>`:""}<div id="et"></div>`;
  const ct=$("ct"),et=$("et"),qid=new URLSearchParams(location.search).get("contrato");
  if(DB.contratos.some(c=>c.id==qid))ct.value=qid;
  const draw=()=>{const c=DB.contratos.find(x=>x.id==ct.value);if(!c){et.innerHTML="<p>Nenhum contrato cadastrado.</p>";return}
    const l=DB.etapas[c.id]||[],t=tot(c),open=c.status!=="Concluído";
    const mine=DB.medicoes.filter(m=>m.ct==c.id).sort((a,b)=>b.em.localeCompare(a.em));
    const na=l.reduce((a,x)=>a+alerts(x).length,0),pd=mine.filter(m=>m.st==="Pendente").length;
    et.innerHTML=`<div class="card sum"><div><span>Status</span>${badge(c.status)}</div><div><span>Avanço medido</span><b>${P(pc(t))}</b></div>${fin?`<div><span>Valor medido</span><b>${R(t.m)}</b></div>`:""}<div><span>Medições pendentes</span><b>${pd}</b></div><div><span>Alertas de divergência</span><b class="${na?"neg":""}">${na}</b></div></div>
    <p class="lg">Barra azul = medido (aprovado) · marcador âmbar = executado em campo</p>
    ${l.map((x,j)=>{const pj=pend(c.id,j);return `<article class="card st"><div class="hd"><h3>${esc(x.n)}</h3>${pj?`<span class="b warn">${N(pj)} ${x.un} pendentes</span>`:""}</div>
    ${rule(x.m/x.c,x.e/x.c)}
    <dl><div><dt>Contratada</dt><dd>${N(x.c)} ${x.un}</dd></div><div><dt>Medida (aprovada)</dt><dd>${N(x.m)} ${x.un} · ${P(x.m/x.c)}</dd></div><div><dt>Executada</dt><dd>${N(x.e)} ${x.un}</dd></div><div><dt>Saldo</dt><dd>${N(Math.max(x.c-x.m,0))} ${x.un}</dd></div></dl>
    ${alerts(x).map(([k,m])=>`<p class="al ${k}">${m}</p>`).join("")}
    ${med&&open?`<form class="reg" data-k="m" data-j="${j}" novalidate><label for="q${j}">Registrar medição (quantidade medida agora, em ${x.un})</label>
    <div class="row"><input id="q${j}" name="q" inputmode="decimal" placeholder="Ex.: 120" autocomplete="off"><span>${x.un}</span><button type="submit">Registrar medição</button></div>
    <label class="fl">Evidência: foto da medição (obrigatória)<input type="file" name="foto" accept="image/*"></label></form>`:""}
    ${ce&&open?`<form class="reg" data-k="e" data-j="${j}" novalidate><label>Alterar valores do contrato (apenas gestor e administrador)</label>
    <div class="row"><input name="c" value="${x.c}" inputmode="decimal" aria-label="Quantidade contratada"><span>${x.un} ×</span><input name="p" value="${x.p}" inputmode="decimal" aria-label="Preço unitário"><span>R$/${x.un}</span><button type="submit">Salvar alteração</button></div></form>`:""}</article>`}).join("")}
    <div class="card tbl"><h2>Medições do contrato</h2><table><thead><tr><th>Data</th><th>Etapa</th><th>Quantidade</th><th>Registrada por</th><th>Evidência</th><th>Situação</th>${ap?"<th></th>":""}</tr></thead><tbody>
    ${mine.map(m=>{const x=l[m.et];return `<tr><td>${DT(m.em)}</td><td>${x?esc(x.n):"-"}</td><td>${N(m.q)} ${x?x.un:""}</td><td>${esc(m.por)}</td><td>${m.foto?`<img class="th" src="${m.foto}" data-ft="${m.id}" alt="Evidência da medição" title="Clique para ampliar">`:"<small>sem evidência</small>"}</td><td>${badge(m.st)}${m.mot?`<br><small>Motivo: ${esc(m.mot)}</small>`:""}</td>${ap?`<td>${m.st==="Pendente"?`<button class="lnk" data-ok="${m.id}">Aprovar</button> <button class="lnk neg" data-no="${m.id}">Rejeitar</button>`:""}</td>`:""}</tr>`}).join("")||`<tr><td colspan="7">Nenhuma medição registrada neste contrato.</td></tr>`}
    </tbody></table></div>`;};
  et.onsubmit=async e=>{e.preventDefault();const f=e.target,j=+f.dataset.j,o=Object.fromEntries(new FormData(f));let ok;
    if(f.dataset.k==="m"){let foto=null;try{foto=await lerFoto(f.elements.foto.files[0])}catch(x){toast(x.message);return}
      ok=run(()=>ACT.medir(ct.value,j,o.q,foto),"Medição registrada e enviada para aprovação.")}
    else ok=run(()=>ACT.editarItem(ct.value,j,o.c,o.p),"Valores do contrato atualizados.");
    if(ok)draw()};
  et.onclick=e=>{const a=e.target.closest("[data-ok]"),r=e.target.closest("[data-no]"),t=e.target.closest("[data-ft]");
    if(t){const m=DB.medicoes.find(x=>x.id==t.dataset.ft);if(m&&m.foto){$("lb").querySelector("img").src=m.foto;$("lb").hidden=false}return}
    if(a&&run(()=>ACT.decidir(a.dataset.ok,true),"Medição aprovada."))draw();
    if(r){const mot=prompt("Motivo da rejeição:");if(mot===null)return;if(run(()=>ACT.decidir(r.dataset.no,false,mot),"Medição rejeitada."))draw()}};
  if(ce){const sf=$("sf");
    $("ni").onclick=()=>{sf.hidden=false;sf.elements.n.focus()};$("sc").onclick=()=>{sf.reset();sf.hidden=true};
    sf.onsubmit=e=>{e.preventDefault();if(run(()=>ACT.novoItem(ct.value,Object.fromEntries(new FormData(sf))),"Serviço adicionado ao contrato.")){sf.reset();sf.hidden=true;draw()}}}
  ct.onchange=draw;draw();
},
relatorios(){
  app.innerHTML=`<h1>Relatórios</h1><p class="sub">Exportação de medições e faturamento. Disponível apenas para o administrador.</p>
  <div class="tools"><select id="rc" aria-label="Contrato"><option value="">Todos os contratos</option>${DB.contratos.map(c=>`<option value="${c.id}">${c.cod} · ${esc(c.sub)}</option>`).join("")}</select></div>
  <section class="grid2">
   <div class="card"><h2>Relatório de medições</h2><p class="lg">Todas as medições: quantidade, situação, quem registrou, quem decidiu e se há foto de evidência.</p><div class="act"><button class="add" id="mc" type="button">Baixar CSV</button><button class="add sec" id="mp" type="button">Gerar PDF</button></div></div>
   <div class="card"><h2>Relatório de faturamento</h2><p class="lg">Valor contratado, valor medido aprovado (faturável) e saldo a medir, por serviço e por contrato.</p><div class="act"><button class="add" id="fc" type="button">Baixar CSV</button><button class="add sec" id="fp" type="button">Gerar PDF</button></div></div>
  </section>
  <div class="card tbl" style="margin-top:14px"><h2>Prévia do faturamento</h2><div id="pv"></div></div>`;
  const rc=$("rc"),pv=()=>{$("pv").innerHTML=tabelaHtml(REL.faturamento.rows(rc.value))};
  rc.onchange=pv;pv();
  $("mc").onclick=()=>exportar("medicoes","csv",rc.value);$("mp").onclick=()=>exportar("medicoes","pdf",rc.value);
  $("fc").onclick=()=>exportar("faturamento","csv",rc.value);$("fp").onclick=()=>exportar("faturamento","pdf",rc.value);
}};
PAGES[page]();
