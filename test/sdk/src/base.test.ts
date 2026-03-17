import path from 'path';
import { fileURLToPath } from 'url';
import { OmAgent } from '../../../openmcp-sdk/src/index.js';
import { useMcpConfig } from './global.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function test(userInput: string) {
    const agent = new OmAgent();
    agent.loadMcpConfig(useMcpConfig('word-mcp'));
    const prompt = await agent.getPrompt('word_operations_prompt', {});
    const query = prompt + '\n' + userInput;

    const refluxDir = path.resolve(__dirname, '..', 'dataset');

    const result = await agent.ainvoke({
        messages: query,
        until: { toolName: 'word_save_document' },
        reflux: {
            enabled: true,
            saveDir: refluxDir,
            datasetName: 'word-mcp'
        }
    });

    console.log('test result: ', result);
}

test('请帮我创建一份基础的介绍 python 学习路径的文档');
