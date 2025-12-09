// Logger de auditoria: registra eventos no console

// Registra deleções (placeholder)
function logDeletion() {
  // Intencionalmente vazio para evitar escrita em disco.
}

// Registra eventos de segurança (placeholder)
function logSecurityEvent() {
  // Intencionalmente vazio para evitar escrita em disco.
}
// Registra um evento com payload
function log(event, payload) {
  try {
    const ts = new Date().toISOString();
    // Minimiza verbosidade; pode ser integrado a sistemas de observabilidade futuramente
    console.log(`[AUDIT ${ts}] ${event}:`, JSON.stringify(payload));
  } catch (_) {}
}

module.exports = { logDeletion, logSecurityEvent, log };
