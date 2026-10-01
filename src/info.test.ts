import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { infoRows, listValue, textValue } from './info';

describe('infoRows', () => {
  it('keeps only the fields that were set, in a stable order', () => {
    assert.deepEqual(infoRows({
      playwright: '1.63.0',
      environment: 'qa',
      user: 'ada',
      suite: '',
      defects: 'PAY-14, AUTH-2',
    }), [
      { label: 'User', value: 'ada' },
      { label: 'Environment', value: 'qa' },
      { label: 'Defects', value: 'PAY-14, AUTH-2' },
      { label: 'Playwright', value: '1.63.0' },
    ]);
  });
});

describe('metadata values', () => {
  it('reads text and comma-separated lists', () => {
    assert.equal(textValue(' qa '), 'qa');
    assert.equal(textValue(3), '3');
    assert.deepEqual(listValue('PAY-1, AUTH-2'), ['PAY-1', 'AUTH-2']);
    assert.deepEqual(listValue(['PAY-1', ' AUTH-2 ']), ['PAY-1', 'AUTH-2']);
  });
});
