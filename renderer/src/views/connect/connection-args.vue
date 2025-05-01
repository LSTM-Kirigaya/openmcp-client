<template>
    <!-- STDIO 模式下的命令输入 -->
    <div class="connection-option" v-if="connectionMethods.current === 'STDIO'">
        <span>{{ t('connect-sigature') }}</span>
        <span style="width: 310px;">
            <el-form :model="connectionArgs" :rules="rules" ref="stdioForm">
                <el-form-item prop="commandString">
                    <div class="input-with-label">
                        <span class="input-label">命令</span>
                        <el-input v-model="connectionArgs.commandString" placeholder="mcp run <your script>"></el-input>
                    </div>
                </el-form-item>
                <el-form-item prop="cwd">
                    <div class="input-with-label">
                        <span class="input-label">执行目录</span>
                        <el-input v-model="connectionArgs.cwd" placeholder="cwd, 可为空"></el-input>
                    </div>
                </el-form-item>
            </el-form>
        </span>
    </div>

    <!-- SSE 模式下的URL输入 -->
    <div class="connection-option" v-else>
        <span>{{ t('connect-sigature') }}</span>
        <span style="width: 310px;">
            <el-form :model="connectionArgs" :rules="rules" ref="urlForm">
                <el-form-item prop="urlString">
                    <div class="input-with-label">
                        <span class="input-label">URL</span>
                        <el-input v-model="connectionArgs.urlString" placeholder="http://"></el-input>
                    </div>
                </el-form-item>
                <el-form-item prop="oauth">
                    <div class="input-with-label">
                        <span class="input-label">OAuth</span>
                        <el-input v-model="connectionArgs.oauth" placeholder="认证签名, 可为空"></el-input>
                    </div>
                </el-form-item>
            </el-form>
        </span>
    </div>
</template>

<script setup lang="ts">
import { defineComponent, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { connectionArgs, connectionMethods } from './connection';

const { t } = useI18n();

const stdioForm = ref<FormInstance>()
const urlForm = ref<FormInstance>()

// 验证规则
const rules = reactive<FormRules>({
    commandString: [
        { required: true, message: '命令不能为空', trigger: 'blur' }
    ],
    cwd: [
        { required: false, trigger: 'blur' }
    ],
    oauth: [
        { required: false, trigger: 'blur' }
    ],
    urlString: [
        { required: true, message: 'URL不能为空', trigger: 'blur' }
    ]
})

// 验证当前活动表单
const validateForm = async () => {
    try {
        if (connectionMethods.current === 'STDIO') {
            await stdioForm.value?.validate()
        } else {
            await urlForm.value?.validate()
        }
        return true
    } catch (error) {
        ElMessage.error('请填写必填字段')
        return false
    }
}

</script>

<style scoped>
.input-with-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    width: 100%;
}

.input-label {
    width: 80px;
    font-size: 14px;
    color: var(--el-text-color-regular);
}

.connection-option {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background-color: var(--el-bg-color);
    border-radius: 4px;
    margin-bottom: 16px;
}
</style>