#!/usr/bin/env node
/*
  Puts crypto logos into public/logos/ so the app shows the real ones next to BTC, ETH, SOL and XRP.

    node scripts/fetch-logos.mjs                 # btc eth sol xrp, downloaded from the public icon pack
    node scripts/fetch-logos.mjs btc eth near    # pick your own symbols
    node scripts/fetch-logos.mjs --from ./svgs   # copy your own files instead: ./svgs/btc.svg, ./svgs/eth.svg ...

  Files are saved as lower-case SVG (btc.svg). The app looks for logos/<symbol>.svg, so a missing file is
  harmless: that market keeps its letter disc. Forex flags are drawn in the app and need no files.

  Needs Node 18 or newer. No packages to install.

  Where the files come from (tried in this order, first hit wins):
    1. node_modules/cryptocurrency-icons, if you ran `npm i cryptocurrency-icons`
    2. cdn.jsdelivr.net, unpkg.com, raw.githubusercontent.com  (spothq/cryptocurrency-icons, CC0 licence)
  Override the download list with LOGO_SOURCES="https://host/path/{sym}.svg,https://other/{sym}.svg".
  The pack is a CC0 licence on the artwork; the marks still belong to each project, so use them to name the asset only.
*/
import { mkdir, writeFile, readFile, copyFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.LOGO_DIR ? resolve(process.env.LOGO_DIR) : join(root, 'public', 'logos');
const PACK = 'cryptocurrency-icons';
const VERSION = '0.18.1';
const SOURCES = (process.env.LOGO_SOURCES
  ? process.env.LOGO_SOURCES.split(',').map((s) => s.trim()).filter(Boolean)
  : [
      `https://cdn.jsdelivr.net/npm/${PACK}@${VERSION}/svg/color/{sym}.svg`,
      `https://unpkg.com/${PACK}@${VERSION}/svg/color/{sym}.svg`,
      `https://raw.githubusercontent.com/spothq/${PACK}/master/svg/color/{sym}.svg`,
    ]);

const args = process.argv.slice(2);
const fromAt = args.indexOf('--from');
const fromDir = fromAt >= 0 ? resolve(args[fromAt + 1] || '') : null;
if (fromAt >= 0) args.splice(fromAt, 2);
const syms = (args.length ? args : ['btc', 'eth', 'sol', 'xrp']).map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''));

const looksLikeSvg = (txt) => /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?<svg[\s>]/i.test(txt) && /<\/svg>\s*$/i.test(txt) && txt.length < 200_000;
const exists = async (p) => stat(p).then(() => true, () => false);

async function fromLocal(sym) {
  const candidates = [
    fromDir && join(fromDir, `${sym}.svg`),
    join(root, 'node_modules', PACK, 'svg', 'color', `${sym}.svg`),
  ].filter(Boolean);
  for (const p of candidates) {
    if (await exists(p)) {
      const txt = await readFile(p, 'utf8');
      if (looksLikeSvg(txt)) return { txt, from: p };
    }
  }
  return null;
}

async function fromWeb(sym) {
  for (const tpl of SOURCES) {
    const url = tpl.replaceAll('{sym}', sym);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const txt = await res.text();
      if (looksLikeSvg(txt)) return { txt, from: url };
    } catch {
      /* try the next source */
    }
  }
  return null;
}

await mkdir(outDir, { recursive: true });
const rows = [];
for (const sym of syms) {
  const hit = (await fromLocal(sym)) || (fromDir ? null : await fromWeb(sym));
  if (hit) {
    await writeFile(join(outDir, `${sym}.svg`), hit.txt);
    rows.push([sym, 'saved', hit.from]);
  } else {
    rows.push([sym, 'not found', fromDir ? `no ${sym}.svg in ${fromDir}` : 'no source had it (the app keeps the letter disc)']);
  }
}
const w = Math.max(...rows.map((r) => r[0].length));
for (const [s, st, f] of rows) console.log(`${s.padEnd(w)}  ${st.padEnd(9)}  ${f}`);

const saved = rows.filter((r) => r[1] === 'saved').length;
if (saved) {
  await writeFile(
    join(outDir, 'SOURCE.txt'),
    `Logos in this folder were fetched by scripts/fetch-logos.mjs from the ${PACK} pack (CC0) or from files you supplied.\n` +
      `The marks belong to their projects. Use them to name the asset, not to imply endorsement.\n`,
  );
  console.log(`\n${saved} of ${rows.length} saved to ${outDir}`);
  console.log(`Make sure public/config.js has  logos: 'logos/'  and reload the page.`);
}
if (!saved) {
  console.error('\nNothing saved. Check your network, or run with --from <folder of svgs>.');
  process.exit(1);
}
