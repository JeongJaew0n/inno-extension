import { mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
const releaseDirectory = resolve('release');
const archiveName = `inno-extension-${manifest.version}.zip`;
const archivePath = resolve(releaseDirectory, archiveName);

await mkdir(releaseDirectory, { recursive: true });
await rm(archivePath, { force: true });

const zipResult = spawnSync('zip', ['-qr', archivePath, '.'], {
  cwd: resolve('dist'),
  stdio: 'inherit',
});

if (zipResult.error) throw zipResult.error;
if (zipResult.status !== 0) {
  throw new Error(`ZIP 패키징 실패: 종료 코드 ${zipResult.status ?? 'unknown'}`);
}

const testResult = spawnSync('unzip', ['-t', archivePath], { stdio: 'inherit' });
if (testResult.error) throw testResult.error;
if (testResult.status !== 0) {
  throw new Error(`ZIP 무결성 검사 실패: 종료 코드 ${testResult.status ?? 'unknown'}`);
}

console.log(`패키지 완료: release/${archiveName}`);
