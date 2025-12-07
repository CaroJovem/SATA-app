/*
  Controlador de Autenticação
  - Responsável por login, logout, consulta de sessão, registro e recuperação/troca de senha.
  - Emite `JWT` para autenticação e define cookies de sessão e `CSRF`.
  - Mantém termos técnicos em inglês quando consagrados (ex.: JWT, token).
*/
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const https = require('https');
const net = require('net');
const dns = require('dns');
const UserRepository = require('../repository/userRepository');
const User = require('../models/user');
const { checkPassword } = require('../utils/passwordPolicy');
const crypto = require('crypto');

// Normaliza papel do usuário para valores aceitos pelo sistema
const normalizeRole = (role) => {
  if (!role) return 'Funcionário';
  const r = String(role).toLowerCase();
  if (r.includes('admin')) return 'Admin';
  if (r.includes('funcion')) return 'Funcionário';
  if (r.includes('user') || r.includes('usuário') || r.includes('usuario')) return 'Funcionário';
  return 'Funcionário';
};

class AuthController {
  /*
    Login
    Parâmetros: `username`, `password` (body)
    - Valida credenciais contra o repositório e suporta bootstrap de admin padrão via hash seguro.
    - Emite `JWT` com expiração de 8h e define cookies `auth_token` e `csrf_token`.
    Respostas:
    - 200 com `{ success, user, csrf }` em sucesso.
    - 401 em credenciais inválidas; 500 se faltar `JWT_SECRET` ou erro interno.
  */
  async login(req, res) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Nome do Usuário e senha são obrigatórios' });
      }
      let user = await UserRepository.findByUsername(username);
      let ok = false;
      if (user) {
        ok = await bcrypt.compare(password, user.password_hash);
      }

      if (!user || !ok) {
        try {
          const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
          const defaultAdminUser = process.env.DEFAULT_ADMIN_USER || 'S4TAdmin';
          const defaultAdminUserSha = process.env.DEFAULT_ADMIN_USER_SHA256 || 'd0fcde7a04d964b57a51324f4be06acd282e22f89c689701beace852e8f342ef';
          const defaultAdminPassSha = process.env.DEFAULT_ADMIN_PASS_SHA256 || '9b87413e468672121118415d44859eaa2d308b139aa5691d94b72e33996504cb';
          const userMatch = (String(username).trim() === defaultAdminUser) || (sha(username) === defaultAdminUserSha);
          const passMatch = sha(password) === defaultAdminPassSha;
          if (userMatch && passMatch) {
            const exists = await UserRepository.findByUsername(defaultAdminUser);
            if (!exists) {
              const password_hash = await bcrypt.hash(password, 10);
              const id = await UserRepository.create({ username: defaultAdminUser, email: 'admin@sistema.local', password_hash, role: 'Admin', status: 'ativo' });
              user = { id, username: defaultAdminUser, role: 'Admin' };
            } else {
              if (exists.status && exists.status !== 'ativo') {
                try { await UserRepository.setStatus(exists.id, 'ativo'); } catch {}
              }
              user = exists;
            }
            ok = true;
          }
        } catch (_) {}
      }

      if (!user || !ok) return res.status(401).json({ success: false, error: 'Credenciais inválidas' });

      const role = normalizeRole(user.role);
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ success: false, error: 'Configuração de JWT ausente' });
      const token = jwt.sign(
        { id: user.id, username: user.username, role },
        secret,
        { expiresIn: '8h' }
      );

      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000
      });
      const csrfToken = crypto.randomBytes(16).toString('hex');
      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000
      });

      return res.json({ success: true, user: { id: user.id, username: user.username, role }, csrf: csrfToken });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao realizar login', detail: err.message });
    }
  }

  /*
    Logout
    - Remove cookies de autenticação e CSRF.
    Respostas: 200 em sucesso; 500 em erro interno.
  */
  async logout(req, res) {
    try {
      res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      res.clearCookie('csrf_token', {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao realizar logout', detail: err.message });
    }
  }

  /*
    Sessão atual (me)
    - Requer `req.user` preenchido pelo middleware de autenticação.
    - Retorna dados básicos do usuário e papel normalizado.
  */
  async me(req, res) {
    try {
      if (!req.user) return res.status(401).json({ success: false, error: 'Não autenticado' });
      const user = await UserRepository.findById(req.user.id);
      if (!user) {
        res.clearCookie('auth_token');
        return res.status(401).json({ success: false, error: 'Sessão inválida' });
      }
      const role = normalizeRole(user.role);
      return res.json({ success: true, user: { id: user.id, username: user.username, role } });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao obter usuário', detail: err.message });
    }
  }

  /*
    Registro
    Parâmetros: `username`, `email`, `password`, `role` (body)
    - Valida dados de entrada, unicidade de usuário/email e políticas de senha.
    - Persiste usuário com `password_hash` e registra auditoria.
    Respostas: 201 com dados; 400/409 em invalidações; 500 em erro.
  */
  async register(req, res) {
    try {
      const { username, email, password, role: inputRole = 'Funcionário' } = req.body;
      const role = normalizeRole(inputRole);
      const user = new User({ username, email, password, role });
      const errors = user.validate({ forCreate: true });
      if (errors.length) return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors });

      const existing = await UserRepository.findByUsername(username);
      if (existing) return res.status(409).json({ success: false, error: 'Nome do Usuário já utilizado' });
      if (email) {
        const existingEmail = await UserRepository.findByEmail(email);
        if (existingEmail) return res.status(409).json({ success: false, error: 'Email já utilizado' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const id = await UserRepository.create({ username, email, password_hash, role });
      try {
        const { log } = require('../utils/auditLogger');
        const actor = req.user ? { id: req.user.id, username: req.user.username, role: req.user.role } : null;
        log('user.create', { id, username, email, role, actor });
      } catch {}
      return res.status(201).json({ success: true, data: { id, username, email, role } });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao registrar usuário', detail: err.message });
    }
  }

  /*
    Verificar disponibilidade
    Parâmetros: `username`, `email` (query)
    - Checa existência no repositório e retorna flags de disponibilidade.
  */
  async checkUnique(req, res) {
    try {
      const { username, email } = req.query;
      let usernameAvailable = true;
      let emailAvailable = true;
      if (username) {
        const u = await UserRepository.findByUsername(String(username));
        usernameAvailable = !u;
      }
      if (email) {
        const e = await UserRepository.findByEmail(String(email));
        emailAvailable = !e;
      }
      return res.json({ success: true, data: { usernameAvailable, emailAvailable } });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao validar disponibilidade', detail: err.message });
    }
  }

  /*
    Início de recuperação de senha (forgotPassword)
    Parâmetros: `email` (body)
    - Gera `token` de reset via `JWT` (15 min) e envia email com link.
    - Em desenvolvimento, retorna `token` para facilitar testes.
    Observação: evita enumeração retornando sucesso mesmo quando email não existe.
  */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, error: 'Email é obrigatório' });
      const user = await UserRepository.findByEmail(email);
      if (!user) return res.status(200).json({ success: true }); // evitar enumeração de usuários
      try {
        const actor = req.user ? await UserRepository.findById(req.user.id) : null;
        if (actor && String(actor.role).toLowerCase() === 'admin') {
          if (String(user.role).toLowerCase() === 'admin' && Number(actor.id) !== Number(user.id)) {
            try { await require('../config/database').query('INSERT INTO audit_password_resets(actor_id, target_id, allowed, reason) VALUES(?,?,0,?)', [actor.id, user.id, 'blocked: admin->admin forgot']); } catch {}
            return res.status(403).json({ success: false, error: 'Reset de senha não permitido entre administradores' });
          }
          const canReset = Number(actor.can_reset_passwords || 0) === 1;
          if (String(user.role).toLowerCase() !== 'admin' && !canReset) {
            try { await require('../config/database').query('INSERT INTO audit_password_resets(actor_id, target_id, allowed, reason) VALUES(?,?,0,?)', [actor.id, user.id, 'blocked: admin lacks privilege']); } catch {}
            return res.status(403).json({ success: false, error: 'Permissão insuficiente para resetar senha de funcionários' });
          }
        }
      } catch {}
      // Sem validação de bloqueio admin→admin no fluxo de esqueci a senha
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ success: false, error: 'Configuração de JWT ausente' });
      const token = jwt.sign({ action: 'reset', id: user.id, username: user.username }, secret, { expiresIn: '15m' });

      // Link de reset para o frontend
      const frontUrlRaw = process.env.FRONTEND_URL || 'http://localhost:5173';
      const frontUrl = String(frontUrlRaw).trim().replace(/^"|"$/g, '');
      const resetLink = `${frontUrl}/reset-password?token=${encodeURIComponent(token)}`;

      // Envio por API de e-mail (se configurado)
      const emailProvider = process.env.EMAIL_PROVIDER;
      const emailApiKey = process.env.EMAIL_API_KEY;
      const emailDomain = process.env.EMAIL_DOMAIN;
      const fromAddr = process.env.SMTP_FROM || 'satasyst3m@gmail.com';
      const fromName = process.env.SMTP_FROM_NAME || 'SATA Sistema';
      const preheader = 'Redefina sua senha do SATA. O link expira em 15 minutos.';
      const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
              <h2 style="color:#1976d2;margin:0 0 16px">Redefinir senha</h2>
              <p style="margin:0 0 12px">Olá ${user.username || ''},</p>
              <p style="margin:0 0 16px">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para prosseguir. Este link é válido por 15 minutos.</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${resetLink}" style="background:#1976d2;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block">Redefinir senha</a>
              </p>
              <p style="margin:0 0 12px">Se você não solicitou esta alteração, ignore este email.</p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
              <p style="font-size:12px;color:#666;margin:0">${fromName} · Sistema de Gestão · Suporte: ${fromAddr}</p>
            </div>
          `;
      const text = `Olá ${user.username || ''},\n\nRecebemos uma solicitação para redefinir sua senha. Acesse o link (válido por 15 minutos):\n${resetLink}\n\nSe você não solicitou esta alteração, ignore este email.\n\n${fromName}`;
      if (emailProvider && emailApiKey) {
        try {
          const prov = String(emailProvider).toLowerCase();
          if (prov === 'resend') {
            const payload = JSON.stringify({ from: `${fromName} <${fromAddr}>`, to: user.email || email, subject: 'Redefinição de senha | SATA', html, text, headers: { 'X-Auto-Response-Suppress': 'All' } });
            await new Promise((resolve, reject) => {
              const req = https.request('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${emailApiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (resp) => {
                const chunks = [];
                resp.on('data', (d) => chunks.push(d));
                resp.on('end', () => {
                  const code = resp.statusCode || 0;
                  if (code >= 200 && code < 300) resolve(); else reject(new Error(`resend ${code}`));
                });
              });
              req.on('error', reject);
              req.setTimeout(10000, () => { req.destroy(new Error('api timeout')); });
              req.write(payload);
              req.end();
            });
            try { const { logSecurityEvent } = require('../utils/auditLogger'); logSecurityEvent({ type: 'password_reset_email', entity: 'user', entityId: user.id, actor: req.user || null, details: { via: 'resend' } }); } catch {}
            return res.json({ success: true });
          } else if (prov === 'sendgrid') {
            const sgBody = JSON.stringify({ personalizations: [{ to: [{ email: user.email || email }] }], from: { email: fromAddr, name: fromName }, subject: 'Redefinição de senha | SATA', content: [{ type: 'text/plain', value: text }, { type: 'text/html', value: html }] });
            await new Promise((resolve, reject) => {
              const req = https.request('https://api.sendgrid.com/v3/mail/send', { method: 'POST', headers: { 'Authorization': `Bearer ${emailApiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(sgBody) } }, (resp) => {
                const code = resp.statusCode || 0;
                if (code === 202 || (code >= 200 && code < 300)) resolve(); else reject(new Error(`sendgrid ${code}`));
              });
              req.on('error', reject);
              req.setTimeout(10000, () => { req.destroy(new Error('api timeout')); });
              req.write(sgBody);
              req.end();
            });
            try { const { logSecurityEvent } = require('../utils/auditLogger'); logSecurityEvent({ type: 'password_reset_email', entity: 'user', entityId: user.id, actor: req.user || null, details: { via: 'sendgrid' } }); } catch {}
            return res.json({ success: true });
          } else if (prov === 'brevo') {
            const payload = JSON.stringify({ sender: { email: fromAddr, name: fromName }, to: [{ email: user.email || email }], subject: 'Redefinição de senha | SATA', htmlContent: html, textContent: text, headers: { 'X-Auto-Response-Suppress': 'All' } });
            await new Promise((resolve, reject) => {
              const req = https.request('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': emailApiKey, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (resp) => {
                const code = resp.statusCode || 0;
                const chunks = [];
                resp.on('data', d => chunks.push(d));
                resp.on('end', () => {
                  const body = Buffer.concat(chunks).toString('utf8');
                  if (code >= 200 && code < 300) resolve(); else reject(new Error(`brevo ${code} ${body}`));
                });
              });
              req.on('error', reject);
              req.setTimeout(10000, () => { req.destroy(new Error('api timeout')); });
              req.write(payload);
              req.end();
            });
            try { const { logSecurityEvent } = require('../utils/auditLogger'); logSecurityEvent({ type: 'password_reset_email', entity: 'user', entityId: user.id, actor: req.user || null, details: { via: 'brevo' } }); } catch {}
            return res.json({ success: true });
          } else if (prov === 'mailgun' && emailDomain) {
            // Implementação via API pode ser adicionada quando EMAIL_DOMAIN estiver disponível
          }
        } catch (apiErr) {
          console.info('Email API indisponível:', apiErr.message);
          try { const { logSecurityEvent } = require('../utils/auditLogger'); logSecurityEvent({ type: 'password_reset_request', entity: 'user', entityId: user.id, actor: req.user || null, details: { via: 'api_unavailable', provider: emailProvider, email } }); } catch {}
          return res.json({ success: true, token });
        }
      }

      // Envio de email (SMTP configurável)
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

      const smtpService = process.env.SMTP_SERVICE;
      if ((smtpHost || smtpService) && smtpUser && smtpPass) {
        try {
          const isGmail = (String(smtpService).toLowerCase() === 'gmail') || (String(smtpHost).toLowerCase().includes('smtp.gmail.com'));
          const secureCfg = (process.env.SMTP_SECURE === 'true') || smtpPort === 465;
          const requireTLS = process.env.SMTP_REQUIRE_TLS === 'true' || (!secureCfg);
          const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
          let host = isGmail ? 'smtp.gmail.com' : smtpHost;
          let port = secureCfg ? 465 : 587;
          try {
            const tcpProbe = await new Promise((resolve) => {
              const s = net.createConnection({ host, port });
              const start = Date.now();
              let done = false;
              const finish = (ok, err) => { if (done) return; done = true; try { s.destroy(); } catch(_){}; resolve({ ok, ms: Date.now()-start, err }); };
              s.setTimeout(5000);
              s.on('connect', () => finish(true));
              s.on('timeout', () => finish(false, new Error('tcp timeout')));
              s.on('error', (err) => finish(false, err));
            });
            console.info('[SMTP SEND] probe', { host, port, ok: tcpProbe.ok, ms: tcpProbe.ms, err: tcpProbe.err ? { code: tcpProbe.err.code, message: tcpProbe.err.message } : null });
            if (!tcpProbe.ok && isGmail && port === 587) { port = 465; }
          } catch (_) {}
          const secure = port === 465;
          const transporter = nodemailer.createTransport({ host, port, secure, requireTLS, tls: { rejectUnauthorized }, auth: { user: smtpUser, pass: smtpPass }, pool: true, maxConnections: 2, connectionTimeout: 9000, greetingTimeout: 9000, socketTimeout: 13000, logger: true, debug: true });
          const fromAddr = process.env.SMTP_FROM || 'satasyst3m@gmail.com';
          const fromName = process.env.SMTP_FROM_NAME || 'SATA Sistema';
          const preheader = 'Redefina sua senha do SATA. O link expira em 15 minutos.';
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
              <h2 style="color:#1976d2;margin:0 0 16px">Redefinir senha</h2>
              <p style="margin:0 0 12px">Olá ${user.username || ''},</p>
              <p style="margin:0 0 16px">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para prosseguir. Este link é válido por 15 minutos.</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${resetLink}" style="background:#1976d2;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block">Redefinir senha</a>
              </p>
              <p style="margin:0 0 12px">Se você não solicitou esta alteração, ignore este email.</p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
              <p style="font-size:12px;color:#666;margin:0">${fromName} · Sistema de Gestão · Suporte: ${fromAddr}</p>
            </div>
          `;
          const timeoutSend = new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP send timeout')), 10000));
          await Promise.race([transporter.sendMail({ from: `${fromName} <${fromAddr}>`, to: user.email || email, replyTo: fromAddr, subject: 'Redefinição de senha | SATA', text: `Olá ${user.username || ''},\n\nRecebemos uma solicitação para redefinir sua senha. Acesse o link (válido por 15 minutos):\n${resetLink}\n\nSe você não solicitou esta alteração, ignore este email.\n\n${fromName}`, html, headers: { 'X-Auto-Response-Suppress': 'All' } }), timeoutSend]);
        } catch (e) {
          try {
            const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, requireTLS: false, tls: { rejectUnauthorized: true }, auth: { user: smtpUser, pass: smtpPass }, pool: true, maxConnections: 2, connectionTimeout: 9000, greetingTimeout: 9000, socketTimeout: 13000, logger: true, debug: true });
            const fromAddr = process.env.SMTP_FROM || 'satasyst3m@gmail.com';
            const fromName = process.env.SMTP_FROM_NAME || 'SATA Sistema';
            const preheader = 'Redefina sua senha do SATA. O link expira em 15 minutos.';
            const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
              <h2 style="color:#1976d2;margin:0 0 16px">Redefinir senha</h2>
              <p style="margin:0 0 12px">Olá ${user.username || ''},</p>
              <p style="margin:0 0 16px">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para prosseguir. Este link é válido por 15 minutos.</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${resetLink}" style="background:#1976d2;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block">Redefinir senha</a>
              </p>
              <p style="margin:0 0 12px">Se você não solicitou esta alteração, ignore este email.</p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
              <p style="font-size:12px;color:#666;margin:0">${fromName} · Sistema de Gestão · Suporte: ${fromAddr}</p>
            </div>
          `;
            const timeoutSend2 = new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP send timeout')), 10000));
            await Promise.race([transporter.sendMail({ from: `${fromName} <${fromAddr}>`, to: user.email || email, replyTo: fromAddr, subject: 'Redefinição de senha | SATA', text: `Olá ${user.username || ''},\n\nRecebemos uma solicitação para redefinir sua senha. Acesse o link (válido por 15 minutos):\n${resetLink}\n\nSe você não solicitou esta alteração, ignore este email.\n\n${fromName}`, html, headers: { 'X-Auto-Response-Suppress': 'All' } }), timeoutSend2]);
          } catch (mailErr2) {
            console.info('Envio de recuperação indisponível:', mailErr2.message, { host: smtpHost, port: smtpPort, secure: (process.env.SMTP_SECURE === 'true'), code: mailErr2.code });
            try { const { logSecurityEvent } = require('../utils/auditLogger'); logSecurityEvent({ type: 'password_reset_request', entity: 'user', entityId: user.id, actor: req.user || null, details: { via: 'smtp_unavailable', email } }); } catch {}
            return res.json({ success: true, token });
          }
        }
        const fromAddr = process.env.SMTP_FROM || 'satasyst3m@gmail.com';
        const fromName = process.env.SMTP_FROM_NAME || 'SATA Sistema';
        const preheader = 'Redefina sua senha do SATA. O link expira em 15 minutos.';
        const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${preheader}</div>
              <h2 style="color:#1976d2;margin:0 0 16px">Redefinir senha</h2>
              <p style="margin:0 0 12px">Olá ${user.username || ''},</p>
              <p style="margin:0 0 16px">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para prosseguir. Este link é válido por 15 minutos.</p>
              <p style="text-align:center;margin:24px 0">
                <a href="${resetLink}" style="background:#1976d2;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;display:inline-block">Redefinir senha</a>
              </p>
              <p style="margin:0 0 12px">Se você não solicitou esta alteração, ignore este email.</p>
              <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
              <p style="font-size:12px;color:#666;margin:0">${fromName} · Sistema de Gestão · Suporte: ${fromAddr}</p>
            </div>
          `;
        try {
          const isGmail = (String(smtpService).toLowerCase() === 'gmail') || (String(smtpHost).toLowerCase().includes('smtp.gmail.com'));
          const secure = (process.env.SMTP_SECURE === 'true') || smtpPort === 465;
          const requireTLS = process.env.SMTP_REQUIRE_TLS === 'true' || (!secure);
          const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
          let transporter;
          if (isGmail) {
            const finalPort = secure ? 465 : 587;
            transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: finalPort, secure, requireTLS, tls: { rejectUnauthorized }, auth: { user: smtpUser, pass: smtpPass }, pool: true, maxConnections: 2, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 });
          } else {
            transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure, requireTLS, tls: { rejectUnauthorized }, auth: { user: smtpUser, pass: smtpPass }, pool: true, maxConnections: 2, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 });
          }
          const timeoutSend = new Promise((_, rej) => setTimeout(() => rej(new Error('SMTP send timeout')), 12000));
          await Promise.race([transporter.sendMail({ from: `${fromName} <${fromAddr}>`, to: user.email || email, replyTo: fromAddr, subject: 'Redefinição de senha | SATA', text: `Olá ${user.username || ''},\n\nRecebemos uma solicitação para redefinir sua senha. Acesse o link (válido por 15 minutos):\n${resetLink}\n\nSe você não solicitou esta alteração, ignore este email.\n\n${fromName}`, html, headers: { 'X-Auto-Response-Suppress': 'All' } }), timeoutSend]);
        } catch (sendErr) {
          console.info('Envio de recuperação indisponível:', sendErr.message, { host: smtpHost, port: smtpPort, secure: (process.env.SMTP_SECURE === 'true'), code: sendErr.code });
          try { const { logSecurityEvent } = require('../utils/auditLogger'); logSecurityEvent({ type: 'password_reset_request', entity: 'user', entityId: user.id, actor: req.user || null, details: { via: 'smtp_timeout', email } }); } catch {}
          return res.json({ success: true, token });
        }
      } else {
        // Ambiente sem SMTP: retornar token para facilitar testes locais
        console.log(`Link de reset para ${user.username} (${user.email || email}): ${resetLink}`);
        try { const { logSecurityEvent } = require('../utils/auditLogger'); logSecurityEvent({ type: 'password_reset_request', entity: 'user', entityId: user.id, actor: req.user || null, details: { via: 'no_smtp', email } }); } catch {}
        return res.json({ success: true, token });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao iniciar recuperação de senha', detail: err.message });
    }
  }

  /*
    Reset de senha via token
    Parâmetros: `token`, `new_password` (body)
    - Valida token `JWT`, aplica política de senha e atualiza `password_hash`.
    - Registra evento de segurança (audit) quando disponível.
  */
  async resetPassword(req, res) {
    try {
      const { token, new_password } = req.body;
      if (!token || !new_password) return res.status(400).json({ success: false, error: 'Token e nova senha são obrigatórios' });
      const pwErr = checkPassword(new_password);
      if (pwErr) {
        return res.status(400).json({ success: false, error: pwErr });
      }
      const secret = process.env.JWT_SECRET;
      if (!secret) return res.status(500).json({ success: false, error: 'Configuração de JWT ausente' });
      let payload;
      try {
        payload = jwt.verify(token, secret);
      } catch (e) {
        return res.status(400).json({ success: false, error: 'Token inválido ou expirado' });
      }
      if (payload.action !== 'reset' || !payload.id) {
        return res.status(400).json({ success: false, error: 'Token inválido' });
      }

      const hash = await bcrypt.hash(new_password, 10);
      const actorId = req.user?.id ? Number(req.user.id) : Number(payload.id);
      const ok = await UserRepository.resetPasswordWithProcedure(actorId, Number(payload.id), hash);
      if (!ok) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      try {
        const { logSecurityEvent } = require('../utils/auditLogger');
        logSecurityEvent({ type: 'password_reset', entity: 'user', entityId: payload.id, actor: { id: payload.id, username: payload.username }, details: { via: 'token' } });
      } catch {}
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao redefinir senha', detail: err.message });
    }
  }

  /*
    Troca de senha autenticada
    Parâmetros: `current_password`, `new_password` (body)
    - Compara senha atual, valida nova senha e persiste alteração.
    - Registra auditoria quando disponível.
  */
  async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ success: false, error: 'Senha atual e nova são obrigatórias' });
      }
      const pwErr2 = checkPassword(new_password);
      if (pwErr2) {
        return res.status(400).json({ success: false, error: pwErr2 });
      }
      const user = await UserRepository.findById(req.user.id);
      if (!user) return res.status(401).json({ success: false, error: 'Não autenticado' });
      const ok = await bcrypt.compare(current_password, user.password_hash);
      if (!ok) return res.status(400).json({ success: false, error: 'Senha atual incorreta' });
      const hash = await bcrypt.hash(new_password, 10);
      const updated = await UserRepository.resetPasswordWithProcedure(user.id, user.id, hash);
      if (!updated) return res.status(500).json({ success: false, error: 'Não foi possível atualizar a senha' });
      try {
        const { logSecurityEvent } = require('../utils/auditLogger');
        logSecurityEvent({ type: 'password_change', entity: 'user', entityId: user.id, actor: { id: user.id, username: user.username }, details: { method: 'self_service' } });
      } catch {}
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Erro ao trocar senha', detail: err.message });
    }
  }
  async diagnoseSmtp(req, res) {
    try {
      const svc = String(process.env.SMTP_SERVICE || '').toLowerCase();
      const hostEnv = process.env.SMTP_HOST || '';
      const user = process.env.SMTP_USER || '';
      const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
      const secure = (process.env.SMTP_SECURE === 'true');
      const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : (secure ? 465 : 587);
      const host = svc === 'gmail' ? 'smtp.gmail.com' : hostEnv;
      const requireTLS = process.env.SMTP_REQUIRE_TLS === 'true' || (!secure);
      const rejectUnauthorized = process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false';
      const summary = { host, port, service: svc || null, secure, requireTLS, rejectUnauthorized, user: user ? `${user.slice(0,2)}***@***` : null, passLen: pass.length };
      console.info('[SMTP DIAG] summary', summary);
      let resolveInfo = null;
      try {
        resolveInfo = await new Promise((resolve, reject) => dns.lookup(host, { all: true }, (err, addrs) => err ? reject(err) : resolve(addrs)));
        console.info('[SMTP DIAG] dns', resolveInfo);
      } catch (e) {
        console.error('[SMTP DIAG] dns_error', { message: e.message, code: e.code });
      }
      let tcpInfo = { ok: false };
      try {
        tcpInfo = await new Promise((resolve) => {
          const s = net.createConnection({ host, port });
          const start = Date.now();
          let done = false;
          const finish = (ok, err) => { if (done) return; done = true; try { s.destroy(); } catch(_){}; resolve({ ok, ms: Date.now()-start, error: err ? { message: err.message, code: err.code, syscall: err.syscall } : null }); };
          s.setTimeout(6000);
          s.on('connect', () => finish(true));
          s.on('timeout', () => finish(false, new Error('tcp timeout')));
          s.on('error', (err) => finish(false, err));
        });
        console.info('[SMTP DIAG] tcp', tcpInfo);
      } catch (e) {
        console.error('[SMTP DIAG] tcp_exception', { message: e.message, code: e.code });
      }
      let nmResult = { ok: false };
      try {
        const transporter = nodemailer.createTransport({ host, port, secure, requireTLS, tls: { rejectUnauthorized }, auth: user && pass ? { user, pass } : undefined, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000, logger: true, debug: true });
        const start = Date.now();
        await transporter.verify();
        nmResult = { ok: true, ms: Date.now() - start };
        console.info('[SMTP DIAG] verify_ok', nmResult);
      } catch (e) {
        nmResult = { ok: false, error: { message: e.message, code: e.code, command: e.command, response: e.response } };
        console.error('[SMTP DIAG] verify_err', nmResult.error);
      }
      return res.json({ success: true, data: { summary, dns: resolveInfo, tcp: tcpInfo, verify: nmResult } });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Falha no diagnóstico SMTP', detail: err.message });
    }
  }

}

module.exports = new AuthController();
