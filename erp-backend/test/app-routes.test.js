const test = require('node:test');
const assert = require('node:assert/strict');

const originalLog = console.log;
const originalError = console.error;
const originalEmitWarning = process.emitWarning;

console.log = () => {};
console.error = () => {};
process.emitWarning = () => {};
const app = require('../src/app');
console.log = originalLog;
console.error = originalError;
process.emitWarning = originalEmitWarning;

const hasMountedRouter = (path) =>
  app.router.stack.some((layer) => {
    if (!layer.handle?.stack || !Array.isArray(layer.matchers)) {
      return false;
    }

    return layer.matchers.some((match) => {
      try {
        return Boolean(match(path));
      } catch {
        return false;
      }
    });
  });

test('finance app exposes targets and money flow but not budgets', () => {
  assert.equal(hasMountedRouter('/api/targets'), true);
  assert.equal(hasMountedRouter('/api/money-flow'), true);
  assert.equal(hasMountedRouter('/api/budgets'), false);
});
