import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      'no-console': 'warn'
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        node: true,
      }
    },
    // Only lint TypeScript files in src
    files: ['src/**/*.ts'],
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', '*.js'],
  }
);