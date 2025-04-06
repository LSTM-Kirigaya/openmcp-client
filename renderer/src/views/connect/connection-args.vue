<template>
    <!-- STDIO 模式下的命令输入 -->
    <div class="connection-option" v-if="connectionMethods.current === 'STDIO'">
        <span>{{ t('command') }}</span>
        <span style="width: 310px;">
            <el-form :model="connectionArgs" :rules="rules" ref="stdioForm">
                <el-form-item prop="commandString">
                    <el-input v-model="connectionArgs.commandString"></el-input>
                </el-form-item>
            </el-form>
        </span>
    </div>

    <!-- 其他模式下的URL输入 -->
    <div class="connection-option" v-else>
        <span>{{ "URL" }}</span>
        <span style="width: 310px;">
            <el-form :model="connectionArgs" :rules="rules" ref="urlForm">
                <el-form-item prop="urlString">
                    <el-input v-model="connectionArgs.urlString" placeholder="http://"></el-input>
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