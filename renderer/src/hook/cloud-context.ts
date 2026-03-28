import { reactive } from 'vue';

const CLOUD_CONTEXT_KEY = 'openmcp.cloud.context';

export type RuntimeMode = 'local' | 'cloud';

interface CloudContextState {
    mode: RuntimeMode;
    currentProjectId: string;
}

export const cloudContext = reactive<CloudContextState>({
    mode: 'local',
    currentProjectId: ''
});

export function hydrateCloudContext() {
    const raw = localStorage.getItem(CLOUD_CONTEXT_KEY);
    if (!raw) {
        return;
    }
    try {
        const parsed = JSON.parse(raw) as Partial<CloudContextState>;
        if (parsed.mode === 'cloud' || parsed.mode === 'local') {
            cloudContext.mode = parsed.mode;
        }
        if (typeof parsed.currentProjectId === 'string') {
            cloudContext.currentProjectId = parsed.currentProjectId;
        }
    } catch {
        localStorage.removeItem(CLOUD_CONTEXT_KEY);
    }
}

export function setRuntimeMode(mode: RuntimeMode) {
    cloudContext.mode = mode;
    persistCloudContext();
}

export function setCurrentCloudProject(projectId: string) {
    cloudContext.currentProjectId = projectId;
    persistCloudContext();
}

function persistCloudContext() {
    localStorage.setItem(CLOUD_CONTEXT_KEY, JSON.stringify({
        mode: cloudContext.mode,
        currentProjectId: cloudContext.currentProjectId
    }));
}
