export let VSCODE_WORKSPACE = '';
export let RUNNING_CWD = '';
export let DEFAULT_LANG = 'zh';
export let REFLUX_HOME = '';
export let FORBIDDEN_MONITOR = false;

export function setVscodeWorkspace(workspace: string) {
    VSCODE_WORKSPACE = workspace;
}

export function setRunningCWD(path: string) {
    RUNNING_CWD = path;
}

export function setDefaultLang(lang: string) {
    DEFAULT_LANG = lang;
}

export function setRefluxHome(path: string) {
    REFLUX_HOME = path;
}

export function setForbiddenMonitor(flag: boolean) {
    FORBIDDEN_MONITOR = flag;
}