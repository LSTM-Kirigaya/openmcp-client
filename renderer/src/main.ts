import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import i18n from './i18n';
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

createApp(App)
    .use(i18n)
    .use(router)
    .use(ElementPlus)
    .mount('#app')