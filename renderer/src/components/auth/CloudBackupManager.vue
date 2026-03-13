<template>
  <div class="cloud-backup-manager">
    <!-- 头部 -->
    <div class="backup-header">
      <div class="header-left">
        <h3>{{ $t('backup.title') }}</h3>
        <el-tag v-if="!cloudBackupStore.isConfigured" type="warning" size="small">
          {{ $t('backup.notConfigured') }}
        </el-tag>
      </div>
      <div class="header-right">
        <el-button
          type="primary"
          :loading="cloudBackupStore.isBackingUp"
          :disabled="!authStore.isAuthenticated || !cloudBackupStore.isConfigured"
          @click="showCreateBackupDialog = true"
        >
          <el-icon><Upload /></el-icon>
          {{ $t('backup.createBackup') }}
        </el-button>
        <el-button
          :loading="cloudBackupStore.isLoading"
          :disabled="!authStore.isAuthenticated || !cloudBackupStore.isConfigured"
          @click="refreshBackups"
        >
          <el-icon><Refresh /></el-icon>
          {{ $t('common.refresh') }}
        </el-button>
      </div>
    </div>

    <!-- 未登录提示 -->
    <el-alert
      v-if="!authStore.isAuthenticated"
      :title="$t('backup.loginRequired')"
      type="info"
      :closable="false"
      class="mb-4"
    >
      <template #default>
        <el-button type="primary" size="small" @click="showLoginDialog = true">
          {{ $t('auth.login') }}
        </el-button>
      </template>
    </el-alert>

    <!-- 未配置提示 -->
    <el-alert
      v-else-if="!cloudBackupStore.isConfigured"
      :title="$t('backup.configureRequired')"
      type="warning"
      :closable="false"
      class="mb-4"
    />

    <!-- 备份列表 -->
    <div v-else class="backup-list">
      <el-empty v-if="!cloudBackupStore.hasBackups" :description="$t('backup.noBackups')" />
      
      <el-table
        v-else
        :data="cloudBackupStore.backups"
        v-loading="cloudBackupStore.isLoading"
        style="width: 100%"
      >
        <el-table-column :label="$t('backup.name')" prop="name" min-width="150" />
        
        <el-table-column :label="$t('backup.description')" prop="description" min-width="150">
          <template #default="{ row }">
            <span v-if="row.description">{{ row.description }}</span>
            <el-text v-else type="info">-</el-text>
          </template>
        </el-table-column>
        
        <el-table-column :label="$t('backup.size')" prop="file_size" width="100">
          <template #default="{ row }">
            {{ cloudBackupStore.formatFileSize(row.file_size) }}
          </template>
        </el-table-column>
        
        <el-table-column :label="$t('backup.device')" prop="device_info" width="150">
          <template #default="{ row }">
            <el-text type="info" size="small">{{ row.device_info || '-' }}</el-text>
          </template>
        </el-table-column>
        
        <el-table-column :label="$t('backup.createdAt')" prop="created_at" width="160">
          <template #default="{ row }">
            {{ cloudBackupStore.formatDate(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column :label="$t('common.actions')" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              :loading="cloudBackupStore.isRestoring && currentRestoreId === row.id"
              @click="handleRestore(row)"
            >
              <el-icon><Download /></el-icon>
              {{ $t('backup.restore') }}
            </el-button>
            <el-popconfirm
              :title="$t('backup.confirmDelete')"
              :confirm-button-text="$t('common.confirm')"
              :cancel-button-text="$t('common.cancel')"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button type="danger" size="small">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 创建备份对话框 -->
    <el-dialog
      v-model="showCreateBackupDialog"
      :title="$t('backup.createBackup')"
      width="450px"
    >
      <el-form :model="backupForm" label-position="top">
        <el-form-item :label="$t('backup.backupName')" required>
          <el-input
            v-model="backupForm.name"
            :placeholder="$t('backup.backupNamePlaceholder')"
          />
        </el-form-item>
        
        <el-form-item :label="$t('backup.backupDescription')">
          <el-input
            v-model="backupForm.description"
            type="textarea"
            :rows="2"
            :placeholder="$t('backup.backupDescriptionPlaceholder')"
          />
        </el-form-item>
        
        <el-form-item :label="$t('backup.encryptionPassword')" required>
          <el-input
            v-model="backupForm.password"
            type="password"
            show-password
            :placeholder="$t('backup.encryptionPasswordPlaceholder')"
          />
          <el-text type="info" size="small">
            {{ $t('backup.encryptionPasswordHint') }}
          </el-text>
        </el-form-item>
        
        <el-form-item :label="$t('backup.confirmPassword')" required>
          <el-input
            v-model="backupForm.confirmPassword"
            type="password"
            show-password
            :placeholder="$t('backup.confirmPasswordPlaceholder')"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showCreateBackupDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="cloudBackupStore.isBackingUp"
          @click="handleCreateBackup"
        >
          {{ $t('backup.create') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 恢复备份对话框 -->
    <el-dialog
      v-model="showRestoreDialog"
      :title="$t('backup.restoreBackup')"
      width="450px"
    >
      <el-alert
        :title="$t('backup.restoreWarning')"
        type="warning"
        :closable="false"
        class="mb-4"
      />
      
      <el-form label-position="top">
        <el-form-item :label="$t('backup.encryptionPassword')" required>
          <el-input
            v-model="restorePassword"
            type="password"
            show-password
            :placeholder="$t('backup.restorePasswordPlaceholder')"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showRestoreDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="cloudBackupStore.isRestoring"
          @click="confirmRestore"
        >
          {{ $t('backup.restore') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 登录对话框 -->
    <LoginDialog v-model="showLoginDialog" @success="onLoginSuccess" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload, Download, Delete, Refresh } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useCloudBackupStore, BackupMetadata } from '../../stores/useCloudBackupStore.js';
import LoginDialog from './LoginDialog.vue';

const authStore = useAuthStore();
const cloudBackupStore = useCloudBackupStore();

const showLoginDialog = ref(false);
const showCreateBackupDialog = ref(false);
const showRestoreDialog = ref(false);
const currentRestoreId = ref('');
const restorePassword = ref('');

const backupForm = reactive({
  name: '',
  description: '',
  password: '',
  confirmPassword: ''
});

// 刷新备份列表
async function refreshBackups() {
  await cloudBackupStore.fetchBackups();
}

// 创建备份
async function handleCreateBackup() {
  if (!backupForm.name.trim()) {
    ElMessage.warning(t('backup.nameRequired'));
    return;
  }
  
  if (!backupForm.password) {
    ElMessage.warning(t('backup.passwordRequired'));
    return;
  }
  
  if (backupForm.password !== backupForm.confirmPassword) {
    ElMessage.warning(t('backup.passwordMismatch'));
    return;
  }

  // 收集需要备份的数据
  // TODO: 根据实际情况收集应用数据
  const dataToBackup = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    // 添加其他需要备份的数据
    settings: {},
    connections: [],
    prompts: []
  };

  const success = await cloudBackupStore.createBackup(
    backupForm.name,
    backupForm.password,
    dataToBackup,
    backupForm.description
  );

  if (success) {
    ElMessage.success(t('backup.createSuccess'));
    showCreateBackupDialog.value = false;
    resetBackupForm();
  } else {
    ElMessage.error(cloudBackupStore.error || t('backup.createFailed'));
  }
}

// 恢复备份
function handleRestore(backup: BackupMetadata) {
  currentRestoreId.value = backup.id;
  restorePassword.value = '';
  showRestoreDialog.value = true;
}

async function confirmRestore() {
  if (!restorePassword.value) {
    ElMessage.warning(t('backup.passwordRequired'));
    return;
  }

  try {
    await ElMessageBox.confirm(
      t('backup.restoreConfirmMessage'),
      t('backup.restoreConfirmTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );

    const data = await cloudBackupStore.restoreBackup(
      currentRestoreId.value,
      restorePassword.value
    );

    if (data) {
      ElMessage.success(t('backup.restoreSuccess'));
      showRestoreDialog.value = false;
      // TODO: 应用恢复的数据
      console.log('Restored data:', data);
    } else {
      ElMessage.error(cloudBackupStore.error || t('backup.restoreFailed'));
    }
  } catch {
    // 用户取消
  }
}

// 删除备份
async function handleDelete(backupId: string) {
  const success = await cloudBackupStore.deleteBackup(backupId);
  if (success) {
    ElMessage.success(t('backup.deleteSuccess'));
  } else {
    ElMessage.error(cloudBackupStore.error || t('backup.deleteFailed'));
  }
}

// 登录成功回调
function onLoginSuccess() {
  cloudBackupStore.initialize();
}

function resetBackupForm() {
  backupForm.name = '';
  backupForm.description = '';
  backupForm.password = '';
  backupForm.confirmPassword = '';
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    cloudBackupStore.initialize();
  }
});
</script>

<style scoped>
.cloud-backup-manager {
  padding: 20px;
}

.backup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;

    h3 {
      margin: 0;
    }
  }

  .header-right {
    display: flex;
    gap: 10px;
  }
}

.backup-list {
  .el-table {
    margin-top: 10px;
  }
}

.mb-4 {
  margin-bottom: 16px;
}
</style>
