import type { CloudProject } from '@/api/cloud';

/** 与本地 Server 编辑/添加一致的连接表单（云端保存时再映射为 transport + endpoint） */
export interface McpConnectionFormState {
	name: string;
	connectionType: string;
	cmdText: string;
	cwd: string;
	url: string;
	oauth: string;
	envList: { key: string; value: string }[];
	description: string;
}

export function createEmptyMcpConnectionForm(): McpConnectionFormState {
	return {
		name: '',
		connectionType: 'STDIO',
		cmdText: '',
		cwd: '',
		url: '',
		oauth: '',
		envList: [],
		description: ''
	};
}

export function cloudProjectToConnectionForm(project: CloudProject): McpConnectionFormState {
	let connectionType: string;
	if (project.transport === 'stdio') {
		connectionType = 'STDIO';
	} else if (project.transport === 'sse') {
		connectionType = 'SSE';
	} else {
		connectionType = 'STREAMABLE_HTTP';
	}
	return {
		name: project.name || '',
		connectionType,
		cmdText: project.transport === 'stdio' ? project.endpoint : '',
		cwd: '',
		url: project.transport === 'stdio' ? '' : project.endpoint,
		oauth: '',
		envList: [],
		description: project.description || ''
	};
}

export type CloudProjectWritePayload = {
	name: string;
	transport: 'stdio' | 'sse' | 'http';
	endpoint: string;
	description?: string;
	enabled: boolean;
};

export function connectionFormToCloudWritePayload(
	form: McpConnectionFormState,
	opts: { enabled: boolean }
): CloudProjectWritePayload {
	let transport: 'stdio' | 'sse' | 'http';
	let endpoint: string;
	if (form.connectionType === 'STDIO') {
		transport = 'stdio';
		endpoint = form.cmdText.trim();
	} else if (form.connectionType === 'SSE') {
		transport = 'sse';
		endpoint = form.url.trim();
	} else {
		transport = 'http';
		endpoint = form.url.trim();
	}
	const description = (form.description ?? '').trim();
	return {
		name: form.name.trim(),
		transport,
		endpoint,
		description: description || undefined,
		enabled: opts.enabled
	};
}

/** 返回 i18n 键，无错误时返回 null */
export function validateMcpConnectionForm(form: McpConnectionFormState): string | null {
	if (!form.name?.trim()) {
		return 'server-name-required';
	}
	if (form.connectionType === 'STDIO') {
		if (!form.cmdText?.trim()) {
			return 'server-command-required';
		}
	} else if (!form.url?.trim()) {
		return 'server-url-required';
	}
	return null;
}
