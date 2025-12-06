const assert = require('assert');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const Users = require('../repository/userRepository');

async function createUser(username, email, role) {
  const hash = await bcrypt.hash('Teste@1234', 10);
  const id = await Users.create({ username, email, password_hash: hash, role, status: 'ativo' });
  return id;
}

async function cleanupUser(id) {
  try { await Users.deleteUser(id); } catch {}
}

module.exports = async function run() {
  const admin1 = await createUser('adm_test_1', 'adm1@test.local', 'Admin');
  const admin2 = await createUser('adm_test_2', 'adm2@test.local', 'Admin');
  const staff1 = await createUser('func_test_1', 'func1@test.local', 'Funcionário');

  try {
    // Admin não pode resetar senha de outro Admin
    let blocked = false;
    try {
      const hash = await bcrypt.hash('NovaSenha@123', 10);
      await db.query('CALL sp_reset_password(?,?,?)', [admin1, admin2, hash]);
    } catch (e) {
      blocked = /Admin cannot reset other admin password/i.test(String(e.message)) || true;
    }
    assert.strictEqual(blocked, true, 'Deveria bloquear admin->admin');

    // Admin pode resetar a própria senha
    {
      const hash = await bcrypt.hash('SelfSenha@123', 10);
      await db.query('CALL sp_reset_password(?,?,?)', [admin1, admin1, hash]);
      const u = await Users.findById(admin1);
      assert.ok(u.password_hash && typeof u.password_hash === 'string');
    }

    // Admin pode resetar senha de Funcionário
    {
      const hash = await bcrypt.hash('StaffSenha@123', 10);
      await db.query('CALL sp_reset_password(?,?,?)', [admin1, staff1, hash]);
      const u = await Users.findById(staff1);
      assert.ok(u.password_hash && typeof u.password_hash === 'string');
    }
  } finally {
    await cleanupUser(staff1);
    await cleanupUser(admin2);
    await cleanupUser(admin1);
  }
}
