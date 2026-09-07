import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'dist');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const handlers = {
  businessSetup: path.join(__dirname, 'functions', 'businessSetup.ts'),
  products: path.join(__dirname, 'functions', 'products.ts'),
  orders: path.join(__dirname, 'functions', 'orders.ts'),
  transactions: path.join(__dirname, 'functions', 'transactions.ts'),
  invoices: path.join(__dirname, 'functions', 'invoices.ts'),
  invoicesProcesser: path.join(__dirname, 'functions', 'invoicesProcesser.ts'),
  sales: path.join(__dirname, 'functions', 'sales.ts'),
};

for (const [name, entryPoint] of Object.entries(handlers)) {
  const outputDir = path.join(outDir, name);
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    outfile: path.join(outputDir, 'index.js'),
    external: ['@aws-sdk/*', 'aws-sdk'],
    minify: true,
    sourcemap: true,
    logLevel: 'info',
  });
}
