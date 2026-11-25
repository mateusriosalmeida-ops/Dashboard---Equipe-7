// DADOS FICTÍCIOS INICIAIS. Depois do primeiro uso, tudo é salvo no navegador (localStorage).
const ROLES = {
  admin:  {nome:"Administrador",     perm:["ver_fin","contrato_criar","contrato_editar","medir","aprovar","dados","relatorios"]},
  gestor: {nome:"Gestor financeiro", perm:["ver_fin","contrato_criar","contrato_editar","aprovar"]},
  peao:   {nome:"Peão",              perm:["medir"]}
};
const USERS = [ // acessos de demonstração (em um sistema real, a senha ficaria no servidor, nunca no código)
  {login:"admin",  senha:"admin123",  papel:"admin"},
  {login:"gestor", senha:"gestor123", papel:"gestor"},
  {login:"peao",   senha:"peao123",   papel:"peao"}
];
const REF = new Date(new Date().toDateString()); // hoje

// c = contratada, m = medida (aprovada), e = executada em campo, p = preço unitário (R$)
const SEED = {
  contratos:[
    {id:1, cod:"CT-2026-001", sub:"Eletrosul Instalações", obj:"Instalações elétricas do bloco A", ini:"2026-03-02", fim:"2026-12-18", status:"Ativo"},
    {id:2, cod:"CT-2026-002", sub:"Concreta Estruturas",   obj:"Fundações e estrutura de concreto", ini:"2026-02-02", fim:"2026-09-30", status:"Em atraso"},
    {id:3, cod:"CT-2026-003", sub:"ClimaTec Ar-condicionado", obj:"Dutos, splits e comissionamento", ini:"2026-02-16", fim:"2026-08-28", status:"Concluído"}
  ],
  etapas:{
    1:[{n:"Instalação de eletrodutos",un:"m",c:1500,m:975,e:1010,p:180},
       {n:"Lançamento de cabeamento",un:"m",c:4200,m:1800,e:1820,p:95},
       {n:"Quadros de distribuição",un:"un",c:24,m:6,e:6,p:6800},
       {n:"Luminárias",un:"un",c:320,m:0,e:0,p:420}],
    2:[{n:"Fundações",un:"m³",c:640,m:650,e:640,p:980},
       {n:"Estrutura de concreto",un:"m³",c:1200,m:780,e:850,p:1350},
       {n:"Alvenaria",un:"m²",c:5400,m:1900,e:1900,p:92}],
    3:[{n:"Dutos",un:"m",c:900,m:900,e:900,p:310},
       {n:"Splits instalados",un:"un",c:48,m:48,e:48,p:4200},
       {n:"Comissionamento",un:"vb",c:1,m:1,e:1,p:35000}]
  },
  medicoes:[
    {id:1,ct:1,et:0,q:175,por:"Peão",em:"2026-11-05T10:00:00",st:"Aprovada",apr:"Gestor financeiro"},
    {id:2,ct:1,et:1,q:120,por:"Peão",em:"2026-11-20T09:30:00",st:"Pendente"},
    {id:3,ct:2,et:1,q:70,por:"Peão",em:"2026-11-21T14:10:00",st:"Pendente"}
  ]
};
const FAT = [["Mar",82000],["Abr",140000],["Mai",215000],["Jun",198000],["Jul",260000],["Ago",310000],["Set",275000],["Out",240000]];
