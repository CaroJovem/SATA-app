// Serviço de notificações: chama a API para listar e atualizar notificações
import api from './api';

// Converte filtros de tela para parâmetros da API
function mapParams(params = {}) {
  const out = {};
  if (params.tipo) out.tipo = params.tipo;
  if (params.prioridade) out.prioridade = params.prioridade;
  if (params.busca) out.search = params.busca;
  if (params.lida !== undefined && params.lida !== '') {
    out.lida = String(params.lida) === 'true';
  }
  if (params.pagina) out.page = params.pagina;
  if (params.limite) out.pageSize = params.limite;
  if (params.ordenacao) out.sort = params.ordenacao;
  if (params.direcao) out.order = params.direcao;
  return out;
}

// Lista notificações com paginação e filtros
export async function listarNotificacoes(params = {}) {
  const qp = mapParams(params);
  const { data } = await api.get('/notificacoes', { params: qp });
  const items = data?.data ?? data?.notificacoes ?? [];
  const total = data?.pagination?.total ?? data?.total ?? items.length ?? 0;
  return { notificacoes: items, total };
}

// Busca uma notificação pelo ID
export async function obterNotificacao(id) {
  const { data } = await api.get(`/notificacoes/${id}`);
  return data?.data ?? data;
}

// Cria uma nova notificação
export async function criarNotificacao(payload) {
  const { data } = await api.post('/notificacoes', payload);
  return data?.data ?? data;
}

// Atualiza uma notificação existente
export async function atualizarNotificacao(id, payload) {
  const { data } = await api.put(`/notificacoes/${id}`, payload);
  return data?.data ?? data;
}

// Apaga uma notificação pelo ID
export async function deletarNotificacao(id) {
  const { data } = await api.delete(`/notificacoes/${id}`);
  return data?.success ? true : data;
}

// Apaga várias notificações de uma vez
export async function deletarVariasNotificacoes(ids) {
  const { data } = await api.delete('/notificacoes/bulk', { data: { ids } });
  return data?.success ? true : data;
}

// Marca uma notificação como lida
export async function marcarComoLida(id) {
  const { data } = await api.patch(`/notificacoes/${id}/marcar-lida`);
  return data?.success ? true : data;
}

// Marca várias notificações como lidas
export async function marcarVariasComoLidas(ids) {
  const { data } = await api.patch('/notificacoes/marcar-lidas', { ids });
  return data?.success ? true : data;
}

// Busca notificações recentes
export async function obterNotificacoesRecentes(limite = 10, usuario_id = null) {
  const params = { limite };
  if (usuario_id) params.usuario_id = usuario_id;
  const { data } = await api.get('/notificacoes/recentes', { params });
  return data?.data ?? data;
}

// Obtém contadores de notificações (total e não lidas)
export async function obterContadores(usuario_id = null) {
  const params = {};
  if (usuario_id) params.usuario_id = usuario_id;
  const { data } = await api.get('/notificacoes/contadores', { params });
  return data?.data ?? data;
}

// Cria notificação de cadastro de item/registro
export async function criarNotificacaoCadastro(tipo_cadastro, nome_item, usuario_id = null) {
  const { data } = await api.post('/notificacoes/cadastro', {
    tipo_cadastro,
    nome_item,
    usuario_id
  });
  return data;
}

// Cria notificação de estoque baixo para um produto
export async function criarNotificacaoEstoqueBaixo(produto, usuario_id = null) {
  const { data } = await api.post('/notificacoes/estoque-baixo', {
    produto,
    usuario_id
  });
  return data;
}
