const assert = require('assert');
const Doacao = require('../models/doacao');

module.exports = async function donationsToJson() {
  const d = new Doacao({
    id: 1,
    data: new Date().toISOString().slice(0,19).replace('T',' '),
    tipo: 'itens',
    obs: '',
    actor: { id: 1, nome: 'Tester' },
    idosoId: 10,
    idoso: { id: 10, nome: 'Fulano' },
    doador: { id: 5, nome: 'Do Teste', toJSON() { return { id: 5, nome: 'Do Teste' }; } },
    eventoId: null,
    eventoTitulo: null,
    doacao: { toJSON() { return { item: 'Sabonete', qntd: 2, unidade_medida: 'Unidade(s)' }; } }
  });
  const json = d.toJSON();
  assert.strictEqual(json.idoso, 'Fulano');
}

