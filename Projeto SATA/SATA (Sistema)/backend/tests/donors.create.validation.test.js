const assert = require('assert');
const DoadorController = require('../controllers/doadorController');
const DoadorRepository = require('../repository/doadoRepository');

function mockRes() {
  let statusCode = 200; let jsonBody = null;
  return {
    get statusCode() { return statusCode; },
    get body() { return jsonBody; },
    status(code) { statusCode = code; return this; },
    json(obj) { jsonBody = obj; return obj; }
  };
}

module.exports = async function donorsCreateValidation() {
  const req1 = { body: { nome: 'Do Teste', cpf: '123.456.789-10', telefone: '(11)99999-0000', email: 'do@test.local' } };
  const res1 = mockRes();
  await DoadorController.create(req1, res1);
  assert.strictEqual(res1.statusCode, 201);

  const reqDup = { body: { nome: 'Outro', cpf: '123.456.789-10', telefone: '(11)98888-0000' } };
  const resDup = mockRes();
  await DoadorController.create(reqDup, resDup);
  assert.strictEqual(resDup.statusCode, 409);

  // cleanup
  try {
    const d = await DoadorRepository.findByCpf('12345678910');
    if (d && d.id) { await DoadorRepository.delete(d.id); }
  } catch {}
}
