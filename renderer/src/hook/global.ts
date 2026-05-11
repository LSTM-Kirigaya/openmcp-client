import { reactive } from 'vue';
import { getEffectiveTheme } from './theme';

type SupportLanguage = 'zh' | 'en' | 'zhTw' | 'ja' | 'de' | 'ko' | 'ru' | 'fr' | 'ar';

interface IGlobalSetting {
    language: SupportLanguage
}

export const globalSetting = reactive<IGlobalSetting>({
    language: 'zh'
});

let themeColor: 'light' | 'dark' | undefined = undefined;

export function getThemeColor(): 'light' | 'dark' {
    if (themeColor) {
        return themeColor;
    }
    themeColor = getEffectiveTheme();
    return themeColor;
}