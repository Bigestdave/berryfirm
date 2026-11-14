import { config } from '../server/config.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validatePreparationConfig(appConfig) {
  if (appConfig.rail !== 'testnet' || !appConfig.outlayerWalletKey || !appConfig.treasuryAccount) {
    throw new Error('Run `npm run wallet:testnet -- berryfirm.testnet` first.');
  }
}

export async function prepareOutlayerTestnet({ appConfig = config, fetchImpl = fetch } = {}) {
  validatePreparationConfig(appConfig);
  const response = await fetchImpl(`${appConfig.outlayerApi.replace(/\/$/, '')}/wallet/v1/storage-deposit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${appConfig.outlayerWalletKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ token: appConfig.usdcContract })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.status === 'pending_approval' || (result.status && result.status !== 'success')) {
    throw new Error(`Could not register treasury USDC storage: ${result.message || result.error || result.status || response.status}`);
  }
  return { treasury: appConfig.treasuryAccount, token: appConfig.usdcContract, alreadyRegistered: Boolean(result.already_registered) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const prepared = await prepareOutlayerTestnet();
  console.log(`Test USDC storage is ready for treasury ${prepared.treasury}.`);
  console.log('Fund that treasury with test USDC, then run the seeded payout journey in the app.');
}
