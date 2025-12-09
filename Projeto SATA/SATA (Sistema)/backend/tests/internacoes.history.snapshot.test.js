const assert = require('assert');
const db = require('../config/database');
const InternacaoRepository = require('../repository/internacaoRepository');
const QuartoController = require('../controllers/quartoController');

module.exports = async function internacoesHistorySnapshot() {
  const [qr] = await db.execute('INSERT INTO quartos (numero, capacidade, descricao, status) VALUES (?,?,?,?)', ['SNP-1', 2, 'Snapshot Room', 'disponivel']);
  const qId = qr.insertId;
  const [ir] = await db.execute('INSERT INTO idosos (nome, data_nascimento, genero, rg, cpf, cartao_sus, telefone, rua, numero, cidade, estado_id, cep, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', ['Histórico', '1950-01-01', 'Masculino', 'RG1', '000.000.000-11', '999999999999999', '000', 'Rua', '1', 'Cidade', 1, '00000-000', 'nao_internado']);
  const idosoId = ir.insertId;
  const [inr] = await db.execute('INSERT INTO internacoes (idoso_id, quarto_id, cama, data_entrada, status) VALUES (?,?,?,?,?)', [idosoId, qId, 'A', new Date().toISOString().slice(0,10), 'finalizada']);
  const intId = inr.insertId;

  const req = { params: { id: String(qId) } };
  const res = { status() { return this; }, json() { return null; } };
  await QuartoController.delete(req, res);

  const [rows] = await db.execute('SELECT quarto_id, quarto_numero, quarto_descricao FROM internacoes WHERE id = ?', [intId]);
  const r = rows[0];
  assert.ok(r);
  assert.strictEqual(r.quarto_id, null);
  assert.strictEqual(typeof r.quarto_numero, 'string');

  const list = await InternacaoRepository.findByUsuarioId(idosoId);
  assert.ok(Array.isArray(list) && list.length > 0);
  assert.ok(list.some(x => x.quarto_numero === r.quarto_numero));

  // cleanup
  try { await db.execute('DELETE FROM internacoes WHERE id = ?', [intId]); } catch {}
  try { await db.execute('DELETE FROM idosos WHERE id = ?', [idosoId]); } catch {}
}

