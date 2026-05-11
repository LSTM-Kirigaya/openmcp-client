<template>
	<div class="about-container">
		<div class="about-card">
			<div class="about-header">
				<img src="/favicon.svg" alt="OpenMCP" class="about-logo" />
				<h1 class="about-title">OpenMCP</h1>
				<span class="about-version">v{{ version }}</span>
			</div>

			<div class="about-content">
				<p class="about-description">{{ t('openmcp-team') }}</p>

				<div class="contributors-grid">
					<a
						v-for="contributor in contributors"
						:key="contributor.username"
						:href="contributor.homeUrl"
						target="_blank"
						class="contributor-item"
					>
						<img
							:src="contributor.avatarUrl"
							:alt="contributor.username"
							class="contributor-avatar"
						/>
						<span class="contributor-name">{{ contributor.username }}</span>
					</a>
				</div>

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

const contributors = [
	{
		username: 'LSTM-Kirigaya',
		avatarUrl: 'https://avatars.githubusercontent.com/u/59416203?v=4',
		homeUrl: 'https://github.com/LSTM-Kirigaya'
	},
	{
		username: 'li1553770945',
		avatarUrl: 'https://avatars.githubusercontent.com/u/55867654?v=4',
		homeUrl: 'https://github.com/li1553770945'
	},
	{
		username: 'STUzhy',
		avatarUrl: 'https://avatars.githubusercontent.com/u/129645384?v=4',
		homeUrl: 'https://github.com/STUzhy'
	},
	{
		username: 'appli456',
		avatarUrl: 'https://avatars.githubusercontent.com/u/8943691?v=4',
		homeUrl: 'https://github.com/appli456'
	},
	{
		username: 'cybermanhao',
		avatarUrl: 'https://avatars.githubusercontent.com/u/37235140?v=4',
		homeUrl: 'https://github.com/cybermanhao'
	},
	{
		username: 'ArcStellars',
		avatarUrl: 'https://avatars.githubusercontent.com/u/115577936?v=4',
		homeUrl: 'https://github.com/ArcStellars'
	},
	{
		username: 'superboy-zjc',
		avatarUrl: 'https://avatars.githubusercontent.com/u/60600792?v=4',
		homeUrl: 'https://github.com/superboy-zjc'
	},
	{
		username: 'ZYD045692',
		avatarUrl: 'https://avatars.githubusercontent.com/u/206822796?v=4',
		homeUrl: 'https://github.com/ZYD045692'
	},
	{
		username: 'Dormiveglia-elf',
		avatarUrl: 'https://avatars.githubusercontent.com/u/81767213?v=4',
		homeUrl: 'https://github.com/Dormiveglia-elf'
	}
];

defineComponent({ name: 'about' });
</script>

<style scoped>
.about-container {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 100%;
	padding: 0px 20px;
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

/* Contributors Grid */
.contributors-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
	gap: 12px;
	width: 100%;
}

.contributor-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	text-decoration: none;
	transition: transform 0.2s ease;
}

.contributor-item:hover {
	transform: translateY(-2px);
}

.contributor-avatar {
	width: 56px;
	height: 56px;
	border-radius: 50%;
	object-fit: cover;
	border: 2px solid var(--border);
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
	transition: border-color 0.2s ease;
}

.contributor-item:hover .contributor-avatar {
	border-color: var(--main-color);
}

.contributor-name {
	font-size: 11px;
	font-weight: 500;
	color: var(--main-color);
	text-align: center;
	word-break: break-all;
	line-height: 1.2;
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
