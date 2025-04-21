const { defineConfig } = require("@vue/cli-service");

module.exports = defineConfig({
    transpileDependencies: true,
    publicPath: process.env.NODE_ENV === 'production' ? '' : '/',
    configureWebpack: {
        optimization: {
            splitChunks: false
        }
    },
    chainWebpack: config => {
        // 删除所有预设的代码分割规则
        config.optimization.delete('splitChunks');

        // 确保路由组件同步加载
        config.plugins.delete('prefetch');
        config.plugins.delete('preload');

        // 删除 public 下指定的 css 文件
        config.plugin('copy').tap(args => {
            args[0].patterns = args[0].patterns.map((pattern) => {
                if (pattern.from === "public") {
                    // 忽略指定的 CSS 文件
                    pattern.globOptions = {
                        ignore: [
                            "vscode.css",
                            "default-light.css",
                            "default-dark.css",
                        ],
                    };
                }
                return pattern;
            });
            return args;
        });
    },
    css: {
        extract: false
    },
    devServer: {
        port: 8081
    }
});
