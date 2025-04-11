import katex from 'katex';
import type MarkdownIt from "markdown-it";


// 定义 delimiter 对象的类型
type Delimiter = {
    left: string;
    right: string;
    display: boolean;
};

// 定义 defaultOptions 对象的类型
type DefaultOptions = {
    delimiters: Delimiter[];
};

// 定义 defaultOptions 常量
const defaultOptions: DefaultOptions = {
    delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
    ],
};

// 定义 escapedBracketRule 函数
function escapedBracketRule(options: DefaultOptions): any {
    return (state: any, silent: boolean): boolean => {
        const max: number = state.posMax;
        const start: number = state.pos;

        for (const { left, right, display } of options.delimiters) {
            // 检查是否以左标记开始
            if (!state.src.slice(start).startsWith(left)) continue;

            // 跳过左标记的长度
            let pos: number = start + left.length;

            // 寻找匹配的右标记
            while (pos < max) {
                if (state.src.slice(pos).startsWith(right)) {
                    break;
                }
                pos++;
            }

            // 没找到匹配的右标记，跳过，进入下个匹配
            if (pos >= max) continue;

            // 如果不是静默模式，将 LaTeX 公式转换为 MathML
            if (!silent) {
                const content: string = state.src.slice(start + left.length, pos);
                try {
                    const renderedContent: string = katex.renderToString(content, {
                        throwOnError: false,
                        output: 'mathml',
                        displayMode: display,
                    });
                    const token = state.push('html_inline', '', 0);
                    token.content = renderedContent;
                } catch (e) {
                    console.error(e);
                }
            }

            // 更新位置，跳过右标记的长度
            state.pos = pos + right.length;
            return true;
        }
        return false;
    };
}

// 定义主函数
export default function (md: MarkdownIt, options: DefaultOptions = defaultOptions): void {
    md.inline.ruler.after('text', 'escaped_bracket', escapedBracketRule(options));
}