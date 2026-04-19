import path from 'node:path';
import { importVoicingsFromCsv, closeImporterPrisma } from '../../../scripts/import-voicings-from-csv';

async function main() {
  const csvPath = path.resolve(__dirname, '../../../docs/data/voicings-seed.csv');
  const stats = await importVoicingsFromCsv(csvPath);
  console.log(`Seeded ${stats.voicingsUpserted} voicings from ${csvPath}`);
}

main()
  .then(async () => {
    await closeImporterPrisma();
  })
  .catch(async (e) => {
    console.error(e);
    await closeImporterPrisma();
    process.exit(1);
  });
