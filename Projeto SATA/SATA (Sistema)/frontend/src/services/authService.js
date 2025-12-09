// Serviço de autenticação e gestão de usuários
import api from './api';
// Cabeçalho CSRF para operações seguras
const csrfHeader = () => {
  const t = typeof localStorage !== 'undefined' ? localStorage.getItem('csrfToken') : null;
  return t ? { 'x-csrf-token': t } : {};
};

const authService = {
  // Faz login
  async login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    if (data?.csrf && typeof localStorage !== 'undefined') {
      try { localStorage.setItem('csrfToken', data.csrf); } catch (e) { void e; }
    }
    return data;
  },

  // Busca usuário atual
  async me() {
    const { data } = await api.get('/auth/me');
    return data; // { success, user }
  },

  // Faz logout
  async logout() {
    const { data } = await api.post('/auth/logout', {}, { headers: csrfHeader() });
    return data;
  },

  // Solicita recuperação de senha
  async forgotPassword(email) {
    const { data } = await api.post('/auth/forgot-password', { email }, { headers: csrfHeader() });
    return data;
  },

  // Redefine a senha com token
  async resetPassword(token, new_password) {
    const { data } = await api.post('/auth/reset-password', { token, new_password }, { headers: csrfHeader() });
    return data;
  },

  // Troca a senha logado
  async changePassword(current_password, new_password) {
    const { data } = await api.post('/auth/change-password', { current_password, new_password }, { headers: csrfHeader() });
    return data;
  },

  // Registra novo usuário
  async register({ username, email, password, role }) {
    const { data } = await api.post('/auth/register', { username, email, password, role }, { headers: csrfHeader() });
    return data;
  },

  // Verifica unicidade de username/email
  async checkUnique({ username, email }) {
    const params = {};
    if (username) params.username = username;
    if (email) params.email = email;
    const { data } = await api.get('/auth/check-unique', { params });
    return data;
  },

  // Lista usuários (admin)
  async listUsers(params = {}) {
    const { data } = await api.get('/users', { params });
    return data;
  },

  // Busca permissões do usuário
  async getPermissions() {
    const { data } = await api.get('/users/me/permissions');
    return data;
  },

  // Cria usuário (admin)
  async adminCreateUser(payload) {
    const { data } = await api.post('/users', payload, { headers: csrfHeader() });
    return data;
  },

  // Atualiza usuário (admin)
  async adminUpdateUser(id, payload) {
    const { data } = await api.put(`/users/${id}`, payload, { headers: csrfHeader() });
    return data;
  },

  // Remove usuário (admin)
  async adminDeleteUser(id) {
    const { data } = await api.delete(`/users/${id}`, { headers: csrfHeader() });
    return data;
  },

  // Removido: endpoint de atualização de status de usuários

  // Reenvia validação de email (admin)
  async resendEmailValidation(id) {
    const { data } = await api.post(`/users/${id}/resend-validation`, {}, { headers: csrfHeader() });
    return data;
  },
};

export default authService;
