import chalk from 'chalk';

export const logger = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  error: (msg: string) => console.log(chalk.red('✖'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  debug: (msg: string) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('[debug]'), msg);
    }
  },
  newline: () => console.log(''),
  title: (msg: string) => console.log(chalk.bold.cyan('\n' + msg)),
  step: (step: number, total: number, msg: string) => {
    console.log(chalk.cyan(`[${step}/${total}]`), msg);
  }
};
