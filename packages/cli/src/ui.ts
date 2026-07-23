const useColor = Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
const ESC = String.fromCharCode(27);

function wrap(open: number, close: number) {
  return (s: string) => (useColor ? `${ESC}[${open}m${s}${ESC}[${close}m` : s);
}

export const color = {
  dim: wrap(2, 22),
  bold: wrap(1, 22),
  gray: wrap(90, 39),
  white: wrap(97, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  red: wrap(31, 39),
  blue: wrap(34, 39),
};

export const symbols = {
  ok: color.green('OK'),
  warn: color.yellow('!'),
  err: color.red('x'),
  dot: color.gray('.'),
  arrow: color.gray('->'),
};
