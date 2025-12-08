const assert = require('assert');
const db = require('../config/database');
const QuartoController = require('../controllers/quartoController');

module.exports = async function roomsDeleteValidation() {
  const [qr] = await db.execute('INSERT INTO quartos (nome, capacidade, status) VALUES (?,?,?)', ['Teste Q', 2, 'disponivel']);
  const quartoId = qr.insertId;
  const [ir] = await db.execute('INSERT INTO idosos (nome, data_nascimento, sexo, documento, telefone, endereco, status) VALUES (?,?,?,?,?,?,?)', ['Idoso Teste', '1950-01-01', 'M', '00000000000', '000000000', 'Rua X', 'ativo']);
  const idosoId = ir.insertId;
  const [inRow] = await db.execute('INSERT INTO internacoes (idoso_id, quarto_id, data_entrada, status) VALUES (?,?,NOW(),?)', [idosoId, quartoId, 'ativa']);

  const req = { params: { id: String(quartoId) } };
  let statusCode = 200; let payload = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json(obj) { payload = obj; return obj; }
  };

  try {
    await QuartoController.delete(req, res);
    assert.strictEqual(statusCode, 409);
    assert.strictEqual(Boolean(payload && payload.success === false), true);
  } finally {
    try { await db.execute('DELETE FROM internacoes WHERE id = ?', [inRow.insertId]); } catch {}
    try { await db.execute('DELETE FROM idosos WHERE id = ?', [idosoId]); } catch {}
    try { await db.execute('DELETE FROM quartos WHERE id = ?', [quartoId]); } catch {}
  }
}

