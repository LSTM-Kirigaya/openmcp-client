<template>
    <div class="ask-user-question-container">
        <div v-for="(q, qIndex) in props.questions" :key="qIndex" class="question-block">
            <div class="question-header">
                <span class="iconfont icon-question"></span>
                <span class="question-text">{{ q.question }}</span>
                <span v-if="q.multiSelect" class="question-badge">Multi-select</span>
            </div>

            <div class="options-list">
                <div 
                    v-for="(opt, oIndex) in q.options" 
                    :key="oIndex"
                    class="option-item"
                    :class="{ 
                        'option-selected': isSelected(qIndex, opt.label),
                        'option-recommended': opt.label.includes('(Recommended)')
                    }"
                    @click="toggleOption(qIndex, opt.label, q.multiSelect)"
                >
                    <div class="option-label-row">
                        <span class="option-check">
                            <span v-if="isSelected(qIndex, opt.label)" class="iconfont icon-dui"></span>
                            <span v-else class="option-check-empty"></span>
                        </span>
                        <span class="option-label">{{ opt.label }}</span>
                    </div>
                    <div class="option-description">{{ opt.description }}</div>
                </div>

                <!-- Other 选项 -->
                <div 
                    class="option-item option-other"
                    :class="{ 'option-selected': isOtherSelected(qIndex) }"
                    @click="selectOther(qIndex, q.multiSelect)"
                >
                    <div class="option-label-row">
                        <span class="option-check">
                            <span v-if="isOtherSelected(qIndex)" class="iconfont icon-dui"></span>
                            <span v-else class="option-check-empty"></span>
                        </span>
                        <span class="option-label">Other</span>
                    </div>
                    <el-input
                        v-if="isOtherSelected(qIndex)"
                        v-model="otherTexts[qIndex]"
                        type="textarea"
                        :rows="2"
                        placeholder="Please specify your answer..."
                        class="other-input"
                        @click.stop
                    />
                </div>
            </div>
        </div>

        <div class="question-actions">
            <el-button 
                type="primary" 
                class="submit-btn"
                @click="handleSubmit"
                :disabled="!canSubmit || submitted"
            >
                <span class="iconfont icon-send"></span>
                Submit Answer
            </el-button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineComponent, defineProps, defineEmits, computed } from 'vue';
import type { Question } from '@/api/plan-mode';

defineComponent({ name: 'ask-user-question' });

const props = defineProps({
    questions: {
        type: Array as () => Question[],
        required: true
    }
});

const emits = defineEmits(['answer']);

// 每个问题的选中项（单选=string，多选=string[]）
const selections = ref<Record<number, string[]>>({});
const otherTexts = ref<Record<number, string>>({});
const submitted = ref(false);

function isSelected(qIndex: number, label: string): boolean {
    return selections.value[qIndex]?.includes(label) ?? false;
}

function isOtherSelected(qIndex: number): boolean {
    const sel = selections.value[qIndex] || [];
    return sel.some(s => s.startsWith('Other:'));
}

function toggleOption(qIndex: number, label: string, multiSelect?: boolean) {
    if (submitted.value) return;
    if (!selections.value[qIndex]) {
        selections.value[qIndex] = [];
    }
    const sel = selections.value[qIndex];
    const idx = sel.indexOf(label);

    if (multiSelect) {
        if (idx >= 0) {
            sel.splice(idx, 1);
        } else {
            sel.push(label);
        }
    } else {
        // 单选：清除其他选择（包括 Other）
        selections.value[qIndex] = [label];
    }
}

function selectOther(qIndex: number, multiSelect?: boolean) {
    if (submitted.value) return;
    const otherKey = `Other:${otherTexts.value[qIndex] || ''}`;
    if (!selections.value[qIndex]) {
        selections.value[qIndex] = [];
    }
    const sel = selections.value[qIndex];
    const existingIdx = sel.findIndex(s => s.startsWith('Other:'));

    if (multiSelect) {
        if (existingIdx >= 0) {
            sel.splice(existingIdx, 1);
        } else {
            sel.push(otherKey);
        }
    } else {
        selections.value[qIndex] = [otherKey];
    }
}

const canSubmit = computed(() => {
    for (let i = 0; i < props.questions.length; i++) {
        const sel = selections.value[i];
        if (!sel || sel.length === 0) {
            return false;
        }
        // 如果选了 Other 但没填内容
        for (const s of sel) {
            if (s.startsWith('Other:') && s === 'Other:') {
                return false;
            }
        }
    }
    return true;
});

function handleSubmit() {
    if (submitted.value) return;
    submitted.value = true;

    const answers: Record<string, string> = {};
    for (let i = 0; i < props.questions.length; i++) {
        const q = props.questions[i];
        const sel = selections.value[i] || [];
        // 处理 Other 选项的实际文本
        const processed = sel.map(s => {
            if (s.startsWith('Other:')) {
                const text = s.slice(6);
                return text || 'Other';
            }
            return s;
        });
        answers[q.question] = processed.join(', ');
    }

    emits('answer', answers);
}
</script>

<style scoped>
.ask-user-question-container {
    border: 1px solid var(--main-light-color-50);
    border-radius: 8px;
    padding: 12px;
    background: var(--main-light-color-5);
    margin-top: 8px;
    max-width: 600px;
}

.question-block {
    margin-bottom: 16px;
}

.question-block:last-child {
    margin-bottom: 0;
}

.question-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--main-light-color-20);
}

.question-text {
    font-weight: 600;
    font-size: var(--chat-font-size);
    color: var(--foreground);
    flex: 1;
}

.question-badge {
    font-size: var(--chat-font-size-xs);
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--main-light-color-20);
    color: var(--main-color);
    border: 1px solid var(--main-light-color-50);
}

.options-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.option-item {
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid var(--sidebar-item-border);
    background: var(--el-input-bg-color, var(--el-fill-color-blank));
    cursor: pointer;
    transition: all 0.2s;
}

.option-item:hover {
    border-color: var(--main-light-color-70);
    background: var(--main-light-color-5);
}

.option-selected {
    border-color: var(--main-color) !important;
    background: var(--main-light-color-10) !important;
}

.option-recommended {
    border-left: 3px solid var(--main-color);
}

.option-label-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.option-check {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.option-check-empty {
    width: 14px;
    height: 14px;
    border: 1.5px solid var(--el-text-color-secondary);
    border-radius: 3px;
}

.option-selected .option-check-empty {
    border-color: var(--main-color);
}

.option-label {
    font-weight: 500;
    font-size: var(--chat-font-size);
    color: var(--foreground);
}

.option-description {
    font-size: var(--chat-font-size-sm);
    color: var(--el-text-color-secondary);
    margin-top: 3px;
    margin-left: 26px;
    line-height: 1.4;
}

.option-other {
    border-style: dashed;
}

.other-input {
    margin-top: 8px;
    margin-left: 26px;
}

.question-actions {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--main-light-color-20);
    display: flex;
    justify-content: flex-end;
}

.submit-btn {
    font-size: var(--chat-font-size-sm);
    padding: 6px 16px;
    border-radius: 6px;
}
</style>
