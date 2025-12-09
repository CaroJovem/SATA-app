// Serviço de produtos: CRUD, movimentação e histórico
import api from './api';

// Lista produtos com filtros
export async function listarProdutos(params = {}) {
  const { data } = await api.get('/produtos', { params });
  return data;
}

// Busca produto por ID
export async function obterProduto(id) {
  const { data } = await api.get(`/produtos/${id}`);
  return data;
}

// Cria novo produto
export async function criarProduto(payload) {
  const { data } = await api.post('/produtos', payload);
  return data;
}

// Atualiza produto
export async function atualizarProduto(id, payload) {
  const { data } = await api.put(`/produtos/${id}`, payload);
  return data;
}

// Remove produto
export async function deletarProduto(id) {
  const { data } = await api.delete(`/produtos/${id}`);
  return data;
}

// Movimenta estoque do produto
export async function movimentarProduto(id, payload) {
  // payload: { tipo: 'entrada'|'saida', quantidade: number, observacao?: string }
  try {
    const { data } = await api.post(`/produtos/${id}/movimentar`, payload, { timeout: 5000 });
    return data;
  } catch (err) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    if (code === 'ECONNABORTED' || /timeout/i.test(msg)) {
      throw new Error('Tempo excedido ao movimentar estoque (5s). Tente novamente.');
    }
    throw err;
  }
}

// Lista histórico de movimentos do produto
export async function listarMovimentos(id, params = {}) {
  const { data } = await api.get(`/produtos/${id}/historico`, { params });
  return data;
}
