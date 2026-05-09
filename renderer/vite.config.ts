import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
	plugins: [
		vue(),
		vueDevTools(),
		{
			name: 'openmcp-web-health',
			configureServer(server) {
				server.middlewares.use('/__openmcp_web_health', (_req, res) => {
					res.statusCode = 200;
					res.setHeader('Content-Type', 'application/json; charset=utf-8');
					res.end(JSON.stringify({ app: 'openmcp-web-ui', mode: 'vite' }));
				});
			}
		}
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
	base: mode === 'website' ? '/mcp/' : '/',
	server: {
		// openmcp 会用 PORT 环境变量指定 Web UI 端口
		port: process.env.PORT ? Number(process.env.PORT) : undefined,
	},
	build: {
		cssCodeSplit: false, // 禁用 CSS 代码分割
		rollupOptions: {
			output: {
				inlineDynamicImports: true, // 将动态导入的内容内联
				manualChunks: undefined, // 禁用手动分块
			},
		},
	},
}))
