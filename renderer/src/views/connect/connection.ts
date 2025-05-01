import { useMessageBridge } from '@/api/message-bridge';
import { reactive } from 'vue';
import { pinkLog } from '../setting/util';
import { arrowMiddleware, ElMessage } from 'element-plus';
import { ILaunchSigature } from '@/hook/type';
import { OpenMcpSupportPlatform } from '@/api/platform';

export const connectionMethods = reactive({
    current: 'STDIO',
    data: [
        {
            value: 'STDIO',
            label: 'STDIO'
        },
        {
            value: 'SSE',
            label: 'SSE'
        }
    ]
});

export const connectionArgs = reactive({
    commandString: '',
    cwd: '',
    oauth: '',
    urlString: ''
});

export interface EnvItem {
    key: string
    value: string
}

export interface IConnectionEnv {
    data: EnvItem[]
    newKey: string
    newValue: string
}

export const connectionEnv = reactive<IConnectionEnv>({
    data: [],
    newKey: '',
    newValue: ''
});

export function makeEnv() {
    const env = {} as Record<string, string>;
    connectionEnv.data.forEach(item => {
        env[item.key] = item.value;
    });
    return env;
}


// 定义连接类型
type ConnectionType = 'STDIO' | 'SSE';

// 定义命令行参数接口
export interface McpOptions {
    connectionType: ConnectionType;
    // STDIO 特定选项
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    // SSE 特定选项
    url?: string;
    // 通用客户端选项
    clientName?: string;
    clientVersion?: string;
}

export async function doConnect(
    option: {
        namespace: OpenMcpSupportPlatform
        updateCommandString?: boolean
    }
) {
    const {
        // updateCommandString 为 true 代表是初始化阶段
        namespace,
        updateCommandString = true
    } = option;

    if (updateCommandString) {
        pinkLog('请求启动参数');
        const connectionItem = await getLaunchSignature(namespace + '/launch-signature');

        if (connectionItem.type ==='stdio') {
            connectionMethods.current = 'STDIO';
            connectionArgs.commandString = connectionItem.commandString;
            connectionArgs.cwd = connectionItem.cwd;

            if (connectionArgs.commandString.length === 0) {
                return;
            }
        } else {
            connectionMethods.current = 'SSE';
            connectionArgs.urlString = connectionItem.url;
            
            if (connectionArgs.urlString.length === 0) {
                return;
            }
        }
    }

    if (connectionMethods.current === 'STDIO') {
        await launchStdio(namespace);
    } else {
        await launchSSE(namespace);
    }
}

async function launchStdio(namespace: string) {
    const bridge = useMessageBridge();
    const env = makeEnv();

    const commandComponents = connectionArgs.commandString.split(/\s+/g);
    const command = commandComponents[0];
    commandComponents.shift();

    const connectOption = {
        connectionType: 'STDIO',
        command: command,
        args: commandComponents,
        cwd: connectionArgs.cwd,
        clientName: 'openmcp.connect.stdio',
        clientVersion: '0.0.1',
        env
    };

    const { code, msg } = await bridge.commandRequest('connect', connectOption);

    connectionResult.success = (code === 200);

    if (code === 200) {
        connectionResult.logString.push({
            type: 'info',
            message: msg
        });                

        const res = await getServerVersion() as { name: string, version: string };
        connectionResult.serverInfo.name = res.name || '';
        connectionResult.serverInfo.version = res.version || '';

        // 同步信息到 vscode
        const commandComponents = connectionArgs.commandString.split(/\s+/g);
        const command = commandComponents[0];
        commandComponents.shift();

        const clientStdioConnectionItem = {
            serverInfo: connectionResult.serverInfo,
            connectionType: 'STDIO',
            name: 'openmcp.connect.stdio',
            command: command,
            args: commandComponents,
            cwd: connectionArgs.cwd,
            env
        };

        bridge.postMessage({
            command: namespace + '/update-connection-sigature',
            data: JSON.parse(JSON.stringify(clientStdioConnectionItem))
        });

    } else {
        connectionResult.logString.push({
            type: 'error',
            message: msg
        });

        ElMessage({
            type: 'error',
            message: msg
        });
    }
}

async function launchSSE(namespace: string) {
    const bridge = useMessageBridge();
    const env = makeEnv();

    const connectOption: McpOptions = {
        connectionType: 'SSE',
        url: connectionArgs.urlString,
        clientName: 'openmcp.connect.sse',
        clientVersion: '0.0.1',
        env
    };

    const { code, msg } = await bridge.commandRequest('connect', connectOption);

    connectionResult.success = (code === 200);

    if (code === 200) {
        connectionResult.logString.push({
            type: 'info',
            message: msg
        });

        const res = await getServerVersion() as { name: string, version: string };
        connectionResult.serverInfo.name = res.name || '';
        connectionResult.serverInfo.version = res.version || '';
        
        // 同步信息到 vscode
        const clientSseConnectionItem = {
            serverInfo: connectionResult.serverInfo,
            connectionType: 'SSE',
            name: 'openmcp.connect.sse',
            url: connectionArgs.urlString,
            oauth: connectionArgs.oauth,
            env: env
        };

        bridge.postMessage({
            command: namespace + '/update-connection-sigature',
            data: JSON.parse(JSON.stringify(clientSseConnectionItem))
        });

    } else {
        connectionResult.logString.push({
            type: 'error',
            message: msg
        });

        ElMessage({
            type: 'error',
            message: msg
        });
    }
}


async function getLaunchSignature(signatureName: string) {
    const bridge = useMessageBridge();
    const { code, msg } = await bridge.commandRequest(signatureName);

    return msg;
}

export function doReconnect() {
    // TODO: finish this
    console.log();
}

export const connectionResult = reactive<{
    success: boolean,
    logString: { type: 'info' | 'error' | 'warning', message: string }[],
    serverInfo: {
        name: string,
        version: string
    }
}>({
    success: false,
    logString: [],
    serverInfo: {
        name: '',
        version: ''
    }
});

export function getServerVersion() {
    return new Promise((resolve, reject) => {
        const bridge = useMessageBridge();
        bridge.addCommandListener('server/version', data => {
            if (data.code === 200) {
                resolve(data.msg);
            } else {
                reject(data.msg);
            }
        }, { once: true });

        bridge.postMessage({
            command: 'server/version',
        });
    });
}

export const envVarStatus = {
    launched: false
};

function lookupEnvVar(varNames: string[]) {
    const bridge = useMessageBridge();

	return new Promise<string[] | undefined>((resolve, reject) => {
		bridge.addCommandListener('lookup-env-var', data => {
			const { code, msg } = data;
			
			if (code === 200) {
				connectionResult.logString.push({
					type: 'info',
					message: '预设环境变量同步完成'
				});

				resolve(msg);
			} else {
				connectionResult.logString.push({
					type: 'error',
					message: '预设环境变量同步失败: ' + msg
				});

				resolve(undefined);
			}
		}, { once: true });

		console.log(varNames);
		
		
		bridge.postMessage({
			command: 'lookup-env-var',
			data: {
				keys: varNames
			}
		})
	});
}


export async function handleEnvSwitch(enabled: boolean) {
	const presetVars = ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER'];

	if (enabled) {
		const values = await lookupEnvVar(presetVars);

		if (values) {
			// 将 key values 合并进 connectionEnv.data 中
			// 若已有相同的 key, 则替换 value
			for (let i = 0; i < presetVars.length; i++) {
				const key = presetVars[i];
				const value = values[i];
				const sameNameItems = connectionEnv.data.filter(item => item.key === key);
				if (sameNameItems.length > 0) {
					const conflictItem = sameNameItems[0];
					conflictItem.value = value;
				} else {
					connectionEnv.data.push({
						key: key, value: value
					});
				}
			}
		}
	} else {
		// 清空 connectionEnv.data 中所有 key 为 presetVars 的项
		const reserveItems = connectionEnv.data.filter(item => !presetVars.includes(item.key));
		connectionEnv.data = reserveItems;
	}
}

export async function loadEnvVar() {
    return await handleEnvSwitch(true);
}