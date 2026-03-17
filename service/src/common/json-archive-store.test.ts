/**
 * JsonArchiveStore 存储测试
 * 运行: npx tsx src/common/json-archive-store.test.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { JsonArchiveStore } from './json-archive-store.js';

const TEST_DIR = path.join(os.tmpdir(), `openmcp-json-archive-test-${Date.now()}`);

async function run() {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });

    const store = new JsonArchiveStore(TEST_DIR, 'test', { maxSize: '100k', maxFiles: 3 });

    for (let i = 0; i < 50; i++) {
        await store.write(`id-${i}`, { value: i, name: `record-${i}` });
    }

    const count = await store.count();
    console.log('count:', count);
    if (count !== 50) throw new Error(`Expected 50, got ${count}`);

    const r = await store.read('id-25');
    if (!r || (r.data as { value: number }).value !== 25) {
        throw new Error(`Expected id-25 with value 25, got ${JSON.stringify(r)}`);
    }

    const all = await store.readAll(10);
    if (all.length !== 10) throw new Error(`Expected 10 from readAll, got ${all.length}`);

    store.close();
    const files = fs.readdirSync(TEST_DIR);
    console.log('files created:', files);
    if (files.length === 0) throw new Error('Expected at least one file');
    console.log('json-archive-store test passed');
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
