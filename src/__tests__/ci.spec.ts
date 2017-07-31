import 'mocha';
import * as pmock from 'pmock';
import * as assert from 'assert';

import {checkPresence} from '../ci';


describe('checkPresence()', function () {
  it('handles matching objects', function () {
    assert.equal(checkPresence({'FOO': 'foo', 'BAR': 'bar'}), false);

    pmock.env({
      'FOO': 'foo',
      'BAR': 'bar'
    }, () => {
      assert.equal(checkPresence({'FOO': 'foo', 'BAR': 'bar'}), true);
    })
  });

  it('handles matching single vars', function () {
    assert.equal(checkPresence("FOOBARCHIZ"), false);

    pmock.env({
      'FOOBARCHIZ': 'true',
    }, () => {
      assert.equal(checkPresence("FOOBARCHIZ"), true);
    })
  });
});