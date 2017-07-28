import 'mocha';
import * as assert from 'assert';
import {removeFileNameHash, removeBaseFolder} from '../hashparse';


describe('removing the base folder from a filename', function () {
  it('handles base folder without trailing slash', function () {
    assert.equal(removeBaseFolder('/foo', '/foo/test.js'), 'test.js');
  });

  it('handles base folder with a trailing slash', function () {
    assert.equal(removeBaseFolder('/foo/', '/foo/test.js'), 'test.js');
  });
});


describe('parsing a hash from a filename', function () {
  it('does nothing if the number of parts is too small', function () {
    assert.equal(removeFileNameHash('test....exe'), 'test....exe');
    assert.equal(removeFileNameHash('/foo/test.exe'), '/foo/test.exe');
  });

  it('handles multi-part filenames without a valid hash', function () {
    assert.equal(removeFileNameHash('test.rosemary.js.map'), 'test.rosemary.js.map');
    assert.equal(removeFileNameHash('0000.rosemary____js.map'), '0000.rosemary____js.map');
  });

  it('handles a hash in various places', function () {
    assert.equal(removeFileNameHash('test.a43ff0.js.map'), 'test.js.map');
    assert.equal(removeFileNameHash('a43ff0-test.js.map'), 'test.js.map');
  });

  it('handles two potential hashes', function () {
    // Uses the one further to the end
    assert.equal(removeFileNameHash('test.a43ff0.00000.js.map'), 'test.a43ff0.js.map');
    // But not if it's the last one, possibly an extension
    assert.equal(removeFileNameHash('a43ff0-test.js.map.12345'), 'test.js.map.12345');
  });
});

// TODO: test that finding the files in a directory "./dist", returns "dist" as the root, without the ./ prefix.
// Also for globs, as well as single files (i.e. all the path.normalize calls)