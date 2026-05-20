import chalk from 'chalk';

const brandColor = chalk.hex('#8B5CF6');

export const logger = {
  brand: (text: string) => console.log(brandColor.bold(text)),
  info: (text: string) => console.log(chalk.gray(text)),
  success: (text: string) => console.log(chalk.green(text)),
  warn: (text: string) => console.log(chalk.yellow(text)),
  error: (text: string) => console.error(chalk.red(text)),
  url: (text: string) => chalk.cyan.underline(text),
  dim: (text: string) => chalk.gray(text),
  white: (text: string) => chalk.white(text),
};
