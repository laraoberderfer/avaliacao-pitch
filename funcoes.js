/* ============================================================
   PitchIA — funcoes.js
   Camadas: DB (Google Sheets publicado + localStorage) → Model → UI
   Fonte dos grupos: planilha publicada como CSV (tempo real)
   Avaliações: localStorage + export JSON (backup)
   ============================================================ */

/* ---------- CONFIGURAÇÃO ---------- */
// URL da planilha PUBLICADA como CSV (formato /d/e/.../pub — NÃO usar gviz com esse ID):
// Arquivo → Compartilhar → Publicar na web → aba "Grupos" → CSV
// gid=0 = primeira aba. Se "Grupos" não for a primeira, use o gid dela
// (visível na URL do Sheets após #gid=)
const URL_PLANILHA = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRsJJql2PQmqdTB8cNYP7DqIcBc0P6uM0eUwacQiD8xNu9W7Ns9ndZzu1sFfYwDBDTtJ1PF6tVE_2Df/pub?gid=0&single=true&output=csv";

const CONFIG_PADRAO = {
  instituicao: "IFSC — Câmpus Chapecó",
  disciplina: "Inteligência Artificial",
  moedasPorAvaliador: 100,
  minimoGrupos: 3,
  senhaAdmin: "ifsc2026"
};

/* ---------- MODEL: estrutura de dados ---------- */
const Model = {
  db: null,
  semestre: null,
  turma: null,

  async carregar() {
    const rascunho = localStorage.getItem("pitchia_db");
    if (rascunho) { this.db = JSON.parse(rascunho); return true; }

    const url = URL_PLANILHA + "&cachebust=" + Date.now();
    const resp = await fetch(url);                    // sem try/catch: deixa estourar
    const texto = await resp.text();

    if (!resp.ok)
        throw new Error(`HTTP ${resp.status} — o Google recusou a URL. Confira o formato /d/e/.../pub?output=csv`);
    if (texto.trim().startsWith("<"))
        throw new Error("Recebi uma página HTML (login ou erro 404), não CSV. Refaça: Arquivo → Compartilhar → Publicar na web → aba Grupos → CSV");
    if (texto.trim() === "")
        throw new Error("CSV veio vazio — a aba publicada está sem dados ou o gid está errado");

    this.db = csvParaDB(texto);
    this.salvar();
     return true;
    },

  salvar() { localStorage.setItem("pitchia_db", JSON.stringify(this.db)); },

  grupos() {
    return this.db.semestres[this.semestre].turmas[this.turma].grupos;
  },

  avaliacoes() {
    return this.db.semestres[this.semestre].turmas[this.turma].avaliacoes;
  },

  minhaAvaliacao(email) {
    return this.avaliacoes().find(a => a.email === email) || null;
  },

  salvarAvaliacao(av) {
    const lista = this.avaliacoes();
    const i = lista.findIndex(a => a.email === av.email);
    if (i >= 0) lista[i] = av; else lista.push(av);
    this.salvar();
  },

  consolidado() {
    const resumo = {};
    this.grupos().forEach(g => resumo[g.id] = { grupo: g, moedas: 0, notas: [], n: 0 });
    this.avaliacoes().forEach(a => {
      Object.entries(a.investimentos || {}).forEach(([id, m]) => {
        if (resumo[id]) resumo[id].moedas += m;
      });
      Object.entries(a.notas || {}).forEach(([id, ns]) => {
        if (resumo[id]) {
          const media = Object.values(ns).reduce((s, v) => s + v, 0) / Object.values(ns).length;
          resumo[id].notas.push(media); resumo[id].n++;
        }
      });
    });
    return Object.values(resumo).sort((a, b) => b.moedas - a.moedas);
  }
};

/* ---------- CONVERSÃO: CSV da planilha → estrutura do DB ---------- */
function csvParaDB(csv) {
  csv = csv.replace(/^\uFEFF/, ""); // remove BOM do Google

  // parser simples de CSV (suporta campos entre aspas com vírgula)
  const linhas = csv.trim().split("\n").map(l => {
    const campos = [];
    let atual = "", dentro = false;
    for (const ch of l) {
      if (ch === '"') { dentro = !dentro; continue; }
      if (ch === "," && !dentro) { campos.push(atual); atual = ""; continue; }
      atual += ch;
    }
    campos.push(atual);
    return campos.map(c => c.trim());
  });

  const [cabecalho, ...dados] = linhas;
  const idx = Object.fromEntries(cabecalho.map((c, i) => [c.toLowerCase(), i]));

  const db = { config: { ...CONFIG_PADRAO }, semestres: {} };

  dados.forEach(l => {
    const sem = l[idx["semestre"]], turma = l[idx["turma"]];
    if (!sem || !turma) return;
    db.semestres[sem] ??= { turmas: {} };
    db.semestres[sem].turmas[turma] ??= { grupos: [], avaliacoes: [] };
    db.semestres[sem].turmas[turma].grupos.push({
      id: l[idx["id"]],
      nome: l[idx["nome"]],
      projeto: l[idx["projeto"]],
      problema: l[idx["problema"]]
    });
  });

  return db;
}

/* ---------- SEGURANÇA: sanitização e validação ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const emailValido = e => /^[a-z0-9._-]+@aluno\.ifsc\.edu\.br$/i.test(e.trim());

/* ---------- SESSÃO ---------- */
const Sessao = {
  email: localStorage.getItem("pitchia_email") || null,
  isAdmin() { return this.email === "admin@ifsc.edu.br"; }
};

function entrar() {
  const email = document.getElementById("email").value.trim();
  const sel = document.getElementById("sel-turma-login").value; // formato "semestre|turma"
  [Model.semestre, Model.turma] = sel.split("|");
  const erro = document.getElementById("erro-login");

  if (email === Model.db.config.senhaAdmin) {        // acesso da professora
    Sessao.email = "admin@ifsc.edu.br";
  } else if (emailValido(email)) {                   // acesso do aluno
    Sessao.email = email.toLowerCase();
  } else {
    erro.textContent = "Use um e-mail válido @aluno.ifsc.edu.br (ou a senha de admin).";
    return;
  }
  localStorage.setItem("pitchia_email", Sessao.email);
  iniciarApp();
}

function sair() {
  localStorage.removeItem("pitchia_email");
  location.reload();
}

/* ---------- ATUALIZAR DADOS DA PLANILHA (botão 🔄) ---------- */
async function atualizarDados() {
  if (!confirm("Recarregar os grupos da planilha? As avaliações salvas neste dispositivo serão mantidas.")) return;
  try {
    const url = URL_PLANILHA + "&cachebust=" + Date.now();
    const resp = await fetch(url);
    const csv = await resp.text();
    if (csv.trim().startsWith("<")) throw new Error("A planilha retornou login, não CSV.");
    const novo = csvParaDB(csv);

    // preserva as avaliações já salvas no dispositivo
    Object.keys(novo.semestres).forEach(sem => {
      Object.keys(novo.semestres[sem].turmas).forEach(t => {
        const antiga = Model.db.semestres?.[sem]?.turmas?.[t];
        if (antiga) novo.semestres[sem].turmas[t].avaliacoes = antiga.avaliacoes || [];
      });
    });

    Model.db = novo;
    Model.salvar();
    renderAvaliar();
    alert("✅ Grupos atualizados da planilha!");
  } catch (e) {
    alert("⚠️ Não foi possível atualizar: " + e.message);
  }
}

/* ---------- ESTADO DA AVALIAÇÃO (poucos cliques) ---------- */
let rascunho = { investimentos: {}, notas: {} };

function investir(id, delta) {
  const total = Object.values(rascunho.investimentos).reduce((s, v) => s + v, 0);
  const atual = rascunho.investimentos[id] || 0;
  if (delta > 0 && total + delta > Model.db.config.moedasPorAvaliador) return;
  if (delta < 0 && atual === 0) return;
  rascunho.investimentos[id] = atual + delta;
  if (rascunho.investimentos[id] === 0) delete rascunho.investimentos[id];
  renderAvaliar();
}

function notaEstrela(id, valor) {
  rascunho.notas[id] = valor;
  renderAvaliar();
}

function enviarAvaliacao() {
  const msg = document.getElementById("msg-avaliar");
  const investidos = Object.keys(rascunho.investimentos).length;
  const total = Object.values(rascunho.investimentos).reduce((s, v) => s + v, 0);
  const min = Model.db.config.minimoGrupos;

  if (investidos < min) { msg.textContent = `Investa em pelo menos ${min} grupos diferentes.`; return; }
  if (total < Model.db.config.moedasPorAvaliador) { msg.textContent = "Distribua todas as 100 moedas."; return; }
  if (Object.keys(rascunho.notas).length === 0) { msg.textContent = "Dê pelo menos uma nota."; return; }

  Model.salvarAvaliacao({
    email: Sessao.email,
    notas: rascunho.notas,
    investimentos: rascunho.investimentos,
    timestamp: new Date().toISOString()
  });
  msg.textContent = "";
  alert("✅ Avaliação registrada! Obrigado por participar da banca.");
  renderDashboard();
  trocarAba("dashboard");
}

/* ---------- RENDER: avaliar ---------- */
function renderAvaliar() {
  const existente = Model.minhaAvaliacao(Sessao.email);
  if (existente && !rascunho._carregado) {
    rascunho = { investimentos: { ...existente.investimentos }, notas: { ...existente.notas }, _carregado: true };
  }
  const gasto = Object.values(rascunho.investimentos).reduce((s, v) => s + v, 0);
  document.getElementById("saldo").textContent = Model.db.config.moedasPorAvaliador - gasto;
  document.getElementById("barra").style.width = gasto + "%";

  document.getElementById("lista-grupos").innerHTML = Model.grupos().map(g => {
    const inv = rascunho.investimentos[g.id] || 0;
    const nt = rascunho.notas[g.id] || 0;
    const estrelas = [1, 2, 3, 4, 5].map(i =>
      `<span class="${i <= nt ? "on" : ""}" onclick="notaEstrela('${g.id}',${i})">⭐</span>`).join("");
    return `<div class="grupo">
      <h3>${esc(g.nome)} — ${esc(g.projeto)}</h3>
      <p class="problema">${esc(g.problema)}</p>
      <div class="chips">
        <button class="menos" onclick="investir('${g.id}',-10)">−10</button>
        <button onclick="investir('${g.id}',10)">+10</button>
        <button onclick="investir('${g.id}',25)">+25</button>
        <button onclick="investir('${g.id}',50)">+50</button>
        <span class="investido">${inv > 0 ? "💰 " + inv : ""}</span>
      </div>
      <div class="estrelas">${estrelas}</div>
    </div>`;
  }).join("");
}

/* ---------- RENDER: dashboard ---------- */
function renderDashboard() {
  const dados = Model.consolidado();
  const medalhas = ["ouro", "prata", "bronze"];
  document.getElementById("podio").innerHTML = dados.slice(0, 3).map((d, i) =>
    `<div class="${medalhas[i]}"><b>${["🥇", "🥈", "🥉"][i]}</b><br>${esc(d.grupo.projeto)}<br><small>${d.moedas} moedas</small></div>`).join("");

  const max = Math.max(...dados.map(d => d.moedas), 1);
  document.getElementById("ranking").innerHTML = dados.map(d => {
    const media = d.notas.length ? (d.notas.reduce((s, v) => s + v, 0) / d.notas.length).toFixed(1) : "—";
    return `<div class="linha-rank">
      <b style="min-width:130px">${esc(d.grupo.projeto)}</b>
      <div class="barra-g" style="width:${(d.moedas / max) * 70}%"></div>
      <span>${d.moedas} 💰</span><span>⭐ ${media}</span><span>(${d.n} avaliações)</span>
    </div>`;
  }).join("");
}

/* ---------- RENDER: admin ---------- */
function renderAdmin() {
  document.getElementById("admin-grupos").innerHTML = Model.grupos().map((g, i) =>
    `<div class="grupo">
      <input value="${esc(g.nome)}" onchange="editarGrupo(${i},'nome',this.value)" placeholder="Nome do grupo">
      <input value="${esc(g.projeto)}" onchange="editarGrupo(${i},'projeto',this.value)" placeholder="Projeto">
      <input value="${esc(g.problema)}" onchange="editarGrupo(${i},'problema',this.value)" placeholder="Problema">
    </div>`).join("");
}

function editarGrupo(i, campo, valor) {
  Model.grupos()[i][campo] = valor.trim();
  Model.salvar();
}

/* Backup das avaliações (os grupos vêm da planilha) */
function exportarDB() {
  const blob = new Blob([JSON.stringify(Model.db, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "pitchia_backup.json";
  a.click();
}

/* ---------- NAVEGAÇÃO E BOOT ---------- */
function trocarAba(aba) {
  ["avaliar", "dashboard", "admin"].forEach(a =>
    document.getElementById("aba-" + a).classList.toggle("oculto", a !== aba));
  document.querySelectorAll("nav button[data-aba]").forEach(b =>
    b.classList.toggle("ativo", b.dataset.aba === aba));
  if (aba === "dashboard") renderDashboard();
  if (aba === "admin") renderAdmin();
}

async function iniciarApp() {
  document.getElementById("tela-login").classList.add("oculto");
  document.getElementById("app").classList.remove("oculto");
  document.getElementById("boas-vindas").textContent =
    Sessao.isAdmin() ? "🔧 Modo admin" : "👋 " + Sessao.email;
  document.getElementById("btn-admin").classList.toggle("oculto", !Sessao.isAdmin());
  rascunho = { investimentos: {}, notas: {} };
  renderAvaliar();
  trocarAba("avaliar");
}

document.querySelectorAll("nav button[data-aba]").forEach(b =>
  b.addEventListener("click", () => trocarAba(b.dataset.aba)));

(async function boot() {
  try {
    const ok = await Model.carregar();
    if (!ok) throw new Error("Sem rascunho local e sem planilha");
  } catch (e) {
    document.body.innerHTML =
      "<p style='padding:40px;color:#F8FAFC'>⚠️ <b>" + e.message + "</b>" +
      "<br><br>URL usada: <code>" + URL_PLANILHA + "</code></p>";
    return;
  }

  // carrega: rascunho local OU planilha
  const ok = await Model.carregar();
  if (!ok) {
    document.body.innerHTML =
      "<p style='padding:40px;color:#F8FAFC'>⚠️ Falha de rede ao buscar a planilha. Se está abrindo localmente (file://), rode <code>python -m http.server 8000</code> ou teste pelo GitHub Pages.</p>";
    return;
  }

  // diagnóstico 2: a resposta veio vazia ou sem a coluna esperada
  if (!Model.db.semestres || Object.keys(Model.db.semestres).length === 0) {
    document.body.innerHTML =
      "<p style='padding:40px;color:#F8FAFC'>⚠️ A planilha carregou, mas nenhum grupo foi lido. Verifique se a aba publicada tem as colunas id, nome, projeto, problema, turma, semestre — e se o gid na URL_PLANILHA é o da aba 'Grupos'.</p>";
    return;
  }

  // popula o seletor de turmas do login (formato "semestre|turma")
  const sel = document.getElementById("sel-turma-login");
  Object.entries(Model.db.semestres).forEach(([sem, s]) =>
    Object.keys(s.turmas).forEach(t => {
      const op = document.createElement("option");
      op.value = `${sem}|${t}`;
      op.textContent = `${sem} · ${t}`;
      sel.appendChild(op);
    }));

  if (Sessao.email) iniciarApp();   // sessão persistida: entra direto
})();