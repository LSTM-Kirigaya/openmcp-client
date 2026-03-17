export function logTimeStampString() {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formatted = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} - ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return formatted;
}