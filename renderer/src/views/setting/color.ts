import { reactive } from 'vue';

import i18n from '@/i18n';
import { parseColor } from '@/hook/color';
import { globalSetting } from '@/hook/global';

const { t, locale } = i18n.global;
locale.value = globalSetting.language;

export const colorManager = reactive({
    mainColor: 'white',

    initColor() {
        const rootStyles = getComputedStyle(document.documentElement);            
        this.mainColor = rootStyles.getPropertyValue('--main-color');
    }
});

/**
 * @description 通用颜色设置发生变时
 * @param {string} colorString 用户选择的颜色的字符串 
 */
export function onGeneralColorChange(colorString: string) {
    const color = parseColor(colorString);
    if (!color) {
        return;
    }
    const { r, g, b } = color;
    
    document.documentElement.style.setProperty(
        '--main-color', `rgb(${r}, ${g}, ${b})`);

    document.documentElement.style.setProperty(
        '--main-light-color', `rgba(${r}, ${g}, ${b}, 0.7)`);
}

export const predefinedColors = [
    '#ff4500',
    '#ff8c00',
    '#ffd700',
    '#90ee90',
    '#00ced1',
    '#1e90ff',
    '#c71585'
];