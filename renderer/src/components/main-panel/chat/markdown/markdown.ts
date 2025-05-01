import MarkdownIt from 'markdown-it';
import MarkdownKatex from './markdown-katex';
import MarkdownHighlight from './markdown-highlight';

const md = new MarkdownIt({
    highlight: MarkdownHighlight,
});

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

export const copyToClipboard = (text: string) => {
    return navigator.clipboard.writeText(text);
};
