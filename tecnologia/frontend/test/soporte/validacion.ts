import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ correoApi: string }>({ correoApi: process.env['MAILPIT_API'] ?? 'http://127.0.0.1:8025' });
export { expect };
