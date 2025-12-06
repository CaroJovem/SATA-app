/*
  Controlador de Usuários
  - CRUD de perfis, atualização de status, validação e reenvio de email.
  - Aplica normalização de papel e políticas de senha.
  - Integra com serviço de email (SMTP) e registra eventos de auditoria quando disponível.
*/
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const UserRepository = require('../repository/userRepository');
const User = require('../models/user');

// Normaliza papel para valores válidos no sistema
function normalizeRole(role) {
  if (!role) return 'Funcionário';
  const r = String(role).toLowerCase();
  if (r.includes('admin')) return 'Admin';
  if (r.includes('funcion')) return 'Funcionário';
  if (r.includes('user') || r.includes('usuário') || r.includes('usuario')) return 'Funcionário';
  return 'Funcionário';
}

class UsersController {
  /*
    Listagem de usuários
    Parâmetros (query): `status`, `role`, `page`, `pageSize`, `search`
    - Suporta paginação e filtro por status/papel e termo de busca.
  */
  async list(req, res) {
    try {
      const { status, role, page = 1, pageSize = 10, search } = req.query;
      const result = await UserRepository.findAll({ status, role, page, pageSize, search });
      return res.json({ success: true, data: result });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao listar usuários', detail: err.message });
    }
  }

  /*
    Criação de usuário
    Parâmetros (body): `username`, `email`, `role`, `password`
    - Valida entrada, unicidade e política de senha; cria perfil com status `ativo`.
    - Envio de email de validação desativado.
  */
  async create(req, res) {
    try {
      const { username, email, role, password } = req.body;
      const user = new User({ username, email, password, role: normalizeRole(role) });
      const errors = user.validate({ forCreate: true });
      if (errors.length) return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors });
      const pwErr = require('../utils/passwordPolicy').checkPassword(password);
      if (pwErr) return res.status(400).json({ success: false, error: pwErr });
      const existing = await UserRepository.findByUsername(username);
      if (existing) return res.status(409).json({ success: false, error: 'Nome do Usuário já utilizado' });
      const existingEmail = await UserRepository.findByEmail(email);
      if (existingEmail) return res.status(409).json({ success: false, error: 'Email já utilizado' });
      const bcrypt = require('bcryptjs');
      const ph = await bcrypt.hash(String(password), 10);
      const id = await UserRepository.create({ username, email, password_hash: ph, role: normalizeRole(role), status: 'ativo' });
      try { const { log } = require('../utils/auditLogger'); log('user.create', { id, username, email, role: normalizeRole(role), status: 'ativo', actor: req.user || null }); } catch {}
      return res.status(201).json({ success: true, message: 'Perfil criado com sucesso.', data: { id, username, email, role: normalizeRole(role), status: 'ativo' } });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao criar usuário', detail: err.message });
    }
  }

  /*
    Atualização de usuário
    Parâmetros: `id` (params), `username`, `email`, `role` (body)
    - Garante unicidade ao alterar nome/email e normaliza papel.
  */
  async update(req, res) {
    try {
      const { id } = req.params;
      const { username, email, role } = req.body;
      const current = await UserRepository.findById(id);
      if (!current) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

      if (username !== current.username) {
        const existing = await UserRepository.findByUsername(username);
        if (existing && Number(existing.id) !== Number(id)) return res.status(409).json({ success: false, error: 'Nome do Usuário já utilizado' });
      }
      if (email !== current.email) {
        const existingEmail = await UserRepository.findByEmail(email);
        if (existingEmail && Number(existingEmail.id) !== Number(id)) return res.status(409).json({ success: false, error: 'Email já utilizado' });
      }
      const ok = await UserRepository.updateUser(id, { username, email, role: normalizeRole(role) });
      if (!ok) return res.status(500).json({ success: false, error: 'Falha ao atualizar' });
      try { const { log } = require('../utils/auditLogger'); log('user.update', { id, changes: { username, email, role: normalizeRole(role) }, actor: req.user || null }); } catch {}
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao atualizar usuário', detail: err.message });
    }
  }

  /*
    Exclusão de usuário
    Parâmetros: `id` (params)
    - Remove perfil e registra auditoria de deleção quando disponível.
  */
  async remove(req, res) {
    try {
      const { id } = req.params;
      const ok = await UserRepository.deleteUser(id);
      if (!ok) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      try { const { logDeletion } = require('../utils/auditLogger'); logDeletion({ entity: 'user', id, actor: req.user || null }); } catch {}
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao excluir usuário', detail: err.message });
    }
  }

  // Removido: atualização de status via endpoint administrativo

  /*
    Validar email
    - Desativado: fluxo de validação por email removido.
  */
  async validateEmail(req, res) {
    return res.status(410).json({ success: false, error: 'Validação por email desativada' });
  }

  /*
    Reenviar validação de email
    - Desativado: envio de validação por email removido.
  */
  async resendValidation(req, res) {
    return res.status(410).json({ success: false, error: 'Validação por email desativada' });
  }

  /*
    Permissões do usuário autenticado para gerenciamento de senhas
    - Retorna papel e flag `can_reset_passwords` para o frontend decidir quais opções exibir.
  */
  async getPermissions(req, res) {
    try {
      if (!req.user || !req.user.id) return res.status(401).json({ success: false, error: 'Não autenticado' });
      const u = await UserRepository.findById(req.user.id);
      if (!u) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      const role = String(u.role || 'Funcionário');
      const canReset = Number(u.can_reset_passwords || 0) === 1;
      return res.json({ success: true, data: { role, can_reset_passwords: canReset, allowed_actions: { reset_employee: role === 'Admin' && canReset, reset_admin_others: false } } });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao obter permissões', detail: err.message });
    }
  }
}

/*
  Envio de email de validação
  Parâmetros: `email`, `username`, `token`
  - Usa SMTP configurável (ou Gmail como fallback) e inclui preheader para melhores clientes.
  - Em ambientes sem SMTP, imprime link no console.
*/
async function sendValidationEmail({ email, username, token }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromAddr = process.env.SMTP_FROM || 'satasyst3m@gmail.com';
  const fromName = process.env.SMTP_FROM_NAME || 'SATA Sistema';
  const frontUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const safeFrontUrl = frontUrl.includes('localhost') ? frontUrl : frontUrl.replace(/^http:/, 'https:');
  const link = `${safeFrontUrl}/validate-email?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
      <h2 style="color:#1976d2">Validação de email</h2>
      <p>Olá ${username},</p>
      <p>Para concluir o cadastro, valide seu email clicando no botão abaixo. O link expira em 24 horas.</p>
      <p style="text-align:center;margin:30px 0">
        <a href="${link}" style="background:#1976d2;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Validar email</a>
      </p>
      <p>Se você não solicitou, ignore esta mensagem.</p>
      <hr/>
      <small>Equipe SATA</small>
    </div>
  `;
  if (smtpHost && smtpUser && smtpPass) {
    const secure = (process.env.SMTP_SECURE === 'true') || smtpPort === 465;
    const requireTLS = process.env.SMTP_REQUIRE_TLS === 'true';
    const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
    const smtpService = process.env.SMTP_SERVICE;
    let transporter;
    try {
      if (smtpService) {
        transporter = nodemailer.createTransport({ service: smtpService, secure: false, auth: { user: smtpUser, pass: smtpPass }, pool: true, maxConnections: 2, connectionTimeout: 7000, greetingTimeout: 7000, socketTimeout: 9000 });
      } else {
        transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure, requireTLS, tls: { rejectUnauthorized }, auth: { user: smtpUser, pass: smtpPass }, pool: true, maxConnections: 2, connectionTimeout: 7000, greetingTimeout: 7000, socketTimeout: 9000 });
      }
    } catch (e) {
      try {
        transporter = nodemailer.createTransport({ service: 'gmail', secure: false, auth: { user: smtpUser, pass: smtpPass }, pool: true, maxConnections: 2, connectionTimeout: 7000, greetingTimeout: 7000, socketTimeout: 9000 });
      } catch (e2) {
        console.info('SMTP indisponível:', e.message);
        console.log('SMTP não configurado. Link de validação:', link);
        return;
      }
    }
    const preheader = `Valide seu email para ativar sua conta no SATA. O link expira em 24 horas.`;
    const html2 = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
        <h2 style="color:#1976d2;margin:0 0 16px">Confirmar endereço de email</h2>
        <p style="margin:0 0 12px">Olá ${username},</p>
        <p style="margin:0 0 16px">Para concluir seu cadastro no <strong>SATA</strong>, confirme seu email clicando no botão abaixo. Este link é válido por 24 horas.</p>
        <p style="text-align:center;margin:24px 0">
          <a href="${link}" style="background:#1976d2;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block">Validar email</a>
        </p>
        <p style="margin:0 0 12px">Se você não solicitou esta confirmação, por favor ignore este email.</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
        <p style="font-size:12px;color:#666;margin:0">${fromName} · Sistema de Gestão · Suporte: ${fromAddr}</p>
      </div>
    `;
    try {
      const timeoutSend = new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP send timeout')), 10000));
      await Promise.race([transporter.sendMail({ from: `${fromName} <${fromAddr}>`, to: email, replyTo: fromAddr, subject: 'Confirme seu email | SATA', text: `Olá ${username},\n\nPara concluir seu cadastro no SATA, confirme seu email acessando o link (válido por 24 horas):\n${link}\n\nSe você não solicitou esta confirmação, ignore esta mensagem.\n\n${fromName}`, html: html2, headers: { 'X-Auto-Response-Suppress': 'All' } }), timeoutSend]);
    } catch (e3) {
      console.info('Envio de validação indisponível:', e3.message);
      console.log('SMTP não configurado. Link de validação:', link);
      return;
    }
  } else {
    console.log('SMTP não configurado. Link de validação:', link);
  }
}

module.exports = new UsersController();
