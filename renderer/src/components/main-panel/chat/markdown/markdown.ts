import MarkdownIt from 'markdown-it';
import MarkdownKatex from './markdown-katex';
import MarkdownHighlight from './markdown-highlight';

const md = new MarkdownIt({
    highlight: MarkdownHighlight({ needTools: true }),
});

md.renderer.rules.table_open = () => '<div class="openmcp-markdown-table"><table>';
md.renderer.rules.table_close = () => '</table></div>';

md.use(MarkdownKatex, {
    delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '$$', right: '$$', display: false },
    ],
});

export const markdownToHtml = (markdown: string) => {
    return md.render(markdown);
};

const pureHighLightMd = new MarkdownIt({
    highlight: MarkdownHighlight({ needTools: false }),
});

export const copyToClipboard = (text: string) => {
    //  支持 nodejs 下运行
    const thisWindow = window as any;
    if (!thisWindow || !thisWindow.navigator || !thisWindow.navigator.clipboard) {
        return;
    }
    
    return navigator.clipboard.writeText(text);
};

const tryParseJson = (text: string): { ok: true; value: object } | { ok: false; raw: string } => {
    try {
        const value = JSON.parse(text);
        return typeof value === 'object' && value !== null ? { ok: true, value } : { ok: false, raw: text };
    } catch {
        return { ok: false, raw: text };
    }
};

/** 将对象或字符串渲染为“打印风格”的代码块，便于调试：JSON 自动格式化高亮，非 JSON 字符串用通用代码块展示 */
export const renderJson = (obj: object | string | undefined): string => {
    if (obj === undefined || obj === null) {
        return '<span>Invalid JSON</span>';
    }

    let md: string;
    if (typeof obj === 'string') {
        const parsed = tryParseJson(obj);
        if (parsed.ok) {
            md = '```json\n' + JSON.stringify(parsed.value, null, 2) + '\n```';
        } else {
            md = '```\n' + parsed.raw + '\n```';
        }
    } else {
        md = '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
    }
    return pureHighLightMd.render(md);
}
