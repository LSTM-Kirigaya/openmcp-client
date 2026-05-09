import fs from "node:fs";
import process from "node:process";
import fsPath from "node:path";

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
const sourceDist = fsPath.join(currentDir, 'dist');

// 如果源目录不存在则报错
if (!fs.existsSync(sourceDist)) {
    throw new Error(`Source directory not found: ${sourceDist}`)
}
// electron目录
const electronOpenMcpSdkPath = fsPath.join(currentDir, '..', 'software', 'openmcp-sdk');
createDirIfExists(electronOpenMcpSdkPath);

const electronServicePath = fsPath.join(electronOpenMcpSdkPath, 'service');
recreateDir(electronServicePath);

fs.cpSync(sourceDist, electronServicePath, { recursive: true })

const openMCPSdkPath = fsPath.join(currentDir, '..', 'openmcp-sdk');
createDirIfExists(openMCPSdkPath);

const sdkRenderPath = fsPath.join(openMCPSdkPath, 'service');
recreateDir(sdkRenderPath);

// 如果源目录不存在则报错
if (!fs.existsSync(sourceDist)) {
    throw new Error(`Source directory not found: ${sourceDist}`)
}

fs.cpSync(sourceDist, sdkRenderPath, { recursive: true })