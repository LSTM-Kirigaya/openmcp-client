const AutoImport = require('unplugin-auto-import/webpack')
const Components = require('unplugin-vue-components/webpack')
const { ElementPlusResolver } = require('unplugin-vue-components/resolvers')

module.exports = {
    plugins: [
        AutoImport({
            resolvers: [ElementPlusResolver()],
        }),
        Components({
            resolvers: [ElementPlusResolver()],
        }),
        new webpack.DefinePlugin({
            __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        })
    ],
    resolve: {
        fallback: {
            "stream": false
        }
    },
};