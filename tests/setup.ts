import { jest } from '@jest/globals';
import * as fs from 'fs-extra';
import * as path from 'path';

// Set test timeout
jest.setTimeout(10000);

// Mock console methods during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Test helpers
export const TEST_OUTPUT_DIR = path.join(__dirname, '.test-output');

// Clean up test output directory before each test
beforeEach(async () => {
  await fs.ensureDir(TEST_OUTPUT_DIR);
  await fs.emptyDir(TEST_OUTPUT_DIR);
});

// Clean up after all tests
afterAll(async () => {
  await fs.remove(TEST_OUTPUT_DIR);
});