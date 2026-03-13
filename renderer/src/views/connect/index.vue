<template>
	<div class="connection-container-wrapper">
		<el-splitter class="connection-splitter">
			<el-splitter-panel :min="120" :max="400" size="200" class="splitter-panel-left">
				<div class="server-list-panel">
					<div class="list-container">
						<el-scrollbar>
							<div class="list-inner">
								<div
									v-for="(item, index) in mcpClientAdapter.clients"
									:key="index"
									class="list-item server-item"
									:class="{ active: mcpClientAdapter.currentClientIndex === index }"
									@click="selectServer(index)"
								>
									<div class="list-item-content">
										<span class="connect-status">
											<span v-if="item.connectionResult.success" class="success">
												<span class="item-title name">{{ item.connectionResult.name }}</span>
											</span>
											<span v-else>
												<span class="item-title">{{ t('server') }} {{ index + 1 }}</span>
											</span>
										</span>
									</div>
									<span
										v-if="mcpClientAdapter.clients.length > 1"
										class="delete-btn"
										@click.stop="deleteServer(index)"
									>
										<span class="iconfont icon-delete"></span>
									</span>
								</div>
								<div class="add-server" @click="addServer">
									<span class="iconfont icon-add"></span>
									<span class="add-server-text">{{ t('add-server') }}</span>
								</div>
							</div>
						</el-scrollbar>
					</div>
				</div>
			</el-splitter-panel>
			<el-splitter-panel class="splitter-panel-right">
				<div class="connection-detail-panel" v-if="mcpClientAdapter.clients.length > 0">
					<ConnectionPanel :index="mcpClientAdapter.currentClientIndex" />
				</div>
				<div class="empty-state" v-else>
					<span class="iconfont icon-openmcp"></span>
					<span class="empty-text">{{ t('no-connect-right-now') }}</span>
				</div>
			</el-splitter-panel>
		</el-splitter>
	</div>
</template>

<script setup lang="ts">
import { defineComponent, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ConnectionPanel from './connection-panel.vue';
import { McpClient, mcpClientAdapter } from './core';
import { ElMessage } from 'element-plus';

/* 连接参数/环境变量区块样式（迁移自设置页），在连接页入口引入避免依赖 setting 组件异步加载 */
import './connection-setting-styles.css';

defineComponent({ name: 'connection' });

const { t } = useI18n();

function selectServer(index: number) {
	mcpClientAdapter.currentClientIndex = index;
}

function addServer() {
	const client = new McpClient();
	mcpClientAdapter.clients.push(client);
	mcpClientAdapter.currentClientIndex = mcpClientAdapter.clients.length - 1;
	mcpClientAdapter.clients.at(-1)!.handleEnvSwitch(true);
}

function deleteServer(index: number) {
	if (mcpClientAdapter.clients.length <= 1) {
		ElMessage.warning(t('at-least-one-server'));
		return;
	}
	mcpClientAdapter.clients.splice(index, 1);
	if (mcpClientAdapter.currentClientIndex >= mcpClientAdapter.clients.length) {
		mcpClientAdapter.currentClientIndex = mcpClientAdapter.clients.length - 1;
	}
	mcpClientAdapter.saveLaunchSignature();
}
</script>

<style scoped>
.connection-container-wrapper {
	height: 100%;
}

.connection-splitter {
	height: 100%;
}

.connection-splitter :deep(.el-splitter__panel) {
	overflow: hidden;
}

.splitter-panel-left {
	display: flex;
	flex-direction: column;
}

.splitter-panel-right {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.server-list-panel {
	width: 100%;
	height: 100%;
	border-right: 1px solid var(--el-border-color-light);
	background-color: var(--el-bg-color);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.server-list-panel .list-container {
	flex: 1;
	min-height: 0;
}

.server-list-panel .list-container .el-scrollbar {
	height: 100%;
}

.server-list-panel .list-inner {
	padding: 10px;
}

.server-list-panel .list-item {
	margin: 2px 4px;
	padding: 10px 14px;
	border-radius: 8px;
	user-select: none;
	cursor: pointer;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 8px;
	transition: var(--animation-3s);
	border: 1px solid transparent;
}

.server-list-panel .list-item:hover {
	background-color: var(--sidebar-item-hover);
	border-color: var(--main-light-color-20);
}

.server-list-panel .list-item.active {
	background-color: var(--main-light-color-10);
	border: 1px solid var(--main-light-color-30);
}

.server-list-panel .list-item.active .item-title {
	color: var(--main-color);
	font-weight: 600;
}

.server-list-panel .list-item-content {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}

.server-list-panel .item-title {
	font-weight: bold;
	font-size: 13px;
	max-width: 100%;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.server-list-panel .name {
	max-width: 120px;
}

.server-list-panel .connect-status {
	display: flex;
	align-items: center;
	gap: 4px;
}

.server-list-panel .connect-status .success {
	display: flex;
	align-items: center;
}

.server-list-panel .delete-btn {
	margin-left: auto;
	cursor: pointer;
	color: var(--el-color-danger);
	flex-shrink: 0;
}
.server-list-panel .delete-btn:hover {
	opacity: 0.8;
}

.server-list-panel .add-server {
	padding: 10px 12px;
	text-align: center;
	cursor: pointer;
	border-radius: 0.3em;
	border: 1px dashed var(--el-border-color);
	margin: 3px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	transition: var(--animation-3s);
}
.server-list-panel .add-server:hover {
	background-color: var(--el-fill-color-light);
	border-color: var(--el-color-primary-light-5);
}
.server-list-panel .add-server-text {
	font-size: 13px;
}

.connection-detail-panel {
	flex: 1;
	min-width: 0;
	height: 100%;
	overflow: hidden;
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: var(--el-text-color-secondary);
}

.empty-state .iconfont {
	font-size: 128px;
	margin-bottom: 16px;
}

.empty-text {
	font-size: 18px;
	color: var(--el-text-color-secondary);
}
</style>
