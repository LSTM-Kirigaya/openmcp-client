import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default {
    input: 'src/index.ts',
    context: 'global',
    output: [
        {
            file: 'dist/index.js',
            format: 'esm',
            sourcemap: true,
            inlineDynamicImports: true
        },
        {
            file: 'dist/index.cjs',
            format: 'cjs',
            sourcemap: true,
            inlineDynamicImports: true
        },
    ],
    plugins: [
        json(),
        typescript({
            tsconfig: './tsconfig.json',
            declaration: true,
            declarationDir: './dist/types',
            include: [
                'src/**/*.ts',
                '../service/src/**/*.ts',
                '../service/task-loop.d.ts'
            ],
            composite: false
        }),
        resolve({
            extensions: ['.ts', '.js'],
            preferBuiltins: true
        }),
        commonjs({
            ignoreDynamicRequires: ['pkce-challenge']
        }),
    ],
    external: [
        'ws', 'pino', 'events', 'path', 'fs', 'os', 'util',
        /.*task-loop\.js$/
    ]
};
