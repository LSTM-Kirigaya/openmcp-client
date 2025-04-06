import { useMessageBridge } from '@/api/message-bridge';
import { reactive } from 'vue';

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


// 定义连接类型
type ConnectionType = 'STDIO' | 'SSE';

// 定义命令行参数接口
export interface MCPOptions {
    connectionType: ConnectionType;
    // STDIO 特定选项
    command?: string;
    args?: string[];
    // SSE 特定选项
    url?: string;
    // 通用客户端选项
    clientName?: string;
    clientVersion?: string;
}

export function doConnect() {
    let connectOption: MCPOptions;

    if (connectionMethods.current === 'STDIO') {

        if (connectionArgs.commandString.length === 0) {
            return;
        }

        const commandComponents = connectionArgs.commandString.split(/\s+/g);
        const command = commandComponents[0];
        commandComponents.shift();
        
        connectOption = {
            connectionType: 'STDIO',
            command: command,
            args: commandComponents,
            clientName: 'openmcp.connect.stdio.' + command,
            clientVersion: '0.0.1'
        }

    } else {
        const url = connectionArgs.urlString;

        if (url.length === 0) {
            return;
        }

        connectOption = {
            connectionType: 'SSE',
            url: url,
            clientName: 'openmcp.connect.sse',
            clientVersion: '0.0.1'
        }
    }

    const bridge = useMessageBridge();
    bridge.postMessage({
        command: 'connect',
        data: connectOption
    });
}

export function doReconnect() {
    // TODO: finish this
    console.log();
}

export const connectionResult = reactive({
    success: false,
    logString: ''
});