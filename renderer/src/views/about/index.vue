<template>
	<div class="about-container">
		<div class="about-card">
			<div class="about-header">
				<img src="/favicon.svg" alt="OpenMCP" class="about-logo" />
				<h1 class="about-title">OpenMCP</h1>
				<span class="about-version">v{{ version }}</span>
			</div>

			<div class="about-content">
				<p class="about-description">{{ t('openmcp-developed-by', { version, author }) }}</p>

				<div class="about-actions">
					<div class="action-row">
						<el-button class="action-btn btn-github" @click="gotoWebsite('https://github.com/LSTM-Kirigaya/openmcp-client')">
							<span class="iconfont icon-star"></span>
							{{ t('star-our-project') }}
						</el-button>

						<el-button class="action-btn btn-doc" @click="gotoWebsite('https://openmcp.kirigaya.cn')">
							<span class="iconfont icon-wendang"></span>
							{{ t('document') }}
						</el-button>
					</div>

					<div class="action-row">
						<el-button class="action-btn btn-qq" @click="gotoWebsite('https://qm.qq.com/cgi-bin/qm/qr?k=C6ZUTZvfqWoI12lWe7L93cWa1hUsuVT0&jump_from=webapi&authKey=McW6B1ogTPjPDrCyGttS890tMZGQ1KB3QLuG4aqVNRaYp4vlTSgf2c6dMcNjMuBD')">
							<span class="iconfont icon-QQ"></span>
							{{ t('join-discussion') }}
						</el-button>
						<el-button class="action-btn btn-comment" @click="gotoWebsite('https://marketplace.visualstudio.com/items?itemName=kirigaya.openmcp&ssr=false#review-details')">
							<span class="iconfont icon-star"></span>
							{{ t('comment-for-us') }}
						</el-button>
					</div>
				</div>
			</div>
		</div>


	</div>
</template>

<script setup lang="ts">
import { gotoWebsite } from '@/hook/util';
import { defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const version = '0.1.13';
const author = 'LSTM-Kirigaya (锦恢)';

defineComponent({ name: 'about' });

</script>

<style scoped>
.about-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 100%;
	padding: 40px 20px;
	background-color: var(--background);
	gap: 32px;
}

.about-card {
	background-color: var(--sidebar);
	border: 1px solid var(--border);
	border-radius: 16px;
	padding: 48px 56px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 32px;
	box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
	max-width: 520px;
	width: 100%;
}

.about-header {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
}

.about-logo {
	width: 100px;
	height: 100px;
	object-fit: contain;
	filter: drop-shadow(0 4px 12px rgba(99, 102, 241, 0.3));
}

.about-title {
	font-size: 32px;
	font-weight: 700;
	color: var(--foreground);
	margin: 0;
	letter-spacing: -0.5px;
}

.about-version {
	font-size: 13px;
	font-weight: 500;
	color: var(--main-color);
	background-color: var(--main-light-color-10);
	padding: 4px 12px;
	border-radius: 20px;
	border: 1px solid var(--main-light-color-20);
}

.about-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 28px;
	width: 100%;
}

.about-description {
	color: var(--foreground-muted);
	font-size: 14px;
	line-height: 1.6;
	text-align: center;
	margin: 0;
}

.about-actions {
	display: flex;
	flex-direction: column;
	gap: 12px;
	width: 100%;
}

.action-row {
	display: flex;
	gap: 12px;
	justify-content: center;
	flex-wrap: wrap;
}

.action-btn {
	border-radius: 10px;
	padding: 10px 20px;
	font-size: 13px;
	font-weight: 500;
	transition: var(--animation-3s);
	border: 1px solid transparent;
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
	min-width: 140px;
	justify-content: center;
}

.action-btn .iconfont {
	font-size: 16px;
}

/* GitHub 按钮 - 深色风格 */
.action-btn.btn-github {
	background-color: var(--sidebar-item-hover);
	color: var(--foreground);
	border-color: var(--border);
}

.action-btn.btn-github:hover {
	background-color: var(--sidebar-item-selected);
	border-color: var(--main-light-color-30);
	color: var(--main-color);
}

/* 文档按钮 */
.action-btn.btn-doc {
	background-color: var(--main-light-color-10);
	color: var(--main-color);
	border-color: var(--main-light-color-20);
}

.action-btn.btn-doc:hover {
	background-color: var(--main-light-color-20);
	border-color: var(--main-light-color-40);
}

/* QQ 按钮 */
.action-btn.btn-qq {
	background-color: var(--sidebar-item-hover);
	color: var(--foreground);
	border-color: var(--border);
}

.action-btn.btn-qq:hover {
	background-color: var(--sidebar-item-selected);
	border-color: var(--main-light-color-30);
	color: var(--main-color);
}

/* 评论按钮 - 主按钮风格 */
.action-btn.btn-comment {
	background-color: var(--main-color);
	color: #ffffff;
	border-color: var(--main-color);
}

.action-btn.btn-comment:hover {
	background-color: var(--main-light-color-90);
	border-color: var(--main-light-color-90);
}

.about-footer {
	color: var(--foreground-muted);
	font-size: 13px;
	opacity: 0.7;
}

.footer-text {
	display: flex;
	align-items: center;
	gap: 4px;
}
</style>
