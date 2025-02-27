import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

// Define environment variable schema for validation
const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE: z.string(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENPIPE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(), // Optional now
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000'),
  RATE_LIMIT_MAX: z.string().default('100'),
});

// Attempt to parse and validate environment variables
const envResult = envSchema.safeParse(process.env);

// Handle validation errors
if (!envResult.success) {
  console.error('❌ Invalid environment variables:', envResult.error.errors);
  throw new Error('Invalid environment variables');
}

// Export validated environment variables
export const env = envResult.data;