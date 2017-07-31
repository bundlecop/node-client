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
    assert.deepEqual(removeFileNameHash('test....exe'), {filename: 'test....exe', hash: ''});
    assert.deepEqual(removeFileNameHash('/foo/test.exe'),  {filename: '/foo/test.exe', hash: ''});
  });

  it('handles multi-part filenames without a valid hash', function () {
    assert.deepEqual(removeFileNameHash('test.rosemary.js.map'),  {filename: 'test.rosemary.js.map', hash: ''});
    assert.deepEqual(removeFileNameHash('0000.rosemary____js.map'),  {filename: '0000.rosemary____js.map', hash: ''});
  });

  it('handles a hash in various places', function () {
    assert.deepEqual(removeFileNameHash('test.a43ff0.js.map'), {filename: 'test.js.map', hash: 'a43ff0'});
    assert.deepEqual(removeFileNameHash('a43ff0-test.js.map'), {filename: 'test.js.map', hash: 'a43ff0'});
  });

  it('handles two potential hashes', function () {
    // Uses the one further to the end
    assert.deepEqual(removeFileNameHash('test.a43ff0.00000.js.map'), {filename: 'test.a43ff0.js.map', hash: '00000'});
    // But not if it's the last one, possibly an extension
    assert.deepEqual(removeFileNameHash('a43ff0-test.js.map.12345'), {filename: 'test.js.map.12345', hash: 'a43ff0'});
  });
});

// TODO: test that finding the files in a directory "./dist", returns "dist" as the root, without the ./ prefix.
// Also for globs, as well as single files (i.e. all the path.normalize calls)