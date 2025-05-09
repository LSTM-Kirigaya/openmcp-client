import fsPath from 'node:path';
import fs from 'node:fs';
import * as process from "node:process";

function createDirIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true })
    }
}

function recreateDir(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }

    fs.mkdirSync(filePath, { recursive: true });
}

const currentDir = process.cwd();
// 确保上级目录的 openmcp-sdk 存在
const openMCPSdkPath = fsPath.join(currentDir, '..', 'openmcp-sdk')
createDirIfExists(openMCPSdkPath);

const sdkRenderPath = fsPath.join(openMCPSdkPath, 'renderer');
recreateDir(sdkRenderPath);

const sourceDist = fsPath.join(currentDir, 'dist');

// 如果源目录不存在则报错
if (!fs.existsSync(sourceDist)) {
    throw new Error(`Source directory not found: ${sourceDist}`)
}

fs.cpSync(sourceDist, sdkRenderPath, { recursive: true })

// electron目录
const electronOpenMcpSdkPath = fsPath.join(currentDir, '..', 'software', 'openmcp-sdk');
createDirIfExists(electronOpenMcpSdkPath);

const electronRendererPath = fsPath.join(electronOpenMcpSdkPath, 'renderer');
recreateDir(electronRendererPath);

fs.cpSync(sourceDist, electronRendererPath, { recursive: true })
