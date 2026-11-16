import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

export default ts.config(
  { ignores: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '.local/**', '**/*.min.js'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { languageOptions: { globals: globals.node }, rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }] } },
);
