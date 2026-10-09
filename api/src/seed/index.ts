import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { DEMO_PASSWORD } from './data.js';
import { runSeed } from './run.js';

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data with NODE_ENV=production');
  }

  await connectDatabase();
  const summary = await runSeed();
  await disconnectDatabase();

  console.log(`Seed concluído (senha de todos os usuários: ${DEMO_PASSWORD})\n`);
  for (const s of summary) {
    console.log(`${s.company} — ${s.products} produtos — convite: ${s.inviteCode}`);
    for (const a of s.accounts) console.log(`  ${a}`);
  }
}

main().catch((err) => {
  console.error('Falha no seed:', err);
  process.exit(1);
});
