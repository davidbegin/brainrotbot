import winston from 'winston';
import { env } from '../config/env';

// Custom JSON replacer to handle BigInt serialization
const bigIntReplacer = (key: string, value: any) => {
  // Convert BigInt values to strings with a suffix indicating they're BigInts
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'dm-ip' },
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ level, message, timestamp, ...meta }) => {
            const metaStr = Object.keys(meta).length 
              ? `\n${JSON.stringify(meta, bigIntReplacer, 2)}`
              : '';
            return `${timestamp} ${level}: ${message}${metaStr}`;
          }
        )
      )
    }),
  ],
});

export default logger;