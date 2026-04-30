import { useMessageBridge } from "./message-bridge";

// ========== Plan Mode 状态类型 ==========

export interface PlanModeState {
    isPlanMode: boolean;
    planContent: string | null;
    planFilePath: string | null;
}

export function createPlanModeState(): PlanModeState {
    return {
        isPlanMode: false,
        planContent: null,
        planFilePath: null
    };
}

// ========== AskUserQuestion 类型 ==========

export interface QuestionOption {
    label: string;
    description: string;
}

export interface Question {
    question: string;
    options: QuestionOption[];
    multiSelect?: boolean;
}

export interface AskUserQuestionInput {
    questions: Question[];
}

export interface AskUserQuestionMeta {
    type: 'ask_user_question';
    questions: Question[];
    awaitingAnswer: boolean;
}

export function isAskUserQuestionMeta(meta: any): meta is AskUserQuestionMeta {
    return meta && meta.type === 'ask_user_question' && Array.isArray(meta.questions);
}

// ========== 全局 Promise 解析器（用于 AskUserQuestion 阻塞等待） ==========

const askUserQuestionResolvers = new Map<string, (answers: Record<string, string>) => void>();

export function createAskUserQuestionPromise(sessionId: string): Promise<Record<string, string>> {
    return new Promise((resolve) => {
        askUserQuestionResolvers.set(sessionId, resolve);
    });
}

export function resolveAskUserQuestion(sessionId: string, answers: Record<string, string>): boolean {
    const resolver = askUserQuestionResolvers.get(sessionId);
    if (resolver) {
        resolver(answers);
        askUserQuestionResolvers.delete(sessionId);
        return true;
    }
    return false;
}

// ========== Plan 文件管理（通过 Message Bridge 调用 Service） ==========

export async function getPlanFilePath(sessionId: string): Promise<string> {
    const bridge = useMessageBridge();
    const { code, msg } = await bridge.commandRequest<{ filePath: string }>('plan-mode/get-file-path', { sessionId });
    if (code !== 200 || !msg?.filePath) {
        throw new Error('Failed to get plan file path');
    }
    return msg.filePath;
}

export async function readPlan(sessionId: string): Promise<string | null> {
    const bridge = useMessageBridge();
    const { code, msg } = await bridge.commandRequest<{ content: string | null }>('plan-mode/read', { sessionId });
    if (code !== 200) {
        return null;
    }
    return msg?.content ?? null;
}

export async function writePlan(sessionId: string, content: string): Promise<void> {
    const bridge = useMessageBridge();
    await bridge.commandRequest('plan-mode/write', { sessionId, content });
}

// ========== 内置工具 Schema ==========

export const ENTER_PLAN_MODE_TOOL = {
    type: 'function' as const,
    function: {
        name: 'EnterPlanMode',
        description: 'Requests permission to enter plan mode for complex tasks requiring exploration and design before implementation. Use when: (1) New feature implementation, (2) Multiple valid approaches exist, (3) Code modifications affect existing behavior, (4) Architectural decisions needed, (5) Multi-file changes (>2-3 files), (6) Unclear requirements need exploration, (7) User preferences matter. Do NOT use for: single-line fixes, obvious bugs, tasks with very specific instructions, pure research tasks.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    }
};

export const EXIT_PLAN_MODE_TOOL = {
    type: 'function' as const,
    function: {
        name: 'ExitPlanMode',
        description: 'Use when you are in plan mode and have finished writing your plan and are ready for user approval. This tool signals you are done planning and ready for the user to review. The plan is read from the plan file, not passed as a parameter.',
        parameters: {
            type: 'object',
            properties: {
                plan: {
                    type: 'string',
                    description: 'Optional plan content. If not provided, the plan will be read from the plan file.'
                }
            },
            required: []
        }
    }
};

export const ASK_USER_QUESTION_TOOL = {
    type: 'function' as const,
    function: {
        name: 'AskUserQuestion',
        description: 'Asks the user multiple choice questions to gather information, clarify ambiguity, understand preferences, make decisions or offer them choices. Use when you need to ask the user questions during execution. This allows you to: 1. Gather user preferences or requirements, 2. Clarify ambiguous instructions, 3. Get decisions on implementation choices as you work, 4. Offer choices to the user about what direction to take. Usage notes: - Users will always be able to select "Other" to provide custom text input - Use multiSelect: true to allow multiple answers to be selected for a question - If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label',
        parameters: {
            type: 'object',
            properties: {
                questions: {
                    type: 'array',
                    description: 'Questions to ask the user (1-4 questions)',
                    minItems: 1,
                    maxItems: 4,
                    items: {
                        type: 'object',
                        properties: {
                            question: {
                                type: 'string',
                                description: 'The complete question to ask the user. Should be clear, specific, and end with a question mark.'
                            },
                            options: {
                                type: 'array',
                                description: 'The available choices for this question. Must have 2-4 options.',
                                minItems: 2,
                                maxItems: 4,
                                items: {
                                    type: 'object',
                                    properties: {
                                        label: {
                                            type: 'string',
                                            description: 'The display text for this option that the user will see and select. Should be concise (1-5 words).'
                                        },
                                        description: {
                                            type: 'string',
                                            description: 'Explanation of what this option means or what will happen if chosen.'
                                        }
                                    },
                                    required: ['label', 'description']
                                }
                            },
                            multiSelect: {
                                type: 'boolean',
                                default: false,
                                description: 'Set to true to allow the user to select multiple options instead of just one.'
                            }
                        },
                        required: ['question', 'options']
                    }
                }
            },
            required: ['questions']
        }
    }
};

// ========== Plan Mode System Prompt ==========

export const PLAN_MODE_SYSTEM_PROMPT = `You are currently in **Plan Mode**.

## Rules
1. **DO NOT write or edit any files except the plan file.** This is a read-only exploration and planning phase.
2. Thoroughly explore the codebase using available tools (Glob, Grep, ReadFile, etc.).
3. Understand existing patterns, architecture, and conventions.
4. Consider multiple approaches and their trade-offs.
5. Use AskUserQuestion if you need to clarify requirements or approaches.
6. Design a concrete, implementable strategy.
7. Write your complete plan to the plan file (use FileWrite or similar tools to write to the plan file path that will be provided).
8. When ready, use **ExitPlanMode** to present your plan for user approval.

## Plan Format
Your plan should be a clear markdown document that includes:
- **Goal**: What you are trying to achieve
- **Exploration Summary**: What you learned from the codebase
- **Approach**: The chosen implementation strategy
- **Steps**: Numbered list of concrete implementation steps
- **Files Affected**: List of files that will be modified
- **Testing**: How to verify the implementation

## Important
- No code changes will be made until the user approves the plan.
- Keep the plan concise but complete.
- If the user rejects the plan, you will stay in plan mode and can revise.`;

export const EXIT_PLAN_MODE_APPROVED_PROMPT = `User has approved your plan. You can now start implementing.

Please proceed with the implementation according to the approved plan. Start by updating your todo list if applicable, then execute the plan step by step.`;

export const EXIT_PLAN_MODE_REJECTED_PROMPT = (feedback: string) => `User feedback on the plan: ${feedback}

Please stay in plan mode and revise the plan based on the feedback. Update the plan file and call ExitPlanMode again when ready.`;

export const EXIT_PLAN_MODE_REPLAN_PROMPT = `User requested to replan. Please review the current plan, consider what needs to change, and write an updated plan to the plan file. Call ExitPlanMode when ready.`;

// ========== Plan Approval Meta Type ==========

export interface PlanApprovalMeta {
    type: 'plan_approval';
    plan: string;
    sessionId: string;
}

export function isPlanApprovalMeta(meta: any): meta is PlanApprovalMeta {
    return meta && meta.type === 'plan_approval' && typeof meta.plan === 'string';
}
