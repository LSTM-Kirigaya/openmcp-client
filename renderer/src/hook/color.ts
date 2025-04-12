import { pinkLog } from "@/views/setting/util";

interface RgbColor {
    r: number;
    g: number;
    b: number;
    a?: number; // 透明度，值介于 0 - 1 之间
}

/**
 * @description 解析 rgb 字符串
 * @param colorString 形如 #1e90ff 或者 rgba(0, 206, 209, 1) 这样的字符串
 * @returns 解析后的 RgbColor 对象，如果解析失败则返回 undefined
 */
export function parseColor(colorString: string): RgbColor | undefined {
    // 检查是否是十六进制颜色
    if (colorString.startsWith('#')) {
        let hex = colorString.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return { r, g, b };
    }
    // 检查是否是 RGBA 颜色
    else if (colorString.startsWith('rgba')) {
        const matches = colorString.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*(\d+(\.\d+)?)\)/);
        if (matches) {
            const r = parseInt(matches[1], 10);
            const g = parseInt(matches[2], 10);
            const b = parseInt(matches[3], 10);
            const a = parseFloat(matches[4]);
            return { r, g, b, a };
        }
    }
    // 检查是否是 RGB 颜色
    else if (colorString.startsWith('rgb')) {
        const matches = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (matches) {
            const r = parseInt(matches[1], 10);
            const g = parseInt(matches[2], 10);
            const b = parseInt(matches[3], 10);
            return { r, g, b };
        }
    }

    return undefined;
}

/**
 * @description 提升颜色的亮度
 * @param rgb 原始颜色对象
 * @param percent 0 - 100 的数字，代表增强的亮度比例
 * @returns 提升亮度后的 RgbColor 对象
 */
export function increaseBrightness(rgb: RgbColor, percent: number): RgbColor {
    // 确保 percent 在 0 到 100 之间
    percent = Math.max(0, Math.min(100, percent));

    // 计算每个颜色分量的增量
    const increment = (percent / 100) * 255;

    // 提升每个颜色分量的亮度
    const r = Math.min(255, Math.round(rgb.r + increment));
    const g = Math.min(255, Math.round(rgb.g + increment));
    const b = Math.min(255, Math.round(rgb.b + increment));

    return { r, g, b };
}

/**
 * @description 降低颜色的亮度
 * @param rgb 原始颜色对象
 * @param percent 0 - 100 的数字，代表降低的亮度比例
 * @returns 降低亮度后的 RgbColor 对象
 */
export function lowerBrightness(rgb: RgbColor, percent: number): RgbColor {
    // 确保 percent 在 0 到 100 之间
    percent = Math.max(0, Math.min(100, percent));

    // 计算每个颜色分量的增量
    const increment = (percent / 100) * 255;

    // 降低每个颜色分量的亮度
    const r = Math.max(0, Math.round(rgb.r - increment));
    const g = Math.max(0, Math.round(rgb.g - increment));
    const b = Math.max(0, Math.round(rgb.b - increment));

    return { r, g, b };
}

/**
 * @description gamma 修正
 * @param c 颜色通道值，取值范围为 0 - 255
 * @returns 修正后的值
 */
function gammaCorrected(c: number): number {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * @description 判断是否为亮色主题
 * @param r 红色通道值
 * @param g 绿色通道值
 * @param b 蓝色通道值
 * @returns 如果是亮色主题则返回 true，否则返回 false
 */
export function isLightColorTheme(r: number, g: number, b: number): boolean {
    r = gammaCorrected(r);
    g = gammaCorrected(g);
    b = gammaCorrected(b);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5;
}

/**
 * @description 导出为 rgb css 样式的字符串
 * @param rgb 颜色对象
 * @returns RGB CSS 字符串
 */
export function toRgbCssString(rgb: RgbColor): string {
    const { r, g, b } = rgb;
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * @description 导出为 rgba css 样式的字符串
 * @param rgb 颜色对象
 * @returns RGBA CSS 字符串
 */
export function toRgbaCssString(rgb: RgbColor): string {
    const { r, g, b, a } = rgb;
    return `rgba(${r}, ${g}, ${b}, ${a ?? 1})`;
}

interface ComputedColorOption {
    BaseForegroundColorMacroName?: string;
    BaseBackgroundColorMacroName?: string;
}

interface GetColorOption {
    mode?: 'pdf' | 'svg';
}

export class MacroColor {
    private option: ComputedColorOption;
    private rootStyles: CSSStyleDeclaration;
    private theme: 'light' | 'dark';
    public foregroundColor: RgbColor | undefined;
    public backgroundColor: RgbColor | undefined;
    public foregroundColorString: string;
    public backgroundColorString: string;

    constructor(option: ComputedColorOption = {}) {
        this.option = option;
        this.rootStyles = getComputedStyle(document.documentElement);

        const foregroundColorString = this.rootStyles.getPropertyValue(option.BaseForegroundColorMacroName || '--foreground');
        const backgroundColorString = this.rootStyles.getPropertyValue(option.BaseBackgroundColorMacroName || '--background');
        this.foregroundColor = parseColor(foregroundColorString);
        this.backgroundColor = parseColor(backgroundColorString);

        this.foregroundColorString = foregroundColorString;
        this.backgroundColorString = backgroundColorString;

        if (this.backgroundColor) {
            const isLight = isLightColorTheme(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b);
            this.theme = isLight ? 'light' : 'dark';
        } else {
            this.theme = 'light'; // 默认主题
        }

        // 额外支持 trae 的默认主题
        const sidebarColorString = this.rootStyles.getPropertyValue('--sidebar');
        if (sidebarColorString === backgroundColorString) {
            const newSidebarColor = this.theme === 'dark' ? '#252a38' : '#edeff2';
            document.documentElement.style.setProperty('--sidebar', newSidebarColor);
            pinkLog('修改 sidebar 颜色为' + newSidebarColor);
        }
    }

    /**
     * @description 获取颜色值
     * @param macroName CSS 变量名
     * @param option 配置选项
     * @returns 颜色值字符串
     */
    getColor(macroName: string, option: GetColorOption = {}): string {
        const theme = this.theme;
        const rootStyles = this.rootStyles;
        const mode = option.mode || 'svg';

        if (mode === 'svg') {
            // svg 模式下，导出的效果和 webview 渲染效果基本一致，直接导出即可
            return rootStyles.getPropertyValue(macroName);
        }

        // pdf 模式需要对黑色主题的几个特殊颜色进行处理，并对所有透明颜色进行混合处理
        switch (macroName) {
            case '--foreground':
            case '--wire-color':
            case '--cross-dot-color':
                if (theme === 'dark') {
                    return '#2D323B';
                }
        }

        const colorString = rootStyles.getPropertyValue(macroName);
        if (!colorString) {
            // 如果 macroName 不存在，返回空字符串
            return colorString;
        }

        const color = parseColor(colorString);
        if (!color) {
            return colorString;
        }

        if (!color.a) {
            // 不具有透明通道，在 pdf 中渲染效果和 svg 中一致，直接返回即可
            return toRgbCssString(color);
        }

        // 透明度插值公式为 c = c_f * alpha + c_b * (1 - alpha)
        const mixedBg = parseColor('#ffffff')!; // 假设背景为白色
        const mixedColor = {
            r: Math.round(color.r * color.a + mixedBg.r * (1 - color.a)),
            g: Math.round(color.g * color.a + mixedBg.g * (1 - color.a)),
            b: Math.round(color.b * color.a + mixedBg.b * (1 - color.a)),
        };

        return toRgbCssString(mixedColor);
    }
}

export const macroColor = new MacroColor();