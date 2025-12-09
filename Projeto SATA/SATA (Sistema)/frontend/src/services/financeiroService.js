// Serviço financeiro: listar, obter, criar, atualizar e remover
import api from './api';

const resource = '/financeiro';

export const financeiroService = {
  // Lista registros financeiros
  async list() {
    const { data } = await api.get(resource);
    return data?.data ?? [];
  },

  // Busca registro financeiro por ID
  async getById(id) {
    const { data } = await api.get(`${resource}/${id}`);
    return data?.data ?? null;
  },

  // Cria registro financeiro
  async create(payload) {
    const { data } = await api.post(resource, payload);
    return data?.data ?? null;
  },

  // Atualiza registro financeiro
  async update(id, payload) {
    const { data } = await api.put(`${resource}/${id}`, payload);
    return data?.data ?? null;
  },

  // Remove registro financeiro
  async remove(id) {
    const { data } = await api.delete(`${resource}/${id}`);
    return data?.success ?? false;
  },
};

export default financeiroService;
