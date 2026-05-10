<template>
    <el-dialog v-model="dialogVisible" :title="t('auth.passwordDialogTitle')" :close-on-click-modal="false" :close-on-press-escape="false"
        :show-close="false" width="30%" top="20vh">
        <br>
        <el-input v-model="privilegeStatus.password"
            type="password"
            :placeholder="t('auth.passwordPlaceholder')"
            @keyup.enter.prevent="handleSubmit"
        />
        <template #footer>
            <el-button type="primary" @click="handleSubmit">{{ t('auth.confirm') }}</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { privilegeStatus } from './status';
import { useMessageBridge } from '@/api/message-bridge';
import { initialise } from '@/views/connect';

const { t } = useI18n();
const dialogVisible = ref(true);

const handleSubmit = async () => {
    const bridge = useMessageBridge();

    const ok = await bridge.setupWebSocket(import.meta.env.VITE_WEBSOCKET_URL + '?t=' + privilegeStatus.password);

    if (ok) {
        ElMessage.success(t('auth.passwordSuccess'));
        dialogVisible.value = false;

        initialise();

    } else {
        ElMessage.error(t('auth.passwordFailed'));
    }
};

onMounted(() => {
    dialogVisible.value = true;
});
</script>

<style scoped>
.el-dialog {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    z-index: 9999;
}
</style>