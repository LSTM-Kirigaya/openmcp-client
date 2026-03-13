import { readFileSync } from 'fs';
import { join } from 'path';

export let version: string;

try {
  // 在编译后的代码中，__dirname 是 dist/utils/
  // 所以需要向上两级才能到达 cli 目录
  const packageJsonPath = join(__dirname, '..', '..', 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  version = packageJson.version;
} catch {
  version = '0.1.0';
}
