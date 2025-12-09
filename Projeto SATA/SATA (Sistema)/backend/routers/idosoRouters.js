// Rotas de idosos: cadastro, listagem e observações
const express = require('express');
const idosoController = require('../controllers/idosoController');
const observacaoRouters = require('./observacaoRouters');

const router = express.Router();

// Rotas de observações aninhadas
router.use('/:idosoId/observacoes', observacaoRouters);

//Rotas CRUD
router.get('/', idosoController.getAll)
router.get('/:id', idosoController.getById)
router.get('/:id/ficha', idosoController.getFichaCompleta)
router.post('/', idosoController.create)
router.put('/:id', idosoController.update)
router.put('/:id/status', idosoController.updateStatus) // Nova rota para status
router.delete('/:id', idosoController.delete)

module.exports = router
