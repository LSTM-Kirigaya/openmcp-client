<template>
    <div class="plan-approval-container">
        <div class="plan-approval-header">
            <span class="iconfont icon-plan"></span>
            <span class="plan-approval-title">Plan Approval</span>
            <span class="plan-approval-badge">Plan Mode</span>
        </div>

        <div class="plan-content-wrapper">
            <div class="plan-content-label">Plan Content:</div>
            <div class="plan-content-body" v-html="markdownToHtml(props.plan)"></div>
        </div>

        <div class="plan-actions">
            <el-button 
                type="success" 
                class="plan-btn plan-btn-approve"
                @click="handleApprove"
                :disabled="submitted"
            >
                <span class="iconfont icon-dui"></span>
                Approve & Start Implementing
            </el-button>

            <el-button 
                type="warning" 
                class="plan-btn plan-btn-replan"
                @click="handleReplan"
                :disabled="submitted"
            >
                <span class="iconfont icon-refresh"></span>
                Replan
            </el-button>

            <el-button 
                type="danger" 
                class="plan-btn plan-btn-reject"
                @click="showFeedback = true"
                :disabled="submitted"
            >
                <span class="iconfont icon-close"></span>
                Reject & Feedback
            </el-button>
        </div>

        <div v-if="showFeedback" class="plan-feedback-area">
            <el-input
                v-model="feedbackText"
                type="textarea"
                :rows="3"
                placeholder="Tell Claude what to change in the plan..."
                class="plan-feedback-input"
            />
            <div class="plan-feedback-actions">
                <el-button 
                    type="primary" 
                    @click="handleRejectWithFeedback"
                    :disabled="!feedbackText.trim() || submitted"
                >
                    Submit Feedback
                </el-button>
                <el-button @click="showFeedback = false">Cancel</el-button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineComponent, defineProps, defineEmits } from 'vue';
import { markdownToHtml } from '@/components/main-panel/chat/markdown/markdown';

defineComponent({ name: 'plan-approval' });

const props = defineProps({
    plan: {
        type: String,
        required: true
    }
});

const emits = defineEmits(['approve', 'reject', 'replan']);

const showFeedback = ref(false);
const feedbackText = ref('');
const submitted = ref(false);

function handleApprove() {
    submitted.value = true;
    emits('approve');
}

function handleReplan() {
    submitted.value = true;
    emits('replan');
}

function handleRejectWithFeedback() {
    submitted.value = true;
    emits('reject', feedbackText.value.trim());
}
</script>

<style scoped>
.plan-approval-container {
    border: 1px solid var(--main-light-color-50);
    border-radius: 8px;
    padding: 12px;
    background: var(--main-light-color-5);
    margin-top: 8px;
}

.plan-approval-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--main-light-color-20);
}

.plan-approval-title {
    font-weight: 600;
    font-size: var(--chat-font-size);
    color: var(--main-color);
}

.plan-approval-badge {
    font-size: var(--chat-font-size-xs);
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--main-light-color-20);
    color: var(--main-color);
    border: 1px solid var(--main-light-color-50);
}

.plan-content-wrapper {
    margin-bottom: 12px;
}

.plan-content-label {
    font-size: var(--chat-font-size-sm);
    font-weight: 600;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
}

.plan-content-body {
    font-size: var(--chat-font-size);
    line-height: 1.6;
    max-height: 400px;
    overflow-y: auto;
    padding: 10px;
    background: var(--el-input-bg-color, var(--el-fill-color-blank));
    border: 1px solid var(--sidebar-item-border);
    border-radius: 6px;
}

.plan-content-body :deep(pre) {
    background: var(--sidebar-item-selected);
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
}

.plan-content-body :deep(code) {
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: 13px;
}

.plan-content-body :deep(ul),
.plan-content-body :deep(ol) {
    padding-left: 20px;
    margin: 6px 0;
}

.plan-content-body :deep(li) {
    margin: 3px 0;
}

.plan-content-body :deep(h1),
.plan-content-body :deep(h2),
.plan-content-body :deep(h3),
.plan-content-body :deep(h4) {
    margin: 10px 0 6px 0;
    font-weight: 600;
}

.plan-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.plan-btn {
    font-size: var(--chat-font-size-sm);
    padding: 6px 12px;
    border-radius: 6px;
}

.plan-btn-approve {
    background-color: var(--signal-success-bg, #f0f9eb) !important;
    border-color: var(--signal-success-color, #67c23a) !important;
    color: var(--signal-success-color, #67c23a) !important;
}

.plan-btn-approve:hover {
    background-color: var(--signal-success-color, #67c23a) !important;
    color: white !important;
}

.plan-btn-replan {
    background-color: var(--signal-warning-bg, #fdf6ec) !important;
    border-color: var(--signal-warning-color, #e6a23c) !important;
    color: var(--signal-warning-color, #e6a23c) !important;
}

.plan-btn-replan:hover {
    background-color: var(--signal-warning-color, #e6a23c) !important;
    color: white !important;
}

.plan-btn-reject {
    background-color: var(--signal-danger-bg, #fef0f0) !important;
    border-color: var(--signal-danger-color, #f56c6c) !important;
    color: var(--signal-danger-color, #f56c6c) !important;
}

.plan-btn-reject:hover {
    background-color: var(--signal-danger-color, #f56c6c) !important;
    color: white !important;
}

.plan-feedback-area {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--main-light-color-20);
}

.plan-feedback-input {
    margin-bottom: 8px;
}

.plan-feedback-actions {
    display: flex;
    gap: 8px;
}
</style>
