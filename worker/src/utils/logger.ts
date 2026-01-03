/**
 * Simple logger with timestamps and levels
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const colors = {
  DEBUG: '\x1b[90m',   // Gray
  INFO: '\x1b[36m',    // Cyan
  WARN: '\x1b[33m',    // Yellow
  ERROR: '\x1b[31m',   // Red
  RESET: '\x1b[0m',
};

function formatTime(): string {
  return new Date().toISOString().replace('T', ' ').split('.')[0];
}

function log(level: LogLevel, context: string, message: string, data?: unknown): void {
  const color = colors[level];
  const reset = colors.RESET;
  const timestamp = formatTime();
  
  console.log(`${color}[${timestamp}] [${level}] [${context}]${reset} ${message}`);
  
  if (data) {
    console.log(`${color}  └─${reset}`, data);
  }
}

export const logger = {
  debug: (context: string, message: string, data?: unknown) => log('DEBUG', context, message, data),
  info: (context: string, message: string, data?: unknown) => log('INFO', context, message, data),
  warn: (context: string, message: string, data?: unknown) => log('WARN', context, message, data),
  error: (context: string, message: string, data?: unknown) => log('ERROR', context, message, data),
};

export default logger;
