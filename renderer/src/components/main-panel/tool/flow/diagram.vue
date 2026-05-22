<template>
    <div style="display: flex; align-items: flex-start; gap: 32px;">
        <div ref="svgContainer" class="diagram-container"></div>
        <div class="diagram-info-panel">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div v-if="infoNodeId && state.dataView.get(infoNodeId)" class="item-status" :class="state.dataView.get(infoNodeId)?.status || 'waiting'">
                    {{ state.dataView.get(infoNodeId)?.status || 'waiting' }}
                </div>
                <div v-else>
                    {{ "Unknown Status" }}
                </div>
                <el-button
                    circle
                    :type="state.pinnedNodeId ? 'primary' : 'default'"
                    @click="togglePin"
                    style="margin-bottom: 4px;"
                    :disabled="!infoNodeId"
                >
                    <span class="iconfont icon-pin"></span>
                </el-button>
            </div>
            <template v-if="infoNodeId && state.dataView.get(infoNodeId)">
                <el-scrollbar height="500px" width="300px">
                    <DiagramItemRecord :data-view="state.dataView.get(infoNodeId)" />
                </el-scrollbar>
            </template>
            <template v-else>
                <div class="diagram-info-empty">
                    <div style="color: #bbb; font-size: 15px;">
                        {{ t('diagram-node-empty') }}
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, reactive, inject, computed } from 'vue';
import * as d3 from 'd3';
import ELK from 'elkjs/lib/elk.bundled.js';
import { mcpClientAdapter } from '@/views/connect/core';
import { invalidConnectionDetector, type Edge, type Node, type NodeDataView } from './diagram';
import { ElMessage } from 'element-plus';


import DiagramItemRecord from './diagram-item-record.vue';
import { useI18n } from 'vue-i18n';
import type { ToolStorage } from '../tools';
import { tabs } from '../../panel';

const { t } = useI18n();

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});

const svgContainer = ref<HTMLDivElement | null>(null);
let prevNodes: any[] = [];
let prevEdges: any[] = [];

const state = reactive({
    nodes: [] as Node[],
    edges: [] as Edge[],
    selectedNodeId: null as string | null,
    draggingNodeId: null as string | null,
    hoverNodeId: null as string | null,
    pinnedNodeId: null as string | null, // 新增
    offset: { x: 0, y: 0 },
    dataView: new Map<string, NodeDataView>
});

const tab = tabs.content[props.tabId];
const tabStorage = tab.storage as ToolStorage;
const autoDetectDiagram = tabStorage.autoDetectDiagram;

if (autoDetectDiagram) {
    // 将 tabStorage.autoDetectDiagram 中的 dataView 保存到 state 中
    autoDetectDiagram.views?.forEach(item => {
        state.dataView.set(item.tool.name, {
            tool: item.tool,
            function: item.function, 
            status: item.status || 'waiting',
            result: item.result || null,
            createAt: item.createAt,
            finishAt: item.finishAt,
            llmTimecost: item.llmTimecost,
            toolcallTimecost: item.toolcallTimecost
        });
    });
} else {
    tabStorage.autoDetectDiagram = {
        edges: [],
        views: []
    };
}


let cancelHoverHandler: NodeJS.Timeout | undefined = undefined;

const setHoverItem = (id: string) => {
    if (state.pinnedNodeId) return; // 如果已pin，不响应hover
    if (cancelHoverHandler) {
        clearTimeout(cancelHoverHandler);
    }
    state.hoverNodeId = id;
};

const clearHoverItem = () => {
    if (state.pinnedNodeId) return; // 如果已pin，不响应hover
    cancelHoverHandler = setTimeout(() => {
        if (cancelHoverHandler) {
            clearTimeout(cancelHoverHandler);
        }
        if (state.hoverNodeId) {
            state.hoverNodeId = null;
        }
    }, 300);
};

// pin 按钮点击事件
function togglePin() {
    if (state.pinnedNodeId) {
        state.pinnedNodeId = null;
    } else if (state.hoverNodeId) {
        state.pinnedNodeId = state.hoverNodeId;
    }
}

// 让面板内容始终显示 pinnedNodeId 优先
const infoNodeId = computed(() => state.pinnedNodeId || state.hoverNodeId);


const getAllTools = async () => {
    const items = [];
    for (const client of mcpClientAdapter.clients) {
        const clientTools = await client.getTools();
        items.push(...clientTools.values());
    }
    return items;
};

const recomputeLayout = async () => {
    const elk = new ELK();
    const elkGraph = {
        id: 'root',
        layoutOptions: {
            'elk.direction': 'DOWN',
            'elk.spacing.nodeNode': '40',
            'elk.layered.spacing.nodeNodeBetweenLayers': '40'
        },
        children: state.nodes,
        edges: state.edges
    };
    const layout = await elk.layout(elkGraph) as unknown as Node;

    state.nodes.forEach((n, i) => {
        const ln = layout.children?.find(c => c.id === n.id);
        if (ln) {
            n.x = ln.x;
            n.y = ln.y;
            n.width = ln.width || 200; // 默认宽度
            n.height = ln.height || 64; // 默认高度
        }
    });
    state.edges = layout.edges || [];

    // 保存拓扑信息到 tabStorage
    tabStorage.autoDetectDiagram!.edges = state.edges.map(edge => ({
        id: edge.id,
        sources: edge.sources || [],
        targets: edge.targets || []
    }));

    return layout;
};

const drawDiagram = async () => {
    const tools = await getAllTools();

    // 默认按照链表进行串联
    const nodes = [] as Node[];
    const edges = [] as Edge[];

    // 如果保存了 edges 信息，则需要进行同步
    const reservedEdges = autoDetectDiagram?.edges;
    if (reservedEdges) {
        for (const edge of reservedEdges) {
            if (edge.sources && edge.targets && edge.sources.length > 0 && edge.targets.length > 0) {
                edges.push({
                    id: edge.id,
                    sources: edge.sources || [],
                    targets: edge.targets || [],
                });
            }
        }
    } else {
        for (let i = 0; i < tools.length - 1; ++i) {
            const prev = tools[i];
            const next = tools[i + 1];
            edges.push({
                id: prev.name + '-' + next.name,
                sources: [prev.name],
                targets: [next.name]
            })
        }
    }

    for (const tool of tools) {
        nodes.push({
            id: tool.name,
            width: 200,
            height: 64, // 增加高度
            labels: [{ text: tool.name || 'Tool' }]
        });

        if (!state.dataView.has(tool.name)) {
            // 如果 dataView 中没有该工具，则初始化
            state.dataView.set(tool.name, {
                tool,
                status: 'waiting',
            });
        }
    }

    state.edges = edges;
    state.nodes = nodes;

    // 重新计算布局
    await recomputeLayout();

    // 绘制 svg
    renderSvg();
};

function renderSvg() {
    const prevNodeMap = new Map(prevNodes.map(n => [n.id, n]));
    const prevEdgeMap = new Map(prevEdges.map(e => [e.id, e]));

    // 计算所有节点的最小x和最大x
    const xs = state.nodes.map(n => (n.x || 0));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs.map((x, i) => x + (state.nodes[i].width || 160)));
    const contentWidth = maxX - minX;
    const svgWidth = Math.max(contentWidth + 120, 400); // 120为两侧留白
    const offsetX = (svgWidth - contentWidth) / 2 - minX;

    const height = Math.max(...state.nodes.map(n => (n.y || 0) + (n.height || 48)), 300) + 60;

    // 不再全量清空，只清空 svg 元素
    let svg = d3.select(svgContainer.value).select('svg');
    if (svg.empty()) {
        svg = d3
            .select(svgContainer.value)
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', height)
            .style('user-select', 'none') as any;
    } else {
        svg.attr('width', svgWidth).attr('height', height);
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
        .transition()
        .duration(600)
        .attr('transform', `translate(${offsetX}, 0)`);

    // Draw edges with enter animation
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
                ? prev.sections[0].startPoint.x + 30
                : d.section.startPoint.x + 30;
        })
        .attr('y1', d => {
            const prev = prevEdgeMap.get(d.id);
            return prev && prev.sections && prev.sections[0]
                ? prev.sections[0].startPoint.y + 30
                : d.section.startPoint.y + 30;
        })
        .attr('x2', d => {
            const prev = prevEdgeMap.get(d.id);
            return prev && prev.sections && prev.sections[0]
                ? prev.sections[0].endPoint.x + 30
                : d.section.endPoint.x + 30;
        })
        .attr('y2', d => {
            const prev = prevEdgeMap.get(d.id);
            return prev && prev.sections && prev.sections[0]
                ? prev.sections[0].endPoint.y + 30
                : d.section.endPoint.y + 30;
        })
        .attr('stroke', 'var(--main-color)')
        .attr('stroke-width', 2.5)
        .attr('marker-end', 'url(#arrow)')
        .attr('opacity', 0);

    edgeEnter
        .transition()
        .duration(600)
        .attr('opacity', 1)
        .attr('x1', d => d.section.startPoint.x + 30)
        .attr('y1', d => d.section.startPoint.y + 30)
        .attr('x2', d => d.section.endPoint.x + 30)
        .attr('y2', d => d.section.endPoint.y + 30);

    // update + 动画（注意这里不再 transition opacity）
    edgeSelection.merge(edgeEnter)
        .transition()
        .duration(600)
        .ease(d3.easeCubicInOut)
        .attr('x1', d => d.section.startPoint.x + 30)
        .attr('y1', d => d.section.startPoint.y + 30)
        .attr('x2', d => d.section.endPoint.x + 30)
        .attr('y2', d => d.section.endPoint.y + 30)
        .attr('opacity', 1);

    // --- 节点动画部分 ---
    const nodeGroup = mainGroup.selectAll<SVGGElement, any>('.node')
        .data(state.nodes, d => d.id);

    nodeGroup.exit().remove();

    // 节点 enter
    const nodeGroupEnter = nodeGroup.enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => {
            const prev = prevNodeMap.get(d.id);
            if (prev) {
                return `translate(${(prev.x || 0) + 30}, ${(prev.y || 0) + 30})`;
            }
            return `translate(${(d.x || 0) + 30}, ${(d.y || 0) + 30})`;
        })
        .style('cursor', 'pointer')
        .attr('opacity', 0)
        .on('mousedown', null)
        .on('mouseup', function (event, d) {
            event.stopPropagation();
            if (state.selectedNodeId) {

                const { canConnect, reason } = invalidConnectionDetector(state, d);
                console.log(reason);

                if (reason) {
                    ElMessage.warning(reason);
                }

                if (canConnect) {
                    state.edges.push({
                        id: `e${state.selectedNodeId}_${d.id}_${Date.now()}`,
                        sources: [state.selectedNodeId],
                        targets: [d.id]
                    });
                    state.selectedNodeId = null;
                    recomputeLayout().then(renderSvg);
                } else {
                    // 已存在则只取消选中
                    state.selectedNodeId = null;
                    renderSvg();
                }
                context.setCaption('');

            } else {
                state.selectedNodeId = d.id;
                renderSvg();
                context.setCaption(t('select-node-define-test-tomo'));
            }
            state.draggingNodeId = null;
        })
        .on('mouseover', function (event, d) {
            setHoverItem(d.id);
            d3.select(this).select('rect')
                .transition()
                .duration(200)
                .attr('stroke', 'var(--main-color)')
                .attr('stroke-width', 2);
        })
        .on('mouseout', function (event, d) {
            // clearHoverItem();
            if (state.selectedNodeId === d.id) return;
            d3.select(this).select('rect')
                .transition()
                .duration(200)
                .attr('stroke', 'var(--main-light-color-10)')
                .attr('stroke-width', 1);
        });

    nodeGroupEnter.append('rect')
        .attr('width', (d: any) => d.width)
        .attr('height', (d: any) => d.height)
        .attr('rx', 16)
        .attr('fill', 'var(--main-light-color-20)')
        .attr('stroke', d => state.selectedNodeId === d.id ? 'var(--main-color)' : 'var(--main-light-color-10)')
        .attr('stroke-width', 2);

    // 节点文字
    nodeGroupEnter.append('text')
        .attr('x', d => d.width / 2)
        .attr('y', d => d.height / 2 - 6) // 上移一点
        .attr('text-anchor', 'middle')
        .attr('font-size', 16)
        .attr('fill', 'var(--main-color)')
        .attr('font-weight', 600)
        .text(d => d.labels?.[0]?.text || 'Tool');

    nodeGroupEnter.append('g').attr('class', 'node-status');

    // 合并 enter+update
    const nodeStatusGroup = nodeGroup.merge(nodeGroupEnter).select('.node-status');

    // 先清空再重绘
    nodeStatusGroup.each(function (d) {
        const g = d3.select(this);
        g.selectAll('*').remove(); // 清空旧内容

        const status = state.dataView.get(d.id)?.status || 'waiting';
        if (status === 'running') {
            g.append('circle')
                .attr('cx', d.width / 2 - 32)
                .attr('cy', d.height - 16)
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', 'var(--main-color)')
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', 20)
                .attr('stroke-dashoffset', 0)
                .append('animateTransform')
                .attr('attributeName', 'transform')
                .attr('attributeType', 'XML')
                .attr('type', 'rotate')
                .attr('from', `0 ${(d.width / 2 - 32)} ${(d.height - 16)}`)
                .attr('to', `360 ${(d.width / 2 - 32)} ${(d.height - 16)}`)
                .attr('dur', '1s')
                .attr('repeatCount', 'indefinite');
            g.append('text')
                .attr('x', d.width / 2 - 16)
                .attr('y', d.height - 12)
                .attr('font-size', 13)
                .attr('fill', 'var(--main-color)')
                .text('running');
        } else if (status === 'waiting') {
            g.append('circle')
                .attr('cx', d.width / 2 - 32)
                .attr('cy', d.height - 16)
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', '#bdbdbd')
                .attr('stroke-width', 3);
            g.append('text')
                .attr('x', d.width / 2 - 16)
                .attr('y', d.height - 12)
                .attr('font-size', 13)
                .attr('fill', '#bdbdbd')
                .text('waiting');
        } else if (status === 'success') {
            g.append('circle')
                .attr('cx', d.width / 2 - 32)
                .attr('cy', d.height - 16)
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', '#4caf50')
                .attr('stroke-width', 3);
            g.append('text')
                .attr('x', d.width / 2 - 16)
                .attr('y', d.height - 12)
                .attr('font-size', 13)
                .attr('fill', '#4caf50')
                .text('success');
        } else if (status === 'error') {
            g.append('circle')
                .attr('cx', d.width / 2 - 32)
                .attr('cy', d.height - 16)
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', '#f44336')
                .attr('stroke-width', 3);
            g.append('text')
                .attr('x', d.width / 2 - 16)
                .attr('y', d.height - 12)
                .attr('font-size', 13)
                .attr('fill', '#f44336')
                .text('error');
        }
    });
    // 节点 enter 动画
    nodeGroupEnter
        .transition()
        .duration(600)
        .attr('opacity', 1)
        .attr('transform', d => `translate(${(d.x || 0) + 30}, ${(d.y || 0) + 30})`);

    // 节点 update 动画
    nodeGroup
        .transition()
        .duration(600)
        .ease(d3.easeCubicInOut)
        .attr('transform', d => `translate(${(d.x || 0) + 30}, ${(d.y || 0) + 30})`);

    // 高亮选中节点动画
    nodeGroup.select('rect')
        .transition()
        .duration(400)
        .attr('stroke', d => state.selectedNodeId === d.id ? 'var(--main-color)' : 'var(--main-light-color-10)');

    // 边高亮
    svg.selectAll<SVGLineElement, any>('.edge')
        .on('mouseover', function () {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('stroke', 'var(--main-color)')
                .attr('stroke-width', 4.5);

            context.setCaption(t('click-edge-to-delete'));

        })
        .on('mouseout', function () {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('stroke', 'var(--main-color)')
                .attr('stroke-width', 2.5);

            context.setCaption('');
        })
        .on('click', function (event, d) {
            // 只删除当前 edge
            state.edges = state.edges.filter(e => {
                // 多段 edge 情况
                if (e.sections) {
                    // 只保留不是当前 section 的
                    return !e.sections.some((section: any, idx: number) =>
                        ((e.id || '') + '-' + (section.id || idx)) === d.id
                    );
                }
                // 单段 edge 情况
                return e.id !== d.id && e.id !== d.section?.id;
            });
            recomputeLayout().then(renderSvg);
            event.stopPropagation();
        });

    // 渲染结束后保存当前快照
    prevNodes = state.nodes.map(n => ({ ...n }));
    prevEdges = (state.edges || []).map(e => ({ ...e, sections: e.sections ? e.sections.map((s: any) => ({ ...s })) : [] }));
}

// 重置连接为链表结构
function serialConnection() {
    if (!state.nodes.length) return;
    const edges = [];
    for (let i = 0; i < state.nodes.length - 1; ++i) {
        const prev = state.nodes[i];
        const next = state.nodes[i + 1];
        edges.push({
            id: prev.id + '-' + next.id,
            sources: [prev.id],
            targets: [next.id]
        });
    }
    state.edges = edges;
    recomputeLayout().then(renderSvg);
}

function parallelConnection() {
    if (!state.nodes.length) return;
    const edges = [] as Edge[];
    state.edges = edges;
    recomputeLayout().then(renderSvg);
}

const context = inject('context') as any;
context.preset = (type: string) => {
    if (type === 'serial') {
        serialConnection();
    } else if (type === 'parallel') {
        parallelConnection();
    }
};
context.state = state;
context.render = renderSvg;

onMounted(() => {
    nextTick(drawDiagram);
});

// 4. 计算窗口位置
function getNodePopupStyle(node: any): any {
    // 节点的 svg 坐标转为容器内绝对定位
    // 注意：这里假设 offsetX、node.x、node.y 已经是最新的
    const marginX = 50;
    const marginY = 80;
    const popupWidth = 300;
    const popupHeight = 500;

    let left = (node.x || 0) + (node.width || 160) + 100;
    let top = (node.y || 0) + 30;

    // 获取容器宽高
    const container = svgContainer.value;
    let containerWidth = 1200, containerHeight = 800; // 默认值
    if (container) {
        const rect = container.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
    }

    // 限制 left 和 top 不超出容器
    left = Math.max(marginX, Math.min(left, containerWidth - popupWidth - marginX));
    top = Math.max(marginY, Math.min(top, containerHeight - popupHeight - marginY));

    return {
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${popupWidth}px`,
        height: `${popupHeight}px`
    };
}

// 重置所有节点的状态为初始值
function resetDataView() {
    state.dataView.forEach((view, key) => {
        state.dataView.set(key, {
            ...view,
            status: 'waiting',
            result: null,
            createAt: undefined,
            finishAt: undefined,
            llmTimecost: undefined,
            toolcallTimecost: undefined
        });
    });
}

context.resetDataView = resetDataView;

</script>

<style>
.diagram-container {
    flex: 1;
    min-width: 420px;
    width: 100%;
    max-width: calc(100% - 340px);
    min-height: 200px;
    border-radius: 12px;
    padding: 24px 16px;
    display: flex;
    justify-content: flex-start;
    overflow-x: auto;
}

.node-popup {
    position: absolute;
    background: var(--background);
    border: 1px solid var(--main-color);
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    white-space: nowrap;
    z-index: 10;
}

/* 旋转动画 */
.status-running-circle {
    animation: spin 1s linear infinite;
    transform-origin: center;
}

@keyframes spin {
    100% {
        transform: rotate(360deg);
    }
}

.diagram-container {
    flex: 1;
    min-width: 420px;
    width: 100%;
    max-width: calc(100% - 340px);
    min-height: 200px;
    display: flex;
    align-items: flex-start;
    border-radius: 12px;
    padding: 24px 16px;
    overflow-x: auto;
}

.diagram-info-panel {
    position: absolute;
    right: 30px;
    top: 10px;
    width: 300px;
    min-height: 180px;
    border: 1px solid var(--main-color);
    border-radius: 12px;
    box-shadow: 0 2px 12px 0 rgba(0,0,0,0.06);
    padding: 10px;
    display: flex;
    flex-direction: column;
    margin-top: 8px;
    transition: box-shadow 0.2s;
}

.diagram-info-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 120px;
    opacity: 0.85;
    font-size: 15px;
}

.item-status.running {
    color: var(--main-color);
}

.item-status.success {
    color: #43a047;
}

.item-status.error {
    color: #e53935;
}

.item-status.waiting {
    color: #aaa;
}

.item-status.default {
    color: #888;
}

</style>
