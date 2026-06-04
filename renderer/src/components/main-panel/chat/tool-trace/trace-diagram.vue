<template>
    <div class="trace-diagram-container">
        <div ref="svgContainer" class="diagram-container"></div>
        
        <!-- 节点详情弹窗 -->
        <el-dialog 
            v-model="nodeDetailVisible" 
            :title="selectedNodeData?.name || t('tool-details')" 
            width="600px"
            :before-close="handleDialogClose"
        >
            <div v-if="selectedNodeData">
                <el-descriptions :column="1" border>
                    <el-descriptions-item v-if="selectedNodeData.type" :label="t('type')">{{ selectedNodeData.type }}</el-descriptions-item>
                    <el-descriptions-item v-if="selectedNodeData.content" :label="t('content')">
                        <pre class="content-pre">{{ selectedNodeData.content }}</pre>
                    </el-descriptions-item>
                    <el-descriptions-item v-if="selectedNodeData.duration" :label="t('duration-ms')">{{ selectedNodeData.duration }}</el-descriptions-item>
                    <el-descriptions-item v-if="selectedNodeData.tokens" :label="t('total-token')">{{ selectedNodeData.tokens }}</el-descriptions-item>
                    <el-descriptions-item v-if="selectedNodeData.cacheHitRate" :label="t('cache-hit-ratio')">{{ selectedNodeData.cacheHitRate }}</el-descriptions-item>
                    <el-descriptions-item :label="t('status')">
                        <el-tag :type="getNodeStatusType(selectedNodeData.status)">
                            {{ selectedNodeData.status }}
                        </el-tag>
                    </el-descriptions-item>
                </el-descriptions>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="nodeDetailVisible = false">{{ t('close') }}</el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, reactive, watch } from 'vue';
import * as d3 from 'd3';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { IRenderMessage } from '../chat-box/chat';
import { useI18n } from 'vue-i18n';

// 全局常量定义
const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;
const NODE_RADIUS = 16;
const WRAPPER_PADDING = 20;
const TOOL_NODE_WIDTH = 160;
const TOOL_NODE_HEIGHT = 60;
const TOOL_NODE_RADIUS = 12;
const STATUS_CIRCLE_RADIUS = 6;
const STATUS_CIRCLE_X = NODE_WIDTH / 2 - 32;
const STATUS_CIRCLE_Y = NODE_HEIGHT - 16;
const STATUS_TEXT_X = NODE_WIDTH / 2 - 16;
const STATUS_TEXT_Y = NODE_HEIGHT - 12;
const LABEL_Y = 20;
const DURATION_X = NODE_WIDTH - 10; // 耗时显示在右侧
const DURATION_Y = NODE_HEIGHT - 12; // 耗时与状态在同一行（底部）

const { t } = useI18n();

const props = defineProps<{
    renderMessages: IRenderMessage[];
}>();

const svgContainer = ref<HTMLDivElement | null>(null);
let prevNodes: any[] = [];
let prevEdges: any[] = [];

// 节点数据映射
const nodeDataMap = new Map<string, any>();

const state = reactive({
    nodes: [] as any[],
    edges: [] as any[],
});

// 节点详情弹窗相关
const nodeDetailVisible = ref(false);
const selectedNodeData = ref<any>(null);

const handleDialogClose = () => {
    nodeDetailVisible.value = false;
    selectedNodeData.value = null;
};

// 根据状态获取标签类型
function getNodeStatusType(status: string | undefined) {
    switch (status) {
        case 'success':
            return 'success';
        case 'error':
        case 'failed':
            return 'danger';
        case 'running':
            return 'warning';
        default:
            return 'info';
    }
}

// 处理消息数据，生成节点和边
function processMessages() {
    const nodes: any[] = [];
    const edges: any[] = [];
    nodeDataMap.clear();
    
    let nodeIndex = 0;

    // 为每个消息创建节点
    props.renderMessages.forEach((message, messageIndex) => {
        const prevNodeIndex = nodeIndex - 1;
        
        if (message.role === 'user') {
            const nodeId = `node-${nodeIndex}`;
            nodes.push({
                id: nodeId,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                labels: [{ text: t('user-input') }]
            });

            // 保存节点详细信息
            nodeDataMap.set(nodeId, {
                id: nodeId,
                name: t('user-input'),
                type: t('user-input'),
                content: message.content,
                status: message.extraInfo.state === 'success' ? 'success' : message.extraInfo.state || 'default'
            });
            
            // 创建与前一个节点的边
            if (prevNodeIndex >= 0) {
                edges.push({
                    id: `edge-${prevNodeIndex}-${nodeIndex}`,
                    sources: [`node-${prevNodeIndex}`],
                    targets: [nodeId]
                });
            }
            
            nodeIndex++;
        } else if (message.role === 'assistant/content') {
            const nodeId = `node-${nodeIndex}`;
            // 计算耗时（当前节点与上一个节点的时间差）
            let duration = '';
            if (messageIndex > 0 && props.renderMessages[messageIndex - 1].extraInfo?.created && message.extraInfo?.created) {
                const prevMessage = props.renderMessages[messageIndex - 1];
                duration = (message.extraInfo.created - prevMessage.extraInfo.created) + ' ms';
            }
            
            // Token信息
            let tokens = '';
            let cacheHitRate = '';
            const usage = message.extraInfo.usage;
            if (usage) {
                tokens = `Input: ${usage.prompt_tokens || 0}, Output: ${usage.completion_tokens || 0}, Total: ${usage.total_tokens || 0}`;
                const cacheHitTokens = usage.prompt_tokens_details?.cached_tokens || 0;
                const inputTokens = usage.prompt_tokens || 0;
                if (inputTokens > 0) {
                    cacheHitRate = Math.round((cacheHitTokens / inputTokens) * 100) + '%';
                }
            }
            
            nodes.push({
                id: nodeId,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                labels: [{ text: t('assistant-output') }],
                duration // 添加耗时信息
            });

            // 保存节点详细信息
            nodeDataMap.set(nodeId, {
                id: nodeId,
                name: 'Assistant Message',
                type: 'Assistant Output',
                content: message.content,
                duration,
                tokens,
                cacheHitRate,
                status: message.extraInfo.state === 'success' ? 'success' : message.extraInfo.state || 'default'
            });
            
            // 创建与前一个节点的边
            if (prevNodeIndex >= 0) {
                edges.push({
                    id: `edge-${prevNodeIndex}-${nodeIndex}`,
                    sources: [`node-${prevNodeIndex}`],
                    targets: [nodeId]
                });
            }
            
            nodeIndex++;
        } else if (message.role === 'assistant/tool_calls' && 'tool_calls' in message) {
            const toolCalls = message.tool_calls || [];
            const nodeId = `node-${nodeIndex}`;
            
            // 计算耗时（仅在工具节点上显示）
            let duration = '';
            if (messageIndex > 0 && props.renderMessages[messageIndex - 1].extraInfo?.created && message.extraInfo?.created) {
                const prevMessage = props.renderMessages[messageIndex - 1];
                duration = (message.extraInfo.created - prevMessage.extraInfo.created) + ' ms';
            }
            
            // Token信息
            let tokens = '';
            let cacheHitRate = '';
            const usage = message.extraInfo.usage;
            if (usage) {
                tokens = `Input: ${usage.prompt_tokens || 0}, Output: ${usage.completion_tokens || 0}, Total: ${usage.total_tokens || 0}`;
                const cacheHitTokens = usage.prompt_tokens_details?.cached_tokens || 0;
                const inputTokens = usage.prompt_tokens || 0;
                if (inputTokens > 0) {
                    cacheHitRate = Math.round((cacheHitTokens / inputTokens) * 100) + '%';
                }
            }
            
            // 如果有多个工具调用，创建包装节点
            if (toolCalls.length > 1) {
                // 创建包装节点
                const wrapperWidth = toolCalls.length * (TOOL_NODE_WIDTH + 10) + WRAPPER_PADDING * 2;
                const wrapperHeight = TOOL_NODE_HEIGHT + WRAPPER_PADDING * 2;
                
                nodes.push({
                    id: nodeId,
                    width: wrapperWidth,
                    height: wrapperHeight,
                    labels: [{ text: `${t("tool-call")} (${toolCalls.length})` }],
                    isWrapper: true,
                    toolCalls: toolCalls,
                    duration // 只在包装节点上添加耗时
                });
                
                // 为每个工具调用创建子节点
                toolCalls.forEach((toolCall: any, toolIndex: number) => {
                    const toolNodeId = `${nodeId}-tool-${toolIndex}`;
                    nodes.push({
                        id: toolNodeId,
                        width: TOOL_NODE_WIDTH,
                        height: TOOL_NODE_HEIGHT,
                        labels: [{ text: toolCall.function?.name || 'Tool Call' }],
                        parentId: nodeId,
                        isToolNode: true
                    });
                    
                    // 保存工具节点详细信息
                    nodeDataMap.set(toolNodeId, {
                        id: toolNodeId,
                        name: toolCall.function?.name || 'Tool Call',
                        type: 'Tool Call',
                        content: toolCall.function?.arguments,
                        status: message.extraInfo.state === 'success' ? 'success' : message.extraInfo.state || 'default'
                    });
                });
            } else if (toolCalls.length === 1) {
                // 单个工具调用，直接创建普通节点
                nodes.push({
                    id: nodeId,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                    labels: [{ text: toolCalls[0].function?.name || 'Tool Call' }],
                    duration // 添加耗时信息
                });
            }

            // 保存节点详细信息
            nodeDataMap.set(nodeId, {
                id: nodeId,
                name: toolCalls.length > 1 ? `${t("tool-call")} (${toolCalls.length})` : (toolCalls[0]?.function?.name || t("tool-call")),
                type: 'Tool Call',
                content: toolCalls.length > 1 ? toolCalls.map((tc: any) => tc.function?.name).join(', ') : toolCalls[0]?.function?.arguments,
                duration,
                tokens,
                cacheHitRate,
                status: message.extraInfo.state === 'success' ? 'success' : message.extraInfo.state || 'default',
                toolCalls: toolCalls.length > 1 ? toolCalls : undefined
            });
            
            // 创建与前一个节点的边
            if (prevNodeIndex >= 0) {
                edges.push({
                    id: `edge-${prevNodeIndex}-${nodeIndex}`,
                    sources: [`node-${prevNodeIndex}`],
                    targets: [nodeId]
                });
            }
            
            nodeIndex++;
        }
    });

    state.nodes = nodes;
    state.edges = edges;
}

const recomputeLayout = async () => {
    const elk = new ELK();
    const elkGraph = {
        id: 'root',
        layoutOptions: {
            'elk.direction': 'DOWN',
            'elk.spacing.nodeNode': '40',
            'elk.layered.spacing.nodeNodeBetweenLayers': '40'
        },
        children: state.nodes.filter(n => !n.parentId), // 只包含非子节点
        edges: state.edges
    };
    const layout = await elk.layout(elkGraph) as unknown as any;

    state.nodes.filter(n => !n.parentId).forEach((n, i) => {
        const ln = layout.children?.find((c: any) => c.id === n.id);
        if (ln) {
            n.x = ln.x;
            n.y = ln.y;
            n.width = ln.width || (n.isWrapper ? 300 : NODE_WIDTH);
            n.height = ln.height || (n.isWrapper ? 100 : NODE_HEIGHT);
        }
    });
    state.edges = layout.edges || [];

    return layout;
};

function renderSvg() {
    const prevNodeMap = new Map(prevNodes.map(n => [n.id, n]));
    const prevEdgeMap = new Map(prevEdges.map(e => [e.id, e]));

    // 计算所有节点的最小x和最大x
    const xs = state.nodes.filter(n => !n.parentId).map(n => (n.x || 0));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs.map((x, i) => x + (state.nodes.filter(n => !n.parentId)[i]?.width || NODE_WIDTH)));
    const contentWidth = maxX - minX;
    const svgWidth = Math.max(contentWidth + 120, 600); // 最小宽度600px
    const offsetX = (svgWidth - contentWidth) / 2 - minX;

    const height = Math.max(...state.nodes.filter(n => !n.parentId).map(n => (n.y || 0) + (n.height || NODE_HEIGHT)), 400) + 60;

    // 不再全量清空，只清空 svg 元素
    let svg = d3.select(svgContainer.value).select('svg');
    if (svg.empty()) {
        svg = d3
            .select(svgContainer.value)
            .append('svg')
            .attr('width', '100%')
            .attr('height', height)
            .attr('viewBox', `0 0 ${svgWidth} ${height}`)
            .style('user-select', 'none') as any;
    } else {
        svg.attr('width', '100%')
           .attr('height', height)
           .attr('viewBox', `0 0 ${svgWidth} ${height}`);
        svg.selectAll('defs').remove();
    }

    // Arrow marker
    svg
        .append('defs')
        .append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 0 8 8')
        .attr('refX', 6)
        .attr('refY', 4)
        .attr('markerWidth', 5)
        .attr('markerHeight', 5)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M 0 0 L 8 4 L 0 8 z')
        .attr('fill', 'var(--main-color)');

    // 1. 创建/获取 main group
    let mainGroup = svg.select('g.main-group');
    if (mainGroup.empty()) {
        mainGroup = svg.append('g').attr('class', 'main-group') as any;
    }
    mainGroup
        .attr('transform', `translate(${offsetX}, 0)`);

    // Draw edges
    const allSections: { id: string, section: any }[] = [];
    (state.edges || []).forEach(edge => {
        const sections = edge.sections || [];
        sections.forEach((section: any, idx: number) => {
            allSections.push({
                id: (edge.id || '') + '-' + (section.id || idx),
                section
            });
        });
    });

    const edgeSelection = mainGroup.selectAll<SVGLineElement, any>('.edge')
        .data(allSections, d => d.id);

    edgeSelection.exit().remove();

    const edgeEnter = edgeSelection.enter()
        .append('line')
        .attr('class', 'edge')
        .attr('x1', d => {
            const prev = prevEdgeMap.get(d.id);
            return prev && prev.sections && prev.sections[0]
                ? prev.sections[0].startPoint.x
                : d.section.startPoint.x;
        })
        .attr('y1', d => {
            const prev = prevEdgeMap.get(d.id);
            return prev && prev.sections && prev.sections[0]
                ? prev.sections[0].startPoint.y
                : d.section.startPoint.y;
        })
        .attr('x2', d => {
            const prev = prevEdgeMap.get(d.id);
            return prev && prev.sections && prev.sections[0]
                ? prev.sections[0].endPoint.x
                : d.section.endPoint.x;
        })
        .attr('y2', d => {
            const prev = prevEdgeMap.get(d.id);
            return prev && prev.sections && prev.sections[0]
                ? prev.sections[0].endPoint.y
                : d.section.endPoint.y;
        })
        .attr('stroke', 'var(--main-color)')
        .attr('stroke-width', 2.5)
        .attr('marker-end', 'url(#arrow)');

    edgeEnter
        .transition()
        .duration(600)
        .attr('x1', d => d.section.startPoint.x)
        .attr('y1', d => d.section.startPoint.y)
        .attr('x2', d => d.section.endPoint.x)
        .attr('y2', d => d.section.endPoint.y);

    // update
    edgeSelection.merge(edgeEnter)
        .transition()
        .duration(600)
        .ease(d3.easeCubicInOut)
        .attr('x1', d => d.section.startPoint.x)
        .attr('y1', d => d.section.startPoint.y)
        .attr('x2', d => d.section.endPoint.x)
        .attr('y2', d => d.section.endPoint.y);

    // --- 节点 ---
    const nodeGroup = mainGroup.selectAll<SVGGElement, any>('.node')
        .data(state.nodes.filter(n => !n.parentId), d => d.id); // 只选择非子节点

    nodeGroup.exit().remove();

    // 节点 enter
    const nodeGroupEnter = nodeGroup.enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => {
            const prev = prevNodeMap.get(d.id);
            if (prev) {
                return `translate(${prev.x || 0}, ${prev.y || 0})`;
            }
            return `translate(${d.x || 0}, ${d.y || 0})`;
        })
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
            // 显示节点详情弹窗
            const nodeData = nodeDataMap.get(d.id);
            if (nodeData) {
                selectedNodeData.value = nodeData;
                nodeDetailVisible.value = true;
            }
        });

    // 添加包装节点的矩形（仅对包装节点）
    nodeGroupEnter.filter((d: any) => d.isWrapper)
        .append('rect')
        .attr('width', (d: any) => d.width)
        .attr('height', (d: any) => d.height)
        .attr('rx', NODE_RADIUS)
        .attr('fill', 'none')
        .attr('stroke', 'var(--main-color)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

    // 添加普通节点的矩形
    nodeGroupEnter.filter((d: any) => !d.isWrapper)
        .append('rect')
        .attr('width', (d: any) => d.width)
        .attr('height', (d: any) => d.height)
        .attr('rx', NODE_RADIUS)
        .attr('fill', 'var(--main-light-color-20)')
        .attr('stroke', 'var(--main-light-color-10)')
        .attr('stroke-width', 1);

    // 节点文字
    nodeGroupEnter.append('text')
        .attr('x', d => d.width / 2)
        .attr('y', LABEL_Y)
        .attr('text-anchor', 'middle')
        .attr('font-size', 14)
        .attr('fill', 'var(--main-color)')
        .attr('font-weight', 600)
        .text(d => d.labels?.[0]?.text || 'Node');

    // 耗时显示（User Message 不显示）
    nodeGroupEnter.append('text')
        .attr('class', 'node-duration')
        .attr('x', DURATION_X)
        .attr('y', DURATION_Y)
        .attr('text-anchor', 'end')
        .attr('font-size', 12)
        .attr('fill', '#666')
        .text(d => {
            // user-input 不显示耗时
            if (d.labels?.[0]?.text === 'user-input' || d.isWrapper) {
                return '';
            }            
            
            const nodeData = nodeDataMap.get(d.id);
            return nodeData?.duration || '';
        });

    nodeGroupEnter.append('g').attr('class', 'node-status');

    // 合并 enter+update
    const nodeStatusGroup = nodeGroup.merge(nodeGroupEnter).select('.node-status');

    // 先清空再重绘
    // 绘制状态和耗时
    nodeStatusGroup.each(function (d) {
        const g = d3.select(this);
        g.selectAll('*').remove(); // 清空旧内容

        const nodeData = nodeDataMap.get(d.id);
        
        if (nodeData.toolCalls?.length > 1) {
            return;
        }
        

        const status = nodeData?.status || 'default';
        if (status === 'running') {
            g.append('circle')
                .attr('cx', STATUS_CIRCLE_X)
                .attr('cy', STATUS_CIRCLE_Y)
                .attr('r', STATUS_CIRCLE_RADIUS)
                .attr('fill', 'none')
                .attr('stroke', 'var(--main-color)')
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', 20)
                .attr('stroke-dashoffset', 0)
                .append('animateTransform')
                .attr('attributeName', 'transform')
                .attr('attributeType', 'XML')
                .attr('type', 'rotate')
                .attr('from', `0 ${STATUS_CIRCLE_X} ${STATUS_CIRCLE_Y}`)
                .attr('to', `360 ${STATUS_CIRCLE_X} ${STATUS_CIRCLE_Y}`)
                .attr('dur', '1s')
                .attr('repeatCount', 'indefinite');
            g.append('text')
                .attr('x', STATUS_TEXT_X)
                .attr('y', STATUS_TEXT_Y)
                .attr('font-size', 13)
                .attr('fill', 'var(--main-color)')
                .text('running');
        } else if (status === 'default' || status === 'waiting') {
            g.append('circle')
                .attr('cx', STATUS_CIRCLE_X)
                .attr('cy', STATUS_CIRCLE_Y)
                .attr('r', STATUS_CIRCLE_RADIUS)
                .attr('fill', 'none')
                .attr('stroke', '#bdbdbd')
                .attr('stroke-width', 3);
            g.append('text')
                .attr('x', STATUS_TEXT_X)
                .attr('y', STATUS_TEXT_Y)
                .attr('font-size', 13)
                .attr('fill', '#bdbdbd')
                .text('waiting');
        } else if (status === 'success') {
            g.append('circle')
                .attr('cx', STATUS_CIRCLE_X)
                .attr('cy', STATUS_CIRCLE_Y)
                .attr('r', STATUS_CIRCLE_RADIUS)
                .attr('fill', 'none')
                .attr('stroke', '#4caf50')
                .attr('stroke-width', 3);
            g.append('text')
                .attr('x', STATUS_TEXT_X)
                .attr('y', STATUS_TEXT_Y)
                .attr('font-size', 13)
                .attr('fill', '#4caf50')
                .text('success');
        } else if (status === 'error' || status === 'failed') {
            g.append('circle')
                .attr('cx', STATUS_CIRCLE_X)
                .attr('cy', STATUS_CIRCLE_Y)
                .attr('r', STATUS_CIRCLE_RADIUS)
                .attr('fill', 'none')
                .attr('stroke', '#f44336')
                .attr('stroke-width', 3);
            g.append('text')
                .attr('x', STATUS_TEXT_X)
                .attr('y', STATUS_TEXT_Y)
                .attr('font-size', 13)
                .attr('fill', '#f44336')
                .text('error');
        }
    });

    // 节点 enter 动画
    nodeGroupEnter
        .transition()
        .duration(600)
        .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);

    // 节点 update 动画
    nodeGroup
        .transition()
        .duration(600)
        .ease(d3.easeCubicInOut)
        .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);

    // 更新耗时文本
    nodeGroup.select('.node-duration')
        .text(d => {
            // user-input 不显示耗时            
            if (d.labels?.[0]?.text === 'user-input') {
                return '';
            }
            const nodeData = nodeDataMap.get(d.id);
            return nodeData?.duration || '';
        });

    // --- 工具节点（子节点）---
    const toolNodeGroup = mainGroup.selectAll<SVGGElement, any>('.tool-node')
        .data(state.nodes.filter(n => n.isToolNode), d => d.id);

    toolNodeGroup.exit().remove();

    const toolNodeGroupEnter = toolNodeGroup.enter()
        .append('g')
        .attr('class', 'tool-node')
        .attr('transform', d => {
            // 找到父节点的位置
            const parentNode = state.nodes.find(n => n.id === d.parentId);
            if (parentNode) {
                // 计算在包装节点中的位置
                // 修复重叠问题：使用索引而不是根据名称查找
                const toolIndex = state.nodes
                    .filter(n => n.parentId === d.parentId)
                    .findIndex(n => n.id === d.id);
                const x = (parentNode.x || 0) + WRAPPER_PADDING + toolIndex * (TOOL_NODE_WIDTH + 10);
                const y = (parentNode.y || 0) + WRAPPER_PADDING;
                return `translate(${x}, ${y})`;
            }
            return 'translate(0, 0)';
        })
        .style('cursor', 'pointer')
        .on('click', function (event, d) {
            // 显示节点详情弹窗
            const nodeData = nodeDataMap.get(d.id);
            if (nodeData) {
                selectedNodeData.value = nodeData;
                nodeDetailVisible.value = true;
            }
        });

    // 工具节点矩形
    toolNodeGroupEnter.append('rect')
        .attr('width', TOOL_NODE_WIDTH)
        .attr('height', TOOL_NODE_HEIGHT)
        .attr('rx', TOOL_NODE_RADIUS)
        .attr('fill', 'var(--main-light-color-20)')
        .attr('stroke', 'var(--main-light-color-10)')
        .attr('stroke-width', 1);

    // 工具节点文字
    toolNodeGroupEnter.append('text')
        .attr('x', TOOL_NODE_WIDTH / 2)
        .attr('y', TOOL_NODE_HEIGHT / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 12)
        .attr('fill', 'var(--main-color)')
        .text(d => d.labels?.[0]?.text || 'Tool');

    // 合并工具节点
    const allToolNodes = toolNodeGroup.merge(toolNodeGroupEnter);

    // 更新工具节点位置
    allToolNodes.attr('transform', d => {
        // 找到父节点的位置
        const parentNode = state.nodes.find(n => n.id === d.parentId);
        if (parentNode) {
            // 计算在包装节点中的位置
            // 修复重叠问题：使用索引而不是根据名称查找
            const toolIndex = state.nodes
                .filter(n => n.parentId === d.parentId)
                .findIndex(n => n.id === d.id);
            const x = (parentNode.x || 0) + WRAPPER_PADDING + toolIndex * (TOOL_NODE_WIDTH + 10);
            const y = (parentNode.y || 0) + WRAPPER_PADDING;
            return `translate(${x}, ${y})`;
        }
        return 'translate(0, 0)';
    });

    // 渲染结束后保存当前快照
    prevNodes = state.nodes.map(n => ({ ...n }));
    prevEdges = (state.edges || []).map(e => ({ ...e, sections: e.sections ? e.sections.map((s: any) => ({ ...s })) : [] }));
}

// 绘制流程图
async function drawDiagram() {
    // 处理消息数据
    processMessages();
    
    // 重新计算布局
    await recomputeLayout();

    // 绘制 svg
    renderSvg();
}

// 监听 renderMessages 变化
watch(() => props.renderMessages, () => {
    nextTick(drawDiagram);
}, { deep: true });

onMounted(() => {
    nextTick(drawDiagram);
});
</script>

<style scoped>
.trace-diagram-container {
    position: relative;
    width: 100%;
    height: 100%;
}

.diagram-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    border-radius: 8px;
    padding: 24px 0;
    overflow: auto;
}

.content-pre {
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
    padding: 8px;
    max-height: 200px;
    overflow-y: auto;
}

.dialog-footer {
    text-align: right;
}
</style>