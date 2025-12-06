async function main() {
  const tests = [
    require('./security.reset.test'),
    require('./security.access.test'),
  ];
  for (const t of tests) {
    await t();
    console.log('[OK]', t.name || 'test');
  }
  console.log('Todos os testes concluídos com sucesso');
  process.exit(0);
}
main().catch(err => { console.error('Falha nos testes:', err); process.exit(1); });
