const pinkLogStyle = 'background-color: #CB81DA; color: white; padding: 3px; border-radius: 3px;';
const redLogStyle = 'background-color:rgb(227, 91, 49); color: white; padding: 3px; border-radius: 3px;';

export function pinkLog(message: string) {
    console.log('%c' + message, pinkLogStyle);
}

export function redLog(message: string) {
    console.log('%c' + message, redLogStyle);
}