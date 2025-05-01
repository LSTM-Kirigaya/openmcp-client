import Prism from "./prism";

// 定义 escapeHtml 函数
function escapeHtml(unsafe: string) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 导出默认的 highlight 函数
export default function highlight(str: string, lang: string) {
    // 创建代码块容器
    let container = `<div class="openmcp-code-block">`;
    
    // 添加复制按钮（右上角）
    container += `
    <div class="code-header">
    <div class="code-language">${lang || ''}</div>
    <button class="copy-button" onclick="copyCode(this)">复制</button>
    </div>
    `;
    
    if (lang && Prism.languages[lang]) {
        // 使用 Prism 高亮代码
        const highlightedCode = Prism.highlight(str, Prism.languages[lang], lang);
        // 添加代码区域
        container += `<pre class="language-${lang}"><code class="language-${lang}">${highlightedCode}</code></pre>`;
    } else {
        // 普通代码块
        container += `<pre class="language-none"><code>${escapeHtml(str)}</code></pre>`;
    }
    
    container += `</div>`;
    return container;
}

// 全局复制函数
(window as any).copyCode = function (button: HTMLElement) {
    const codeBlock = button.closest('.openmcp-code-block');
    if (!codeBlock) return;
    const codeElement = codeBlock.querySelector('code');
    const code = codeElement?.textContent || '';
    
    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.textContent;
        button.textContent = '已复制';
        setTimeout(() => {
            button.textContent = originalText;
        }, 500);
    }).catch((error) => {
        console.error('复制失败:', error);
        button.textContent = '复制失败';
    });
};