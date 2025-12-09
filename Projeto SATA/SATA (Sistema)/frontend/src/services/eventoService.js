// Serviço auxiliar de eventos: reutiliza eventosService
import eventosService from './eventosService';

export default {
  // Lista todos os eventos
  async getAll() {
    try {
      const lista = await eventosService.getAll();
      return Array.isArray(lista) ? lista : [];
    } catch (err) {
      console.error('Erro ao obter eventos do backend:', err?.message || err);
      return [];
    }
  },
  // Cria evento e retorna lista atualizada
  async create(payload) {
    try {
      await eventosService.create(payload);
      return await this.getAll();
    } catch (err) {
      console.error('Erro ao criar evento (frontend):', err?.response?.data?.message || err?.message || err);
      throw err;
    }
  },
  // Atualiza evento e retorna lista atualizada
  async update(id, payload) {
    try {
      await eventosService.update(id, payload);
      return await this.getAll();
    } catch (err) {
      console.error('Erro ao atualizar evento (frontend):', err?.response?.data?.message || err?.message || err);
      throw err;
    }
  },
  // Remove evento e retorna lista atualizada
  async remove(id) {
    try {
      await eventosService.remove(id);
      return await this.getAll();
    } catch (err) {
      console.error('Erro ao remover evento (frontend):', err?.response?.data?.message || err?.message || err);
      throw err;
    }
  }
  ,
  // Busca evento por ID
  async getById(id) {
    try {
      const ev = await eventosService.getById(id);
      return ev || null;
    } catch (err) {
      console.error('Erro ao obter evento por ID (frontend):', err?.response?.data?.message || err?.message || err);
      throw err;
    }
  }
};
