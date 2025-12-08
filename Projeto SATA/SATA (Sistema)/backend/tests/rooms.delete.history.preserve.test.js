const assert = require('assert');
const db = require('../config/database');
const QuartoController = require('../controllers/quartoController');

module.exports = async function roomsDeleteHistoryPreserve() {
  const [qr] = await db.execute('INSERT INTO quartos (numero, capacidade, descricao, status) VALUES (?,?,?,?)', ['HP-01', 2, 'Histórico', 'disponivel']);
  const quartoId = qr.insertId;
  const [ir] = await db.execute('INSERT INTO idosos (nome, data_nascimento, genero, rg, cpf, cartao_sus, telefone, rua, numero, cidade, estado_id, cep, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', ['Idoso Hist', '1955-05-05', 'Masculino', 'RGX', '000.000.000-01', '999999999999999', '000', 'Rua', '1', 'Cidade', 1, '00000-000', 'nao_internado']);
  const idosoId = ir.insertId;
  const [inRow] = await db.execute('INSERT INTO internacoes (idoso_id, quarto_id, cama, data_entrada, status) VALUES (?,?,?,?,?)', [idosoId, quartoId, 'A', new Date().toISOString().slice(0,10), 'finalizada']);

  const req = { params: { id: String(quartoId) }, user: { id: 1, username: 'tester', role: 'Admin' } };
  let statusCode = 200; let payload = null;
  const res = { status(code) { statusCode = code; return this; }, json(obj) { payload = obj; return obj; } };

  await QuartoController.delete(req, res);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(Boolean(payload && payload.success), true);

  const [chkInt] = await db.execute('SELECT quarto_id FROM internacoes WHERE id = ?', [inRow.insertId]);
  assert.ok(Array.isArray(chkInt) && chkInt[0], 'internacao deve existir');
  assert.strictEqual(chkInt[0].quarto_id, null, 'quarto_id deve virar NULL ao excluir quarto');

  // cleanup
  try { await db.execute('DELETE FROM internacoes WHERE id = ?', [inRow.insertId]); } catch {}
  try { await db.execute('DELETE FROM idosos WHERE id = ?', [idosoId]); } catch {}
}

