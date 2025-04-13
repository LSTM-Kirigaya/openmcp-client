const pinkLogStyle = 'background-color: #CB81DA; color: white; padding: 3px; border-radius: 3px;';
const redLogStyle = 'background-color:rgb(227, 91, 49); color: white; padding: 3px; border-radius: 3px;';


/**
 * @description 粉色log, 代表客户端发送的信息
 * @param message 
 */
export function pinkLog(message: string) {
    console.log('%c' + message, pinkLogStyle);
}

/**
 * @description 红色log, 代表错误信息
 * @param message 
 */
export function redLog(message: string) {
    console.log('%c' + message, redLogStyle);
}

/**
 * @description 绿色log, 代表服务器发送的信息
 * @param message 
 */
export function greenLog(message: string) {
    console.log('%c' + message, 'background-color:rgb(100, 200, 100); color: white; padding: 3px; border-radius: 3px;');
}