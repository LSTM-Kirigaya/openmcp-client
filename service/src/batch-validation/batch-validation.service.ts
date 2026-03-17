import { chatCompletion } from "../llm/llm.service.js";

export type EvaluationMode = 'pass-fail' | 'score';

export interface TestCase {
    id: string;
    /** 测试用例描述/期望：模型输出应满足的条件 */
    expectedCriteria: string;
    name?: string;
}

export interface BatchValidationOptions {
    /** 对话消息列表 (user/assistant 多轮) */
    messages: Array<{ role: string; content: string }>;
    /** 测试用例列表 */
    testCases: TestCase[];
    /** 评估模式：对错 或 0-10 评分 */
    evaluationMode: EvaluationMode;
    /** 自定义评估提示词模板，支持占位符: {{testCase}}, {{messages}} */
    customPrompt?: string;
    /** LLM 配置 */
    llmConfig: {
        baseURL: string;
        apiKey: string;
        model: string;
        temperature?: number;
    };
}

export interface ValidationResult {
    testCaseId: string;
    testCaseCriteria: string;
    rawResponse: string;
    /** pass-fail 模式: 'pass' | 'fail' | 'unknown' */
    pass?: boolean;
    /** 评估理由（尤其用于 fail 时说明失败原因） */
    reason?: string;
    /** score 模式: 0-10 */
    score?: number;
    error?: string;
    /** 本条评估消耗的 token（仅评估 LLM，不含 trace） */
    evalInputTokens?: number;
    evalOutputTokens?: number;
}

const DEFAULT_PASS_FAIL_PROMPT = `你是一个专业的语义对齐专家。请根据「测试用例期望」判定「Agent 执行 Trace」中的结果是否在逻辑上满足要求。

## 判定准则（重要）：
1. **语义包含原则**：如果期望是“重装干员”，而实际输出是其具体子类（如“六星重装”、“受法盾卫”），应视为【通过】。
2. **变体包容原则**：如果期望是某个动作（如“引体向上”），实际输出是其进阶或增强版本（如“负重引体”），除非明确禁止，否则应视为【通过】。
3. **忽略冗余**：搜索结果中包含的额外属性（如星级、稀有度、立绘说明）不应作为判定错误的依据，只要核心属性匹配即可。

## 判定步骤 (DeepEval 思考模式)：
- 第一步：从 Trace 中提取实际获取到的目标实体及其核心属性。
- 第二步：对比期望中的关键词，判断是否存在父子类包含关系或变体关系。
- 第三步：给出最终 result。

## 输入数据
- 测试用例期望：{{testCase}}
- Agent 执行 Trace：{{messages}}

请严格返回 JSON（不要输出 markdown 代码块）：
{
  "reasoning": "简述属性提取与对比的逻辑过程",
  "result": "pass" | "fail",
  "reason": "如果 fail，请说明缺失的核心属性；如果 pass，简述匹配依据"
}`;

const DEFAULT_SCORE_PROMPT = `你是一个精细化的输出评估专家。请根据以下「测试用例期望」对「Agent 执行 Trace」进行评分。

## 评分量表 (Rubric):
- **10分**：完全满足期望，核心属性精准匹配，且语义关系完全正确（包括正确的子类包含逻辑）。
- **7-9分**：满足核心期望，虽然包含额外的冗余信息或采用了进阶变体（如负重版本），但不影响目标达成。
- **4-6分**：部分满足，核心属性存在但有细微偏差，或者搜索到的实体虽然类型正确但并非用户最想要的那个。
- **1-3分**：严重偏差，类型不匹配（例如要求重装，结果给了一个近卫）。
- **0分**：完全无关或未找到任何结果。

## 判定逻辑：
请注意：不要因为“描述过于具体”而扣分。例如“六星重装”完全属于“重装”；“负重引体”在运动逻辑上属于“引体”的范畴。

## 数据
- 测试用例期望：{{testCase}}
- Agent 执行 Trace：{{messages}}

请输出以下格式：
【分析】：简短描述模型输出与期望的语义重合度。
【得分】：[仅回复一个0-10的整数]`;

function formatMessagesForPrompt(messages: Array<{ role: string; content: string }>): string {
    return messages
        .map((m) => {
            const roleLabel =
                m.role === 'user' ? '用户' :
                m.role === 'assistant' ? '助手' :
                m.role === 'tool' ? '工具' : m.role;
            return `【${roleLabel}】\n${m.content}`;
        })
        .join('\n\n---\n\n');
}

function buildEvaluationPrompt(
    testCase: TestCase,
    messagesText: string,
    mode: EvaluationMode,
    customPrompt?: string
): string {
    const template =
        customPrompt?.trim() ||
        (mode === 'pass-fail' ? DEFAULT_PASS_FAIL_PROMPT : DEFAULT_SCORE_PROMPT);
    return template
        .replace(/\{\{testCase\}\}/g, testCase.expectedCriteria)
        .replace(/\{\{messages\}\}/g, messagesText);
}

function parsePassFailResponse(text: string): boolean | 'unknown' {
    const t = text.trim().toLowerCase();
    if (t.includes('对') || t === 'true' || t === 'yes' || t === 'pass' || t === '1') return true;
    if (t.includes('错') || t === 'false' || t === 'no' || t === 'fail' || t === '0') return false;
    return 'unknown';
}

function extractJsonObject(text: string): string | null {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
    const match = trimmed.match(/\{[\s\S]*\}/);
    return match ? match[0] : null;
}

function parsePassFailWithReason(text: string): { pass?: boolean; reason?: string } {
    const raw = text.trim();
    const jsonText = extractJsonObject(raw);
    if (jsonText) {
        try {
            const parsed = JSON.parse(jsonText) as any;
            const resultRaw = String(parsed?.result ?? parsed?.pass ?? parsed?.judgement ?? '').toLowerCase();
            const reasonRaw = typeof parsed?.reason === 'string' ? parsed.reason.trim() : '';
            if (resultRaw === 'pass' || resultRaw === 'true' || resultRaw === 'yes' || resultRaw === '对') {
                return { pass: true, reason: reasonRaw || undefined };
            }
            if (resultRaw === 'fail' || resultRaw === 'false' || resultRaw === 'no' || resultRaw === '错') {
                return { pass: false, reason: reasonRaw || undefined };
            }
        } catch {
            // ignore json parse error and fallback to text parsing
        }
    }
    const pass = parsePassFailResponse(raw);
    if (pass === true) return { pass: true, reason: undefined };
    if (pass === false) return { pass: false, reason: raw || undefined };
    return { pass: undefined, reason: raw || undefined };
}

function parseScoreResponse(text: string): number | null {
    const match = text.match(/\b([0-9]|10)\b/);
    if (match) {
        const n = parseInt(match[1], 10);
        if (n >= 0 && n <= 10) return n;
    }
    return null;
}

export async function runBatchValidation(
    options: BatchValidationOptions
): Promise<ValidationResult[]> {
    const { messages, testCases, evaluationMode, customPrompt, llmConfig } = options;
    const messagesText = formatMessagesForPrompt(messages);

    const tasks = testCases.map(async (tc) => {
        const systemContent = buildEvaluationPrompt(tc, messagesText, evaluationMode, customPrompt);
        const judgeMessages = [
            { role: 'system' as const, content: systemContent },
            { role: 'user' as const, content: '请根据上述要求进行评估并回复。' }
        ];

        try {
            const { content, usage } = await chatCompletion({
                baseURL: llmConfig.baseURL,
                apiKey: llmConfig.apiKey,
                model: llmConfig.model,
                messages: judgeMessages,
                temperature: llmConfig.temperature ?? 0
            });

            const result: ValidationResult = {
                testCaseId: tc.id,
                testCaseCriteria: tc.expectedCriteria,
                rawResponse: content
            };
            if (usage) {
                result.evalInputTokens = usage.prompt_tokens;
                result.evalOutputTokens = usage.completion_tokens;
            }

            if (evaluationMode === 'pass-fail') {
                const parsed = parsePassFailWithReason(content);
                result.pass = parsed.pass;
                result.reason = parsed.reason;
            } else {
                const score = parseScoreResponse(content);
                result.score = score ?? undefined;
            }

            return result;
        } catch (err) {
            return {
                testCaseId: tc.id,
                testCaseCriteria: tc.expectedCriteria,
                rawResponse: '',
                error: err instanceof Error ? err.message : String(err)
            } as ValidationResult;
        }
    });

    return Promise.all(tasks);
}
