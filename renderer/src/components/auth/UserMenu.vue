<template>
  <div class="user-menu">
    <!-- 未登录状态 -->
    <el-button
      v-if="!authStore.isAuthenticated"
      type="primary"
      size="small"
      @click="showLoginDialog = true"
    >
      <el-icon><User /></el-icon>
      {{ $t('auth.login') }}
    </el-button>

    <!-- 已登录状态 -->
    <el-dropdown v-else trigger="click">
      <div class="user-info">
        <el-avatar
          :size="32"
          :src="authStore.user?.avatar_url"
          :icon="UserFilled"
        />
        <span class="username">{{ authStore.userDisplayName }}</span>
        <el-icon><ArrowDown /></el-icon>
      </div>
      
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="showProfileDialog = true">
            <el-icon><User /></el-icon>
            {{ $t('auth.profile') }}
          </el-dropdown-item>
          
          <el-dropdown-item @click="showBackupManager = true">
            <el-icon><Cloud /></el-icon>
            {{ $t('backup.title') }}
          </el-dropdown-item>
          
          <el-dropdown-item divided @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            {{ $t('auth.logout') }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 登录对话框 -->
    <LoginDialog v-model="showLoginDialog" @success="onLoginSuccess" />

    <!-- 用户资料对话框 -->
    <el-dialog
      v-model="showProfileDialog"
      :title="$t('auth.profile')"
      width="400px"
    >
      <el-form :model="profileForm" label-position="top">
        <el-form-item :label="$t('auth.email')">
          <el-input v-model="profileForm.email" disabled />
        </el-form-item>
        
        <el-form-item :label="$t('auth.username')">
          <el-input
            v-model="profileForm.username"
            :placeholder="$t('auth.usernamePlaceholder')"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showProfileDialog = false">
          {{ $t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="authStore.isLoading"
          @click="handleUpdateProfile"
        >
          {{ $t('common.save') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 云备份管理抽屉 -->
    <el-drawer
      v-model="showBackupManager"
      :title="$t('backup.title')"
      size="800px"
    >
      <CloudBackupManager />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { User, UserFilled, ArrowDown, SwitchButton, Cloud } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useCloudBackupStore } from '../../stores/useCloudBackupStore.js';
import LoginDialog from './LoginDialog.vue';
import CloudBackupManager from './CloudBackupManager.vue';

const authStore = useAuthStore();
const cloudBackupStore = useCloudBackupStore();

const showLoginDialog = ref(false);
const showProfileDialog = ref(false);
const showBackupManager = ref(false);

const profileForm = reactive({
  email: '',
  username: ''
});

// 监听用户变化，更新表单
watch(() => authStore.user, (user) => {
  if (user) {
    profileForm.email = user.email;
    profileForm.username = user.username || '';
  }
}, { immediate: true });

// 登录成功
function onLoginSuccess() {
  cloudBackupStore.initialize();
}

// 更新资料
async function handleUpdateProfile() {
  const success = await authStore.updateProfile({
    username: profileForm.username
  });
  
  if (success) {
    ElMessage.success(t('auth.updateSuccess'));
    showProfileDialog.value = false;
  } else {
    ElMessage.error(authStore.error || t('auth.updateFailed'));
  }
}

// 登出
async function handleLogout() {
  try {
    await ElMessageBox.confirm(
      t('auth.logoutConfirm'),
      t('auth.logout'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    );
    
    await authStore.logout();
    ElMessage.success(t('auth.logoutSuccess'));
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.user-menu {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  .username {
    font-size: 14px;
    color: var(--el-text-color-primary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
