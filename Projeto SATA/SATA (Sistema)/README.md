# SATA (Sistema)

Sistema de gestão para instituições de acolhimento. Centraliza cadastros de idosos e internações, controle de quartos, agenda de eventos, estoque de produtos e doações, financeiro local e um centro de notificações com alertas (ex.: estoque baixo).

## Organização do Repositório

- `backend/`
  - `config/`: conexão com banco e `Tabelas.sql` (schema).
  - `controllers/`: regras de entrada das rotas (REST). Exemplos: `idosoController.js`, `produtoController.js`, `notificacaoController.js`.
  - `repository/`: acesso e consultas ao banco por entidade. Exemplos: `idosoRepository.js`, `movimentoEstoqueRepository.js`, `notificacaoRepository.js`.
  - `models/`: classes de domínio e validação. Exemplos: `idoso.js`, `produto.js`, `notificacao.js`.
  - `routers/`: mapeamento das rotas Express por módulo. Exemplos: `idosoRouters.js`, `produtoRouters.js`, `notificacaoRouters.js`.
  - `services/`: serviços de regras de negócio transversais. Exemplos: `DonationStockService.js` (estoque via doações).
  - `utils/`: utilitários (formatação, cache, política de senha, auditoria).
  - Arquivos principais: `app.js` (app Express), `server.js` (bootstrap), `scheduler.js` (tarefas agendadas), `swagger.js` (documentação de API), `.env`.

- `frontend/`
  - `public/`: arquivos estáticos (ex.: `index.html`).
  - `src/`: aplicação React (SPA)
    - `components/`: componentes reutilizáveis
      - `dashboard/`: cartões e gráficos (`StatCard.jsx`, `TrendChart.jsx`).
      - `home/`: mosaico de ações (`ActionTile.jsx`).
      - `produtos/`: formulários e modais de estoque (`MovimentacaoModal.jsx`).
      - `ui/`: elementos de interface (`PageHeader.jsx`, `HelpButton.jsx`, `StandardTable.jsx`).
      - `auth/`: proteção de rotas (`ProtectedRoute.jsx`).
      - Comuns: `Navbar.jsx`, `UserBar.jsx`, `ConfirmModal.jsx`.
    - `context/`: contextos globais (`AuthContext.jsx`, `DialogContext.jsx`).
    - `hooks/`: hooks como `useAuth.js`.
    - `pages/`: páginas da aplicação
      - Principais: `Home.jsx` (dashboard), `Notificacoes.jsx`, `Idosos*`, `SataInternacoes.jsx`, `SataListaQuartos.jsx`, `Eventos.jsx`, `Produtos.jsx`, `Financeiro*.jsx`, `Doacoes.jsx`, `SataDoadores.jsx`, `Usuarios.jsx`, `Perfis.jsx`.
      - Impressões: `*Print.jsx`.
      - Autenticação: `Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `ChangePassword.jsx`.
    - `services/`: acesso à API (Axios). Exemplos: `api.js`, `notificacoesService.js`, `idosoService.js`, `produtosService.js`, `eventosService.js`.
    - `assets/`, `styles/`: imagens e estilos.
    - Entradas: `App.jsx`, `main.jsx`.
  - `netlify/`: funções serverless (se necessário).
  - Configuração e scripts: `package.json`, `eslint.config.js`, `jsconfig.json`.

## Observações

- Notificações: há endpoint de contadores no backend e fallback no frontend para garantir a exibição correta de “não lidas”.
- Estoque: ao registrar movimentações, o sistema verifica e cria alerta de `estoque_baixo` quando a quantidade fica abaixo do mínimo.

## Como executar (desenvolvimento)

- Pré-requisitos
  - Node.js 18+ e npm
  - MySQL (ou MariaDB) acessível

- Banco de dados
  - Crie o banco e as tabelas executando `backend/config/Tabelas.sql` no seu servidor MySQL.
  - Configure variáveis no `backend/.env` (ex.: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`).

- Backend (API)
  - Instale dependências: `npm install`
  - Inicie em desenvolvimento: `npm run dev`
  - A API ficará disponível em `http://localhost:3000/api`
  - Documentação interativa (Swagger): `http://localhost:3000/api/docs`

- Frontend (SPA)
  - Instale dependências: `npm install`
  - Inicie em desenvolvimento: `npm run dev`
  - A aplicação abrirá em `http://localhost:5173`
  - O cliente já aponta para a API em `http://localhost:3000/api` quando rodando localmente (`src/services/api.js`).

- Comandos úteis
  - Frontend: `npm run lint`, `npm run build`, `npm run preview`
  - Backend: `npm run start` (produção), `npm run dev` (desenvolvimento)
