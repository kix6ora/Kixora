/**
 * Kixora Server-Side Structured Logger
 */
import { sanitizeDataForLogging } from './src/utils/security';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export interface LogContext {
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  userId?: string;
  [key: string]: any;
}

class ServerLogger {
  private isProduction = typeof process !== 'undefined'
    ? process.env.NODE_ENV === 'production'
    : (import.meta as any).env?.PROD === true;

  private log(level: LogLevel, message: string, context: LogContext = {}) {
    // Sanitize context
    const sanitizedContext = sanitizeDataForLogging(context);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...sanitizedContext
    };

    if (this.isProduction) {
      // Production: Structured JSON
      if (typeof process !== 'undefined') {
        process.stdout.write(JSON.stringify(logEntry) + '\n');
      } else {
        console.log(JSON.stringify(logEntry));
      }
    } else {
      // Development: Readable colorized (simulated)
      const color = level === LogLevel.ERROR ? '\x1b[31m' : level === LogLevel.WARN ? '\x1b[33m' : '\x1b[32m';
      console.log(`${color}[${level}]\x1b[0m ${message}`, sanitizedContext);
    }
  }

  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context);
  }

  debug(message: string, context?: LogContext) {
    if (!this.isProduction) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }
}

export const logger = new ServerLogger();
