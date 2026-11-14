import { config } from '../server/config.mjs';
import { BerryStore } from '../server/store.mjs';

if (!['mock', 'testnet'].includes(config.rail) || config.authMode !== 'demo') throw new Error('Demo seed requires RAIL=mock or RAIL=testnet with AUTH_MODE=demo.');
const store = new BerryStore({ dbPath: config.dbPath, config });
const challenge = store.seedDemo(config.demoWallet);
console.log(`Seeded ${challenge.id} for ${config.demoWallet}. Open the app and request its calibrated $0.80 testnet settlement.`);
store.close();
