import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { build } from 'vite';

const outputDirectory = resolve('.test-dist');
const outputFile = resolve(outputDirectory, 'unit.test.mjs');

try {
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      emptyOutDir: true,
      outDir: outputDirectory,
      ssr: resolve('tests/unit.test.ts'),
      rollupOptions: {
        output: {
          entryFileNames: 'unit.test.mjs',
        },
      },
    },
  });

  const result = spawnSync(process.execPath, ['--test', outputFile], {
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(outputDirectory, { recursive: true, force: true });
}
