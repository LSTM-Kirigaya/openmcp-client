export function getCurrentTime() {
    // 创建一个Date对象
    const date = new Date();
    // 获取年份
    const year: string | number = date.getFullYear();
    // 获取月份（0-11）
    let month: string | number = date.getMonth() + 1;
    // 获取日期（1-31）
    let day: string | number = date.getDate();
    // 获取小时（0-23）
    let hour: string | number = date.getHours();
    // 获取分钟（0-59）
    let minute: string | number = date.getMinutes();
    // 如果月份、日期、小时、分钟或秒钟小于10，则在前面补0
    month = month < 10 ? "0" + month : month;
    day = day < 10 ? "0" + day : day;
    hour = hour < 10 ? "0" + hour : hour;
    minute = minute < 10 ? "0" + minute : minute;
    // 拼接成字符串
    const timeStr = year + "年" + month + "月" + day + "日" + " " + hour + ":" + minute;
    return timeStr;
}