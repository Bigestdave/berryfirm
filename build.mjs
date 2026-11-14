#!/usr/bin/env node
// Builds public/index.html from src/. No dependencies.  Usage: node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
// Order matters: later files use what earlier ones define.
const parts = [
  '00-shell.html',        // styles and page markup
  '10-core.js',           // BERRY config, state S, router, helpers, toast, nav
  '20-markets.js',        // the 12 markets, flags and logos, candle chart
  '25-images.js',         // embedded renders (large)
  '30-start-home.js',     // choose a challenge, accept rules, trader home
  '40-trade.js',          // markets list, trade screen, order ticket
  '50-payouts.js',        // passed, failed, payouts flow, public pool
  '60-help-profile.js',   // help and profile
  '70-operator.js',       // operator: overview, ledger, queue, accounts, rules
  '80-api.js',            // API adapter: persistent server state and actions
  '90-boot.js',           // routes
];
const body = parts.map((f) => readFileSync(join(root, 'src', f), 'utf8')).join('') + '</script>\n';
const head =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' +
  '<script src="config.js"></script></head><body style="margin:0">\n';
mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public', 'index.html'), head + body + '</body></html>\n');
console.log('public/index.html written (' + Math.round((head.length + body.length) / 1024) + ' KB)');
