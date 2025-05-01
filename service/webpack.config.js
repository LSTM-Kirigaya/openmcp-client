const path = require('path');

module.exports = {
	entry: './src/index.ts',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'bundle.js',
		libraryTarget: 'commonjs2' // 使用 commonjs2 模块系统
	},
	resolve: {
		extensions: ['.ts', '.js'],
		fallback: {
			bufferutil: false,
			'utf-8-validate': false
		}
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: 'ts-loader'
			}
		]
	},
	target: 'node', // 指定目标环境为 Node.js
	mode: 'production',
	optimization: {
		minimize: true
	}
};