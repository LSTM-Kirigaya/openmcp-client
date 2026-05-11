/** 与本地 Server 编辑/添加一致的连接表单 */
export interface McpConnectionFormState {
	name: string;
	connectionType: string;
	cmdText: string;
	cwd: string;
	url: string;
	oauth: string;
	headers: Record<string, string>;
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
		headers: {},
		envList: [],
		description: ''
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
