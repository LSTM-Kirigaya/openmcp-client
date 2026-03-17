import * as fs from 'fs';
import * as path from 'path';

const sourceDir = path.resolve(process.cwd(), '../openmcp-sdk');
const targetDir = path.resolve(process.cwd(), 'dist');

const files = ['task-loop.js', 'tools.mjs'];

files.forEach(file => {
    const source = path.join(sourceDir, file);
    const target = path.join(targetDir, file);
    
    if (fs.existsSync(source)) {
        fs.copyFileSync(source, target);
        console.log(`Copied ${file} to dist/`);
    } else {
        console.warn(`Warning: ${file} not found in ${sourceDir}`);
    }
});
