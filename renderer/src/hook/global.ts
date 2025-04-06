import { reactive } from 'vue';
import * as Color from './color';

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
    const rootStyles = getComputedStyle(document.documentElement);
    const backgroundColorString = rootStyles.getPropertyValue('--background');
    const backgroundColor = Color.parseColor(backgroundColorString);
    if (backgroundColor) {
        const isLight = Color.isLightColorTheme(backgroundColor.r, backgroundColor.g, backgroundColor.b);
        themeColor = isLight ? 'light' : 'dark';
        return themeColor;
    }

    return 'dark';
}