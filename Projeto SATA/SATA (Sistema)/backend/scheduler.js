const cron = require('node-cron');
const ProdutoRepository = require('./repository/produtoRepository');
const db = require('./config/database');

// Verificação de eventos próximos removida

cron.schedule('*/10 * * * *', () => {
  try { ProdutoRepository.checkAndNotifyLowStock(); } catch (_) {}
});

// Agendador iniciado (silencioso)

cron.schedule('* * * * *', async () => {
  try {
    await db.execute(`DELETE FROM notificacoes WHERE id NOT IN (
      SELECT id FROM (
        SELECT id FROM notificacoes ORDER BY data_criacao DESC, id DESC LIMIT 20
      ) AS t
    )`);
  } catch (_) {}
});

// Limpeza imediata de preferências de notificação de eventos e notificações de eventos
(async () => {
  try {
    await db.execute(`UPDATE eventos SET notificar = 0, tempo_notificacao = 0`);
  } catch (_) {}
  try {
    await db.execute(`DELETE FROM notificacoes WHERE tipo = 'evento_proximo'`);
  } catch (_) {}
})();
