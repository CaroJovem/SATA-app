// Serviço de estoque de doações: similares e processamento
import api from './api';

const donationStockService = {
  // Busca produtos similares por nome/categoria
  async buscarSimilares(nome = '', categoria = '') {
    try {
      const { data } = await api.post('/estoque/doacoes/similares', { nome, categoria }, { timeout: 1200 });
      if (data?.success) return Array.isArray(data?.data) ? data.data : [];
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Erro ao buscar produtos similares:', err?.response?.data?.message || err?.message || err);
      return [];
    }
  },

  // Processa entrada de item doado no estoque
  async processarItem(payload) {
    try {
      const { data } = await api.post('/estoque/doacoes/processar-item', payload);
      return data;
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || err;
      console.error('Erro ao processar doação de item:', msg);
      throw err;
    }
  }
};

export default donationStockService;
