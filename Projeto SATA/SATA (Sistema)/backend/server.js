// Inicialização do servidor HTTP da API SATA (Express)
const { app, init } = require('./app');
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// Métrica de doações definida em app.js

// Inicialização e execução local
(async () => {
  await init(false);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
})();
