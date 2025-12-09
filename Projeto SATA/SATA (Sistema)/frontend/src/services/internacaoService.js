// Serviço de institucionalizações: abrir, encerrar e listar
import api from './api';

const internacaoService = {
  // Lista todas as institucionalizações
  async listarTodas() {
    try {
      const response = await api.get('/internacoes');
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao listar institucionalizações:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar institucionalizações');
    }
  },

  // Busca institucionalização por ID
  async buscarPorId(id) {
    try {
      const response = await api.get(`/internacoes/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Erro ao buscar institucionalização:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar institucionalização');
    }
  },

  // Cria nova institucionalização
  async criar(dadosInternacao) {
    try {
      const response = await api.post('/internacoes', dadosInternacao);
      return response.data.data;
    } catch (error) {
      console.error('Erro ao criar institucionalização:', error);
      throw new Error(error.response?.data?.message || 'Erro ao criar institucionalização');
    }
  },

  // Dá baixa na institucionalização
  async darBaixa(id, motivoSaida) {
    try {
      const response = await api.put(`/internacoes/${id}/baixa`, {
        motivo_saida: motivoSaida
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao dar baixa na institucionalização:', error);
      throw new Error(error.response?.data?.message || 'Erro ao dar baixa na institucionalização');
    }
  },

  // Atalho: método antigo chama o novo
  async finalizar(id, motivoSaida) {
    return this.darBaixa(id, motivoSaida);
  },

  // Lista institucionalizações ativas
  async listarAtivas() {
    try {
      const response = await api.get('/internacoes/ativas');
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar institucionalizações ativas:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar institucionalizações ativas');
    }
  },

  // Lista quartos disponíveis
  async buscarQuartosDisponiveis() {
    try {
      const response = await api.get('/quartos/disponiveis');
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar quartos disponíveis:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar quartos disponíveis');
    }
  },

  // Lista camas disponíveis de um quarto
  async buscarCamasDisponiveis(quartoId) {
    try {
      if (!quartoId) return [];
      const response = await api.get(`/internacoes/quartos/${quartoId}/camas`);
      return response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar camas disponíveis:', error);
      throw new Error(error.response?.data?.message || 'Erro ao buscar camas disponíveis');
    }
  }
};

export default internacaoService;
