const assert = require('assert');
const bcrypt = require('bcryptjs');
const UsersController = require('../controllers/usersController');
const AuthController = require('../controllers/authController');
const Users = require('../repository/userRepository');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; }
  };
}

async function createUser(username, email, role, canReset = 0) {
  const hash = await bcrypt.hash('Teste@123', 10);
  const id = await Users.create({ username, email, password_hash: hash, role, status: 'ativo' });
  if (typeof canReset === 'number') {
    const db = require('../config/database');
    await db.query('UPDATE users SET can_reset_passwords = ? WHERE id = ?', [canReset, id]);
  }
  return id;
}

async function cleanupUser(id) {
  try { await Users.deleteUser(id); } catch {}
}

module.exports = async function run() {
  // Cadastro sem validação de email
  {
    const req = { body: { username: 'novo_user_t', email: 'novo@test.local', role: 'Funcionário', password: 'Teste@1234' } };
    const res = makeRes();
    await UsersController.create(req, res);
    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body && res.body.data && res.body.data.status === 'ativo', 'Novo usuário deve estar ativo');
    const id = res.body.data.id;
    const u = await Users.findById(id);
    assert.ok(!u.email_validation_token, 'Não deve existir token de validação');
    await cleanupUser(id);
  }

  // Política de reset: admin sem privilégio não pode resetar funcionário
  const adminNoPriv = await createUser('admin_nop', 'anp@test.local', 'Admin', 0);
  const adminPriv = await createUser('admin_priv', 'apr@test.local', 'Admin', 1);
  const staff1 = await createUser('func_t1', 'ft1@test.local', 'Funcionário');
  const admin2 = await createUser('admin_t2', 'at2@test.local', 'Admin');

  try {
    // Admin sem privilégio tentando resetar funcionário → 403
    {
      const req = { body: { email: 'ft1@test.local' }, user: { id: adminNoPriv, role: 'Admin' } };
      const res = makeRes();
      await AuthController.forgotPassword(req, res);
      assert.strictEqual(res.statusCode, 403, 'Admin sem privilégio deve ser bloqueado');
    }
    // Admin com privilégio pode iniciar reset para funcionário → 200
    {
      const req = { body: { email: 'ft1@test.local' }, user: { id: adminPriv, role: 'Admin' } };
      const res = makeRes();
      process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.SMTP_PASS = '';
      await AuthController.forgotPassword(req, res);
      assert.strictEqual(res.statusCode, 200, 'Admin com privilégio deve conseguir');
      assert.ok(res.body && res.body.success === true, 'Resposta de sucesso esperada');
    }
    // Admin não pode iniciar reset para outro admin → 403
    {
      const req = { body: { email: 'at2@test.local' }, user: { id: adminPriv, role: 'Admin' } };
      const res = makeRes();
      await AuthController.forgotPassword(req, res);
      assert.strictEqual(res.statusCode, 403, 'Admin→Admin deve ser bloqueado');
    }
  } finally {
    await cleanupUser(staff1);
    await cleanupUser(admin2);
    await cleanupUser(adminPriv);
    await cleanupUser(adminNoPriv);
  }
}
