<template>
  <el-dialog
    v-model="visible"
    :title="isLoginMode ? $t('auth.login') : $t('auth.register')"
    width="400px"
    :close-on-click-modal="false"
    :show-close="!authStore.isLoading"
    class="login-dialog"
  >
    <div class="login-content">
      <!-- 错误提示 -->
      <el-alert
        v-if="authStore.error"
        :title="authStore.error"
        type="error"
        :closable="true"
        @close="authStore.clearError"
        class="mb-4"
      />

      <!-- 登录/注册表单 -->
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item :label="$t('auth.email')" prop="email">
          <el-input
            v-model="form.email"
            type="email"
            :placeholder="$t('auth.emailPlaceholder')"
            :disabled="authStore.isLoading"
          >
            <template #prefix>
              <el-icon><Message /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item :label="$t('auth.password')" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            :placeholder="$t('auth.passwordPlaceholder')"
            :disabled="authStore.isLoading"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 注册时显示确认密码 -->
        <el-form-item
          v-if="!isLoginMode"
          :label="$t('auth.confirmPassword')"
          prop="confirmPassword"
        >
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            :placeholder="$t('auth.confirmPasswordPlaceholder')"
            :disabled="authStore.isLoading"
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 注册时显示用户名（可选） -->
        <el-form-item
          v-if="!isLoginMode"
          :label="$t('auth.username')"
          prop="username"
        >
          <el-input
            v-model="form.username"
            :placeholder="$t('auth.usernamePlaceholder')"
            :disabled="authStore.isLoading"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
      </el-form>

      <!-- 切换登录/注册 -->
      <div class="mode-switch">
        <span v-if="isLoginMode">
          {{ $t('auth.noAccount') }}
          <el-link type="primary" @click="switchMode">{{ $t('auth.registerNow') }}</el-link>
        </span>
        <span v-else>
          {{ $t('auth.hasAccount') }}
          <el-link type="primary" @click="switchMode">{{ $t('auth.loginNow') }}</el-link>
        </span>
      </div>
    </div>

    <template #footer>
      <el-button @click="close" :disabled="authStore.isLoading">
        {{ $t('common.cancel') }}
      </el-button>
      <el-button
        type="primary"
        @click="handleSubmit"
        :loading="authStore.isLoading"
      >
        {{ isLoginMode ? $t('auth.login') : $t('auth.register') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Message, Lock, User } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { useAuthStore } from '../../stores/useAuthStore.js';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const isLoginMode = ref(true);

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  username: ''
});

// 验证规则
const rules: FormRules = {
  email: [
    { required: true, message: () => t('auth.emailRequired'), trigger: 'blur' },
    { type: 'email', message: () => t('auth.emailInvalid'), trigger: 'blur' }
  ],
  password: [
    { required: true, message: () => t('auth.passwordRequired'), trigger: 'blur' },
    { min: 8, message: () => t('auth.passwordMinLength'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: () => t('auth.confirmPasswordRequired'), trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== form.password) {
          callback(new Error(t('auth.passwordMismatch')));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
  ],
  username: [
    { required: false, trigger: 'blur' }
  ]
};

// 切换登录/注册模式
function switchMode() {
  isLoginMode.value = !isLoginMode.value;
  form.confirmPassword = '';
  form.username = '';
  authStore.clearError();
  formRef.value?.clearValidate();
}

// 关闭对话框
function close() {
  visible.value = false;
  authStore.clearError();
  resetForm();
}

// 重置表单
function resetForm() {
  form.email = '';
  form.password = '';
  form.confirmPassword = '';
  form.username = '';
  isLoginMode.value = true;
  formRef.value?.clearValidate();
}

// 提交表单
async function handleSubmit() {
  if (!formRef.value) return;

  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  let success = false;

  if (isLoginMode.value) {
    success = await authStore.login(form.email, form.password);
  } else {
    success = await authStore.register(form.email, form.password, form.username || undefined);
  }

  if (success) {
    ElMessage.success(isLoginMode.value ? t('auth.loginSuccess') : t('auth.registerSuccess'));
    emit('success');
    close();
  }
}

// 对话框关闭时重置
watch(visible, (val) => {
  if (!val) {
    resetForm();
  }
});
</script>

<style scoped>
.login-dialog :deep(.el-dialog__body) {
  padding-top: 10px;
  padding-bottom: 10px;
}

.login-content {
  .mb-4 {
    margin-bottom: 16px;
  }
}

.mode-switch {
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
  color: var(--el-text-color-regular);
}
</style>
