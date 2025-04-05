<template>
	<div class="chat-container">
		<el-container class="full-height">
			<el-header class="chat-header">
				<h2>AI 对话</h2>
			</el-header>

			<el-main class="chat-main">
				<div class="message-list">
					<div v-for="(message, index) in messages" :key="index" :class="['message-item', message.role]">
						<div class="message-avatar">
							<el-avatar :icon="message.role === 'user' ? User : Comment" />
						</div>
						<div class="message-content">
							<div class="message-role">{{ message.role === 'user' ? '你' : 'AI' }}</div>
							<div class="message-text">{{ message.content }}</div>
						</div>
					</div>

					<div v-if="isLoading" class="message-item assistant">
						<div class="message-avatar">
							<el-avatar :icon="Comment" />
						</div>
						<div class="message-content">
							<div class="message-role">AI</div>
							<div class="message-text">{{ streamingContent }}<span class="typing-cursor">|</span></div>
						</div>
					</div>
				</div>
			</el-main>

			<el-footer class="chat-footer">
				<div class="input-area">
					<el-input v-model="userInput" type="textarea" :rows="3" placeholder="输入消息..." :disabled="isLoading"
						@keydown.enter.prevent="handleSend" />
					<el-button type="primary" :loading="isLoading" @click="handleSend" class="send-button">
						发送
					</el-button>
				</div>
			</el-footer>
		</el-container>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineComponent, defineProps } from 'vue';
import { User, Comment } from '@element-plus/icons-vue';
import { useMessageBridge } from "@/api/message-bridge";
defineComponent({ name: 'chat' });

const props = defineProps({
	tabId: {
		type: Number,
		required: true
	}
});

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

const bridge = useMessageBridge();
const userInput = ref('');
const messages = ref<ChatMessage[]>([]);
const isLoading = ref(false);
const streamingContent = ref('');

const handleSend = () => {
	if (!userInput.value.trim() || isLoading.value) return;

	const userMessage = userInput.value.trim();
	messages.value.push({ role: 'user', content: userMessage });

	const chatData = {
		messages: [
			...messages.value.filter(msg => msg.role === 'user').map(msg => ({
				role: msg.role,
				content: msg.content
			})),
			{ role: 'assistant', content: streamingContent.value }
		]
	};

	isLoading.value = true;
	streamingContent.value = '';

	bridge.postMessage({
		command: 'llm/chat/completions',
		data: chatData
	});

	userInput.value = '';
};

onMounted(() => {
	bridge.addCommandListener('llm/chat/completions/chunk', data => {
		const { content } = data.msg;
		if (content) {
			streamingContent.value += content;
		}
	}, { once: false });

	bridge.addCommandListener('llm/chat/completions/done', () => {
		if (streamingContent.value) {
			messages.value.push({
				role: 'assistant',
				content: streamingContent.value
			});
			streamingContent.value = '';
		}
		isLoading.value = false;
	}, { once: false });
});
</script>

<style scoped>
.chat-container {
	height: fit-content;
	display: flex;
	flex-direction: column;
}

.full-height {
	height: 100%;
}

.chat-header {
	border-bottom: 1px solid var(--el-border-color);
	display: flex;
	align-items: center;
}

.chat-main {
	flex: 1;
	overflow-y: auto;
	padding: 16px;
}

.message-list {
	max-width: 800px;
	margin: 0 auto;
}

.message-item {
	display: flex;
	margin-bottom: 16px;
}

.message-avatar {
	margin-right: 12px;
}

.message-content {
	flex: 1;
}

.message-role {
	font-weight: bold;
	margin-bottom: 4px;
	color: var(--el-text-color-regular);
}

.message-text {
	line-height: 1.6;
	white-space: pre-wrap;
}

.user {
	flex-direction: row-reverse;
	text-align: right;
}

.user .message-avatar {
	margin-right: 0;
	margin-left: 12px;
}

.user .message-content {
	align-items: flex-end;
}

.assistant {
	text-align: left;
}

.chat-footer {
	padding: 16px;
	border-top: 1px solid var(--el-border-color);
}

.input-area {
	max-width: 800px;
	margin: 0 auto;
	display: flex;
	gap: 12px;
}

.send-button {
	align-self: flex-end;
	height: 72px;
}

.typing-cursor {
	animation: blink 1s infinite;
}

@keyframes blink {

	0%,
	100% {
		opacity: 1;
	}

	50% {
		opacity: 0;
	}
}
</style>