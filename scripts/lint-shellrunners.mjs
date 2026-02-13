import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const forbiddenPages = [
  'pages/home.tsx',
  'pages/market.tsx',
  'pages/profile.tsx',
  'pages/aboutus.tsx',
  'pages/roadmap.tsx',
  'pages/signup.tsx',
];

for (const relPath of forbiddenPages) {
  if (existsSync(path.join(repoRoot, relPath))) {
    throw new Error(`[lint-shellrunners] Legacy core page still exists: ${relPath}`);
  }
}

const nextConfigPath = path.join(repoRoot, 'next.config.js');
const nextConfig = readFileSync(nextConfigPath, 'utf8');
if (nextConfig.includes('ignoreBuildErrors')) {
  throw new Error(
    '[lint-shellrunners] next.config.js still contains typescript.ignoreBuildErrors'
  );
}

console.log('[lint-shellrunners] OK');

