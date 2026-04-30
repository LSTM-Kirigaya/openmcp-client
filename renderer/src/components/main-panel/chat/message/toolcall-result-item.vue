<template>
    <el-scrollbar width="100%" max-height="300px">
        <div v-if="props.item.type === 'text'" class="tool-text tool-text--print">
            <div class="tool-text-body tool-text-body--json">
                <JsonRender :json="props.item.text" :show-copy="false" />
            </div>
        </div>

        <div v-else-if="props.item.type === 'image'" class="tool-image">
            <div class="media-item" @click="showFullImage">
                <img :src="thumbnail" alt="screenshot" />
                <span class="float-container">
                    
                    <!-- 后处理结束后显示的部分 -->
                    <span class="iconfont icon-image" v-if="finishProcess"></span>

                    <!-- 后处理时显示的部分 -->
                    <el-progress v-else
                        class="progress"
                        :percentage="progress"
                        :stroke-width="5"
                        type="circle"
                        :width="80"
                        color="var(--foreground)"    
                    >
                        <template #default="{ percentage }">
                            <div class="progress-label">
                                <span class="percentage-value">{{ percentage }}%</span>
                                <span class="percentage-label">{{ progressText }}</span>
                            </div>
                        </template>
                    </el-progress>

                </span>
            </div>
        </div>

        <div v-else-if="isPlanApproval" class="tool-plan-approval">
            <PlanApproval 
                :plan="planApprovalContent"
                @approve="handleApprove"
                @reject="handleReject"
                @replan="handleReplan"
            />
        </div>

        <div v-else class="tool-other">
            <pre class="tool-other-json">{{ formatOtherItem(props.item) }}</pre>
        </div>
    </el-scrollbar>
</template>

<script setup lang="ts">
import { useMessageBridge } from '@/api/message-bridge';
import type { ToolCallContent } from '@/hook/type';
import { getBlobUrlByFilename } from '@/hook/util';
import { defineComponent, type PropType, defineProps, ref, defineEmits, computed } from 'vue';
import JsonRender from '@/components/json-render/index.vue';
import PlanApproval from './plan-approval.vue';
import { isPlanApprovalMeta } from '@/api/plan-mode';

defineComponent({ name: 'toolcall-result-item' });
const emits = defineEmits(['update:item', 'update:ocr-done', 'plan-approve', 'plan-reject', 'plan-replan']);

function formatOtherItem(item: ToolCallContent): string {
    try {
        const { _meta, ...rest } = item as any;
        return JSON.stringify(rest, null, 2);
    } catch {
        return JSON.stringify(item);
    }
}

const props = defineProps({
    item: {
        type: Object as PropType<ToolCallContent>,
        required: true
    }
});

const metaInfo = computed(() => (props.item as any)._meta || {});
const { ocr = false, workerId = '' } = metaInfo.value;

const isPlanApproval = computed(() => isPlanApprovalMeta(metaInfo.value));
const planApprovalContent = computed(() => {
    if (isPlanApproval.value) {
        return (metaInfo.value as any).plan || '';
    }
    return '';
});

function handleApprove() {
    emits('plan-approve', metaInfo.value);
}

function handleReject(feedback: string) {
    emits('plan-reject', feedback, metaInfo.value);
}

function handleReplan() {
    emits('plan-replan', metaInfo.value);
}

// 确认当前已经完成，如果没有完成，说明
const progress = ref(0);
const progressText = ref('OCR');
const finishProcess = ref(true);

if (ocr) {
    finishProcess.value = false;
    const bridge = useMessageBridge();
    const cancel = bridge.addCommandListener('ocr/worker/log', data => {
        finishProcess.value = false;
        const { id, progress: p = 1.0, status = 'finish' } = data;
        if (id === workerId) {
            progressText.value = status;
            progress.value = Math.min(Math.ceil(Math.max(p * 100, 0)), 100);
        }
    }, { once: false });

    bridge.addCommandListener('ocr/worker/done', data => {
        if (data.id !== workerId) {
            return;
        }

        progress.value = 1;
        finishProcess.value = true;

        if (props.item._meta) {
            const { _meta, ...rest } = props.item;
            emits('update:item', { ...rest });
        }

        emits('update:ocr-done');

        cancel();
    }, { once: true });
}


const thumbnail = ref('');

if (props.item.data) {
    getBlobUrlByFilename(props.item.data).then(url => {
        if (url) {
            thumbnail.value = url;
        }
    });
}

const showFullImage = () => {
    const img = new Image();
    img.src = thumbnail.value;
    img.onload = () => {
        const overlay = document?.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.onclick = () => document?.body.removeChild(overlay);

        const imgContainer = document?.createElement('div');
        imgContainer.style.maxWidth = '90vw';
        imgContainer.style.maxHeight = '90vh';
        imgContainer.style.overflow = 'auto';

        const fullImg = new Image();
        fullImg.src = thumbnail.value;
        fullImg.style.width = 'auto';
        fullImg.style.height = 'auto';
        fullImg.style.maxWidth = '100%';
        fullImg.style.maxHeight = '100%';

        imgContainer.appendChild(fullImg);
        overlay.appendChild(imgContainer);
        document?.body.appendChild(overlay);
    };
};

</script>

<style>
.tool-image {
    position: relative;
}

.tool-image .progress {
    margin-top: 10px;
}

.tool-image .media-item {
    position: relative;
    width: 100px;
    height: 100px;
    background-color: var(--el-input-bg-color, var(--el-fill-color-blank));
    border-radius: .5em;
    display: flex;
    justify-content: center;
    align-items: center;
}

.tool-image .media-item .iconfont {
    font-size: 40px;
}

.tool-image .media-item {
    object-fit: cover;
    overflow: hidden;
}

.tool-image .media-item>img {
    position: absolute;
    top: 50%;
    height: 100%;
    width: 100%;
    object-fit: cover;
    transform: translateY(-50%);
}

.tool-image .media-item .float-container {
    position: absolute;
    left: 0;
    top: 0;
    width: 100px;
    height: 100px;
    background-color: rgba(0, 0, 0, 0.6);
    opacity: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: var(--animation-3s);
}

.progress-label {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.percentage-label {
    max-width: 50px;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
}

.percentage-value {
    font-size: 14px;
    font-weight: bold;
}

.tool-image .media-item .float-container .iconfont {
    color: var(--background);
}

.tool-image .media-item:hover .float-container {
    opacity: 1;
}

.media-item {
    cursor: pointer;
}

.media-item:hover {
    opacity: 0.9;
}

/* 文本类型结果：以“打印”形式展示 value（JSON/代码块），便于调试 */
.tool-text--print {
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: 13px;
    line-height: 1.6;
}

.tool-text--print .tool-text-body {
    padding: 10px 12px;
    background: var(--sidebar-item-selected);
    border: 1px solid var(--sidebar-item-border);
    border-radius: 8px;
    overflow: auto;
}

/* 响应文本使用 JsonRender，与参数区一致，支持含 \n 等转义字符串的悬停高亮与点击展开 */
.tool-text-body--json :deep(.json-render) {
    border: none;
    border-radius: 0;
    background: transparent;
}
.tool-text-body--json :deep(.json-render .json-render-scrollbar) {
    max-height: 300px;
}
.tool-text-body--json :deep(.json-render .json-render-body) {
    padding: 0;
}

.tool-text--print .tool-text-body :deep(pre) {
    margin: 0;
    padding: 0;
    background: transparent !important;
}

.tool-text--print .tool-text-body :deep(code) {
    font-family: inherit;
    font-size: inherit;
    white-space: pre;
    display: block;
}

/* 其他类型结果 - 开发者可读的 JSON 展示 */
.tool-other {
    font-family: var(--font-monospace-family, var(--code-font-family, monospace));
    font-size: var(--chat-font-size);
    line-height: 1.5;
}

.tool-other-json {
    margin: 0;
    padding: 8px 10px;
    white-space: pre;
    display: inline-block;
    min-width: 100%;
    background: var(--el-input-bg-color, var(--el-fill-color-blank));
    border: 1px solid var(--sidebar-item-border);
    border-radius: 8px;
}
</style>