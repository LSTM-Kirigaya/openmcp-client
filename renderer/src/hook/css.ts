import { isLightColorTheme, parseColor } from "./color";

export function setDefaultCss() {
    // 改变默认颜色
    document.body.style.setProperty('--el-color-primary', 'var(--main-color)');
    document.body.style.setProperty('--el-color-primary-light-9', 'var(--main-color)');
    document.body.style.setProperty('--el-color-primary-light-3', 'var(--main-color)');
    document.body.style.setProperty('--el-text-color-secondary', 'var(--foreground)');
    document.body.style.setProperty('--el-text-color-regular', 'var(--foreground)');
    document.body.style.setProperty('--el-border-color', 'var(--vscode-input-border)');
    document.body.style.setProperty('--el-fill-color-blank', 'var(--sidebar)');
    document.body.style.setProperty('--el-fill-color-light', 'var(--vscode-button-hoverBackground)');
    document.body.style.setProperty('--el-switch-on-color', 'var(--main-color)');
    document.body.style.setProperty('--el-border', 'var(--sidebar)');
    document.body.style.setProperty('--el-border-color-light', 'var(--sidebar)');
    document.body.style.setProperty('--el-border-color-lighter', 'var(--sidebar)');
    document.body.style.setProperty('--el-bg-color-overlay', 'var(--sidebar)');
    document.body.style.setProperty('--el-color-info-light-9', 'var(--main-color)');
    document.body.style.setProperty('--el-color-info', 'var(--foreground)');
    document.body.style.setProperty('--el-color-info-light-8', 'var(--main-color)');
    document.body.style.setProperty('--el-fill-color-light', 'var(--sidebar-item-selected)');
    document.body.style.setProperty('--el-color-primary-dark-2', 'var(--main-light-color)');
    document.body.style.setProperty('--el-fill-color-dark', 'var(--main-light-color)');
    document.body.style.setProperty('--el-fill-color-darker', 'var(--main-light-color)');
    document.body.style.setProperty('--el-color-primary-light-5', 'var(--button-disabled)');
    document.body.style.setProperty('--el-bg-color', 'var(--background)');
    document.body.style.setProperty('--el-text-color-primary', 'var(--foreground)');
    document.body.style.setProperty('--el-button-hover-text-color', 'var(--background)');

    // document.body.style.setProperty('--el-color-white', 'var(--background)');
    
    // 设置全局宏
    document.body.style.setProperty('--time-scale-height', '30px');
    document.body.style.setProperty('--vcd-render-padding', '30px');
    document.body.style.setProperty('--sidebar-width', '330px');
    document.body.style.setProperty('--toolbar-height', '60px');

    // 下面是 get style
    const style = getComputedStyle(document.documentElement);
    // 根据颜色亮度来设置额外的宏
    const bgColorString = style.getPropertyValue('--background');
    
    const color = parseColor(bgColorString);
    if (!color) {
        return;
    }

    const { r, g, b } = color;
    if (isLightColorTheme(r, g, b)) {
        setExtraLightColorCss();
    } else {
        setExtraDarkColorCss();
    }

    const acquireVsCodeApi = (window as any)['acquireVsCodeApi']
    const mode = acquireVsCodeApi === undefined ? 'debug' : 'release';
    if (mode === 'debug') {
        // 判断颜色深浅，模拟 .vscode-dark 的加入
        const theme = getThemeColor();
        const app = document.getElementById('app');
        
        app?.classList.add('vscode-' + theme);
    }
}

let themeColor: 'light' | 'dark' | undefined = undefined;

export function getThemeColor(): 'light' | 'dark' {
    if (themeColor) {
        return themeColor;
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const backgroundColorString = rootStyles.getPropertyValue('--background');
    const backgroundColor = parseColor(backgroundColorString);
    if (backgroundColor) {
        const isLight = isLightColorTheme(backgroundColor.r, backgroundColor.g, backgroundColor.b);
        themeColor = isLight ? 'light' : 'dark';
        return themeColor;
    }

    return 'dark';
}

function setExtraLightColorCss() {
    document.body.style.setProperty('--vline-stroke-color', '#ddd');
}

function setExtraDarkColorCss() {
    document.body.style.setProperty('--vline-stroke-color', '#333');
}