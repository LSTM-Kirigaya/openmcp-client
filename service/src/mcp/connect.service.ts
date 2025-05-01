import { spawnSync } from 'node:child_process';
import { RequestClientType } from '../common';
import { connect } from './client.service';
import { RestfulResponse } from '../common/index.dto';
import { McpOptions } from './client.dto';


// TODO: 更多的 client
export let client: RequestClientType = undefined;

export function tryGetRunCommandError(command: string, args: string[] = [], cwd?: string): string | null {
    try {
		console.log('current command', command);
		console.log('current args', args);
		
        const result = spawnSync(command, args, {
            cwd: cwd || process.cwd(),
            stdio: 'pipe',
            encoding: 'utf-8'
        });

        if (result.error) {
            return result.error.message;
        }
        if (result.status !== 0) {
            return result.stderr || `Command failed with code ${result.status}`;
        }
        return null;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

export async function connectService(
    _client: RequestClientType,
    option: McpOptions
): Promise<RestfulResponse> {
	try {
		console.log('ready to connect', option);
		
		client = await connect(option);
		const connectResult = {
			code: 200,
			msg: 'Connect to OpenMCP successfully\nWelcome back, Kirigaya'
		};
		
        return connectResult;
	} catch (error) {

		// TODO: 这边获取到的 error 不够精致，如何才能获取到更加精准的错误
		// 比如	error: Failed to spawn: `server.py`
  		//		  Caused by: No such file or directory (os error 2)

		let errorMsg = '';

		if (option.command) {
			errorMsg += tryGetRunCommandError(option.command, option.args, option.cwd);
		}

		errorMsg += (error as any).toString();
		
		const connectResult = {
			code: 500,
			msg: errorMsg
		};

        return connectResult;
	}
}
