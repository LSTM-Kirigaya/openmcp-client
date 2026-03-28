<template>
    <div class="setting-section">
        <h2>{{ t('cloud-projects-title') }}</h2>
        <div class="setting-options">
            <div class="setting-option">
                <span class="option-title">{{ t('runtime-mode') }}</span>
                <el-segmented
                    :model-value="cloudContext.mode"
                    :options="modeOptions"
                    @change="handleModeChange"
                />
            </div>
            <div class="setting-option" v-if="cloudContext.mode === 'cloud'">
                <span class="option-title">{{ t('cloud-current-project') }}</span>
                <div style="width: 260px;">
                    <el-select
                        :model-value="cloudContext.currentProjectId"
                        :placeholder="t('cloud-select-project')"
                        style="width: 100%;"
                        @change="setCurrentCloudProject"
                    >
                        <el-option
                            v-for="item in projects"
                            :key="item.id"
                            :label="item.name"
                            :value="item.id"
                        />
                    </el-select>
                </div>
            </div>
            <div class="setting-option actions">
                <el-button :disabled="!isCloudLoggedIn" @click="loadProjects">
                    {{ t('refresh') }}
                </el-button>
                <el-button type="primary" :disabled="!isCloudLoggedIn" @click="openCreateDialog">
                    {{ t('add') }}
                </el-button>
            </div>
        </div>

        <el-table :data="projects" border size="small" class="project-table">
            <el-table-column prop="name" :label="t('cloud-project-name')" min-width="160" />
            <el-table-column prop="transport" :label="t('connection-type')" width="100" />
            <el-table-column prop="endpoint" :label="t('cloud-project-endpoint')" min-width="220" />
            <el-table-column prop="enabled" :label="t('status')" width="90">
                <template #default="{ row }">
                    <el-tag :type="row.enabled ? 'success' : 'info'">
                        {{ row.enabled ? t('enabled') : t('disabled') }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column :label="t('operation-setting')" width="190">
                <template #default="{ row }">
                    <el-button text type="primary" @click="openEditDialog(row)">{{ t('edit') }}</el-button>
                    <el-button text type="danger" @click="removeProject(row.id)">{{ t('delete') }}</el-button>
                </template>
            </el-table-column>
        </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? t('edit') : t('add')" width="520px">
        <el-form :model="form" label-position="top">
            <el-form-item :label="t('cloud-project-name')" required>
                <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item :label="t('connection-type')" required>
                <el-select v-model="form.transport" style="width: 100%;">
                    <el-option label="http" value="http" />
                    <el-option label="sse" value="sse" />
                    <el-option label="stdio" value="stdio" />
                </el-select>
            </el-form-item>
            <el-form-item :label="t('cloud-project-endpoint')" required>
                <el-input v-model="form.endpoint" />
            </el-form-item>
            <el-form-item :label="t('description')">
                <el-input v-model="form.description" type="textarea" />
            </el-form-item>
            <el-form-item :label="t('status')">
                <el-switch v-model="form.enabled" />
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="dialogVisible = false">{{ t('cancel') }}</el-button>
            <el-button type="primary" @click="submitProject">{{ t('save') }}</el-button>
        </template>
    </el-dialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { cloudCreateProject, cloudDeleteProject, cloudListProjects, cloudUpdateProject, type CloudProject } from '@/api/cloud';
import { isCloudLoggedIn } from '@/hook/cloud-auth';
import { cloudContext, setCurrentCloudProject, setRuntimeMode } from '@/hook/cloud-context';

defineComponent({ name: 'CloudProjectsSetting' });

const { t } = useI18n();

const projects = ref<CloudProject[]>([]);
const dialogVisible = ref(false);
const editingId = ref('');
const form = ref({
    name: '',
    transport: 'http' as 'stdio' | 'sse' | 'http',
    endpoint: '',
    description: '',
    enabled: true
});

const modeOptions = computed(() => [
    { label: t('runtime-mode-local'), value: 'local' },
    { label: t('runtime-mode-cloud'), value: 'cloud' }
]);

function handleModeChange(value: unknown) {
    if (value === 'cloud' || value === 'local') {
        setRuntimeMode(value);
    }
}

async function loadProjects() {
    if (!isCloudLoggedIn.value) {
        projects.value = [];
        return;
    }
    try {
        projects.value = await cloudListProjects();
        if (!projects.value.some(item => item.id === cloudContext.currentProjectId)) {
            setCurrentCloudProject(projects.value[0]?.id || '');
        }
    } catch (err: any) {
        ElMessage.error(err?.message || t('cloud-load-projects-failed'));
    }
}

function openCreateDialog() {
    editingId.value = '';
    form.value = {
        name: '',
        transport: 'http',
        endpoint: '',
        description: '',
        enabled: true
    };
    dialogVisible.value = true;
}

function openEditDialog(project: CloudProject) {
    editingId.value = project.id;
    form.value = {
        name: project.name,
        transport: project.transport,
        endpoint: project.endpoint,
        description: project.description || '',
        enabled: project.enabled
    };
    dialogVisible.value = true;
}

async function submitProject() {
    if (!form.value.name || !form.value.transport || !form.value.endpoint) {
        ElMessage.warning(t('cloud-project-required'));
        return;
    }
    try {
        if (editingId.value) {
            await cloudUpdateProject(editingId.value, form.value);
            ElMessage.success(t('cloud-project-updated'));
        } else {
            const created = await cloudCreateProject(form.value);
            ElMessage.success(t('cloud-project-created'));
            if (!cloudContext.currentProjectId) {
                setCurrentCloudProject(created.id);
            }
        }
        dialogVisible.value = false;
        await loadProjects();
    } catch (err: any) {
        ElMessage.error(err?.message || t('error'));
    }
}

async function removeProject(id: string) {
    try {
        await cloudDeleteProject(id);
        if (cloudContext.currentProjectId === id) {
            setCurrentCloudProject('');
        }
        ElMessage.success(t('cloud-project-deleted'));
        await loadProjects();
    } catch (err: any) {
        ElMessage.error(err?.message || t('error'));
    }
}

onMounted(() => {
    loadProjects();
});
</script>

<style scoped>
.actions {
    justify-content: flex-end;
}

.project-table {
    margin-top: 14px;
}
</style>
