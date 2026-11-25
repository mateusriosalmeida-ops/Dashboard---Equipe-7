const go=p=>location.replace(p==="peao"?"etapas.html":"index.html");
const ju=JSON.parse(sessionStorage.getItem("sgf-user")||"null");
if(ju)go(ju.papel);
document.getElementById("lf").onsubmit=e=>{e.preventDefault();const f=e.target,er=document.getElementById("er");
  const x=USERS.find(y=>y.login===f.u.value.trim().toLowerCase()&&y.senha===f.s.value);
  if(!x){er.textContent=f.u.value.trim()&&f.s.value?"Usuário ou senha inválidos.":"Informe usuário e senha.";return}
  sessionStorage.setItem("sgf-user",JSON.stringify({login:x.login,papel:x.papel,nome:ROLES[x.papel].nome}));go(x.papel)};
