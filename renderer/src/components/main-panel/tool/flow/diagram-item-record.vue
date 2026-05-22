<template>
    <div class="diagram-item-record" v-if="props.dataView && props.dataView.tool">        
        <div class="item-header">
            <span class="item-title">{{ props.dataView.tool.name }}</span>
        </div>        

        <div class="item-desc">{{ props.dataView.tool.description }}</div>


        <div v-if="props.dataView.function !== undefined" class="item-result">
            <span class="item-label">Arguments</span>
            <div class="code-container">
                <json-render :json="props.dataView.function.arguments" />
            </div>
        </div>

        <div v-if="props.dataView.result !== undefined" class="item-result">
            <span class="item-label">Result</span>
            <template v-if="Array.isArray(props.dataView.result)">
                <div v-for="(item, idx) in props.dataView.result" :key="idx" class="result-block"
                    :class="[props.dataView.status]">
                    <pre class="item-json"
                        v-if="typeof item === 'object' && item.text !== undefined">{{ item.text }}</pre>
                    <pre class="item-json" v-else>{{ formatJson(item) }}</pre>
                </div>
            </template>
            <pre class="item-json"
                v-else-if="typeof props.dataView.result === 'string'">{{ props.dataView.result }}</pre>
            <pre class="item-json" v-else>{{ formatJson(props.dataView.result) }}</pre>
        </div>

        <br>

        <div class="item-meta">
            <span v-if="props.dataView.createAt" class="item-meta-label">
                Created: <b>{{ formatTime(props.dataView.createAt) }}</b>
            </span>
            <!-- <span v-if="props.dataView.finishAt" class="item-meta-label">
                Finished: <b>{{ formatTime(props.dataView.finishAt) }}</b>
            </span> -->
            <!--  -->
        </div>

        <div class="item-timecost" v-if="props.dataView.llmTimecost !== undefined || props.dataView.toolcallTimecost !== undefined">
            <template v-if="props.dataView.llmTimecost !== undefined && props.dataView.toolcallTimecost !== undefined">
                <div class="timecost-bar">
                    <div
                        class="timecost-segment llm"
                        :style="{ width: llmPercent + '%' }"
                        :title="`LLM: ${props.dataView.llmTimecost}ms`"
                    ></div>
                    <div
                        class="timecost-segment toolcall"
                        :style="{ width: toolcallPercent + '%' }"
                        :title="`ToolCall: ${props.dataView.toolcallTimecost}ms`"
                    ></div>
                </div>
                <div class="timecost-labels">
                    <span class="llm-label">LLM: <b>{{ props.dataView.llmTimecost }}ms</b> ({{ llmPercent }}%)</span>
                    <span class="toolcall-label">ToolCall: <b>{{ props.dataView.toolcallTimecost }}ms</b> ({{ toolcallPercent }}%)</span>
                </div>
            </template>
            <template v-else-if="props.dataView.llmTimecost !== undefined">
                <div class="timecost-labels">
                    <span class="llm-label">LLM: <b>{{ props.dataView.llmTimecost }}ms</b></span>
                </div>
            </template>
            <template v-else>
                <div class="timecost-labels">
                    <span class="toolcall-label">ToolCall: <b>{{ props.dataView.toolcallTimecost }}ms</b></span>
                </div>
            </template>
        </div>
    </div>
    <div v-else class="diagram-item-record">
        <div class="item-header">
            <span class="item-title">No Tool Selected</span>
        </div>
        <div class="item-desc">Please select a tool to view its details.</div>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import type { NodeDataView } from './diagram';

import JsonRender from '@/components/json-render/index.vue';
import { computed } from 'vue';

const props = defineProps({
    dataView: {
        type: Object as PropType<NodeDataView | undefined | null>,
        required: true
    }
})

function formatJson(obj: any) {
    try {
        return JSON.stringify(obj, null, 2)
    } catch {
        return String(obj)
    }
}

// 优雅格式化时间
function formatTime(val: string | number | Date) {
    if (!val) return '-';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString();
}

const llmPercent = computed(() => {
    const l = props.dataView!.llmTimecost ?? 0;
    const t = props.dataView!.toolcallTimecost ?? 0;
    const sum = l + t;
    return sum > 0 ? Math.round((l / sum) * 100) : 0;
});
const toolcallPercent = computed(() => {
    const l = props.dataView!.llmTimecost ?? 0;
    const t = props.dataView!.toolcallTimecost ?? 0;
    const sum = l + t;
    return sum > 0 ? Math.round((t / sum) * 100) : 0;
});
</script>

<style scoped>
.diagram-item-record {
    padding: 14px 18px;
    border-radius: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    font-size: 15px;
    max-width: 1000px;
    word-break: break-all;
}

.item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
}

.item-title {
    font-weight: bold;
    font-size: 17px;
    color: var(--main-color, #409EFF);
}

.item-status {
    font-size: 15px;
    padding: 5px 0;
    border-radius: 12px;
    text-transform: capitalize;
}

.item-desc {
    margin-bottom: 15px;
    opacity: 0.8;
    font-size: 14px;
}

.item-meta {
    margin-bottom: 8px;
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #888;
    flex-wrap: wrap;
}
.item-meta-label b {
    color: var(--main-color, #409EFF);
    font-weight: 500;
}

.item-label {
    font-weight: 500;
    margin-right: 4px;
    color: var(--main-color, #409EFF);
}

.item-json {
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 13px;
    font-family: var(--code-font-family, monospace);
    margin: 2px 0 8px 0;
    white-space: pre-wrap;
    word-break: break-all;
    overflow-x: auto;
    max-width: 100%;
    box-sizing: border-box;
}

.code-container {
    font-size: 13px;
    margin-top: 10px;
    border-radius: .3em;
    padding: 0 10px;
    background-color: var(--sidebar);
}

.item-result {
    margin-top: 6px;
    margin-bottom: 15px;
}

.result-block {
    margin-bottom: 6px;
    border-radius: .5em;
    margin: 5px 0;
    overflow-x: auto;
    max-width: 100%;
}

.result-block.error {
    background-color: rgba(245, 108, 108, 0.5);
}

.result-block.success {
    background-color: rgba(67, 160, 71, 0.5);
}

.item-timecost {
    margin-bottom: 10px;
    margin-top: 2px;
    font-size: 14px;
    color: #333;
}

.timecost-bar {
    display: flex;
    height: 12px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--main-light-color-20, rgba(99, 102, 241, 0.2));
    margin-bottom: 4px;
    box-shadow: 0 1px 2px rgba(99, 102, 241, 0.08);
}

.timecost-segment {
    height: 100%;
    transition: width 0.3s;
}

.llm {
    background: var(--main-color, #6366f1);
}

.toolcall {
    background: #A1A7F6;
}

.timecost-labels {
    display: flex;
    gap: 18px;
    font-size: 12px;
    color: #888;
}

.llm-label b {
    color: var(--main-color, #6366f1);
}

.toolcall-label b {
    color: #A1A7F6;
}
</style>