
---

## ⚙️ Configuração (2 passos)

### 1. Planilha de grupos (Google Sheets)

1. Importe o arquivo `pitchia_planilha_modelo.xlsx` para o Google Drive e abra com Sheets
2. Edite os grupos na aba **Grupos** (colunas: `id, nome, projeto, problema, turma, semestre`)
3. Publique: **Arquivo → Compartilhar → Publicar na web → aba "Grupos" → CSV → Publicar**
4. Copie a URL gerada (formato `.../d/e/2PACX-.../pub?gid=0&single=true&output=csv`)
5. Cole a URL na constante `URL_PLANILHA` no topo do `funcoes.js`

> ⚠️ O ID que começa com `2PACX-` só funciona no formato `/d/e/.../pub` —
> não use com o endpoint `gviz/tq`.

### 2. Publicar no GitHub Pages

1. Crie um repositório e suba os 4 arquivos
2. **Settings → Pages → Source: main branch → Save**
3. O sistema fica disponível em `https://SEUUSUARIO.github.io/NOMEREPO/`

---

## 👥 Como usar

### Alunos
1. Acessam o link pelo celular
2. Entram com o e-mail institucional `@aluno.ifsc.edu.br` e escolhem a turma
3. Durante cada pitch: tocam em **+10 / +25 / +50** para investir moedas e
   tocam nas ⭐ para avaliar (1 a 5)
4. A barra fixa no topo mostra o saldo de moedas em tempo real
5. Enviar exige: 100 moedas distribuídas em **no mínimo 3 grupos** + pelo menos 1 nota
6. Reentrar com o mesmo e-mail permite **editar** a avaliação (não duplica)

### Professora (admin)
1. No campo de login, digite a senha de admin (padrão: `ifsc2026` — altere em
   `CONFIG_PADRAO.senhaAdmin` no `funcoes.js`)
2. Aba **Admin**: editar grupos inline (salvamento automático)
3. Botão **🔄 Atualizar**: relê a planilha sem perder as avaliações do dispositivo
4. Botão **⬇️ Baixar db.json**: backup das avaliações (export/import JSON)

---

## 🔐 Segurança

- Login validado por domínio institucional (regex `@aluno.ifsc.edu.br`)
- Sanitização anti-XSS (`esc()`) em todo texto renderizado
- A planilha publicada é **somente leitura e pública**: nunca coloque a senha
  de admin nela nem dados pessoais de alunos
- Nenhum dado sensível é armazenado: apenas nome de grupos, e-mail e notas
- A autenticação é client-side (adequada para uso em sala); para autenticação
  real, integre Firebase Auth

---

## 🛠️ Personalização

| O quê | Onde |
|---|---|
| Moedas por avaliador | `CONFIG_PADRAO.moedasPorAvaliador` |
| Mínimo de grupos investidos | `CONFIG_PADRAO.minimoGrupos` |
| Senha de admin | `CONFIG_PADRAO.senhaAdmin` |
| Grupos/turmas/semestres | Aba "Grupos" da planilha |
| Valores dos botões de investimento | Função `renderAvaliar()` no `funcoes.js` |

---

## 🚨 Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Não foi possível carregar a planilha" | URL errada ou aberto via `file://` | Use a URL `/d/e/.../pub` completa; teste via GitHub Pages ou `python -m http.server 8000` |
| Página de login do Google no fetch | Planilha compartilhada, não publicada | Refaça: Arquivo → Compartilhar → **Publicar na web** → CSV |
| Nenhum grupo carrega | `gid` errado ou cabeçalhos renomeados | Confira o `gid` da aba Grupos e mantenha os cabeçalhos originais |
| Edições da planilha não aparecem | Cache do rascunho local | Clique em **🔄 Atualizar** |

---

## 📄 Licença e créditos

Projeto didático desenvolvido para uso em sala de aula — IFSC Câmpus Chapecó.
Professora: Lara P. Z. B. Oberderfer.
