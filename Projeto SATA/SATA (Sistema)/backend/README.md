# Política de Reset de Senha

## Restrições de Segurança
- Administradores não podem redefinir senha de outros administradores.
- Administradores podem redefinir senha de funcionários não‑administrativos.
- Reset de senha do próprio usuário permanece permitido.

## Implementação
- Banco de dados:
  - Tabela `audit_password_resets` registra todas as tentativas (permitidas e bloqueadas).
  - Procedure `sp_reset_password(actor_id, target_id, new_hash)` aplica a regra e audita.
- Aplicação:
  - `POST /api/auth/forgot-password` bloqueia quando um admin tenta iniciar reset de outro admin.
  - `POST /api/auth/reset-password` e `POST /api/auth/change-password` utilizam `sp_reset_password`.

## Auditoria
- Campos: `actor_id`, `target_id`, `allowed`, `reason`, `created_at`.
- Motivos de bloqueio: `blocked: admin->admin` (procedure) e `blocked: admin->admin forgot` (aplicação).

## Compatibilidade
- Fluxos existentes continuam funcionando para funcionários e resets próprios.
- Sem impacto em login, criação de usuário, e demais operações.

## Testes
- `npm test` executa casos cobrindo:
  - Bloqueio admin→admin.
  - Permissão admin→funcionário.
  - Permissão admin→self.

