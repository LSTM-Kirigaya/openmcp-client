import { reactive } from 'vue';

export const languageSetting = reactive({
    options: [
        {
            value: 'en',
            text: 'English'
        },
        {
            value: 'zh',
            text: '简体中文'
        },
        {
            value: 'zhTw',
            text: '繁體中文'
        },
        {
            value: 'ja',
            text: '日本語'
        },
        {
            value: 'ko',
            text: '한국어'
        },
        {   
            value: 'de',
            text: 'Deutsch'
        },
        {
            value: 'fr',
            text: 'Français'
        },
        {
            value: 'ru',
            text: 'Русский'
        },
        {
            value: 'ar',
            text: 'العربية'
        }
    ]
});
