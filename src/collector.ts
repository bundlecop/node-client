require('core-js/fn/symbol/async-iterator');

import * as fs from 'fs';
import * as path from 'path';
import * as recursive from 'recursive-readdir';
import * as gzipSize from 'gzip-size';
import * as commonPathPrefix from 'common-path-prefix';
import * as minimatch from 'minimatch';
import * as glob from 'glob';
import {FileReading} from './api';
import {removeFileNameHash, removeBaseFolder} from './hashparse';


export class FileResolveError extends Error {};


interface FileSpecToBeMeasured {
  root: string;
  filename: string;
}


interface FileWithMeasurement extends FileSpecToBeMeasured {
  gzipSize: number|null;
  rawSize: number|null;
  hash: string;
  // The "stable" name, without hash, that we can use as an id.
  name: string;
}


// Helper to work around the fact that ES right now doesn't have a
// builtin way to convert an async iterator to an array, or to loop
// over it.
// https://github.com/tc39/proposal-async-iteration/issues/103
async function syncifyAsyncIterator<T>(iterator: AsyncIterable<T>): Promise<T[]> {
  const result = [];
  for await (const x of iterator) {
    result.push(x);
  }
  return result;
}


/**
 * For every given file in the iterator, return the actual file size
 * and the raw size. Also remove the hash and normalize the filename.
 */
async function* measureFileSizes(fileIterator: AsyncIterable<FileSpecToBeMeasured>): AsyncIterableIterator<FileWithMeasurement> {
  for await (let {root, filename} of fileIterator) {
    // Make sure we remove any ./ from the beginning of files
    root = root ? path.normalize(root) : "";  // Avoid a single "."
    filename = path.normalize(filename);

    const baseName = removeBaseFolder(root, filename);
    const {filename: relativeName, hash} = removeFileNameHash(baseName);
    yield {
      name: relativeName,
      root,
      filename,
      hash,
      gzipSize: gzipSize.sync(fs.readFileSync(filename)),
      rawSize: getFilesizeInBytes(filename)
    }
  };
}


/**
 * Return the size of a file.
 */
function getFilesizeInBytes(filename: string) {
  const stats = fs.statSync(filename);
  const fileSizeInBytes = stats.size;
  return fileSizeInBytes;
};


async function* findFilesInDirectory(directory: string, include: string, exclude: string): AsyncIterable<FileSpecToBeMeasured> {
  if (!include && !exclude) {
    include = parseIncludePattern(DEFAULT_INCLUDE_PATTERN);
  }

  let fileNames: string[] = await (recursive as any)(directory);
  fileNames = fileNames.filter(fileName => {
    let shouldBeIncluded;
    if (include) {
      shouldBeIncluded = minimatch(fileName, include, {matchBase: true});
    }
    else {
      shouldBeIncluded = true;
    }

    if (exclude) {
      shouldBeIncluded = minimatch(fileName, exclude, {matchBase: true});
    }

    return shouldBeIncluded;
  });

  if (!fileNames.length) {
    throw new FileResolveError(`No files found in directory "${directory}" with include pattern "${include}" and exclude pattern "${exclude}".`);
  }

  for (let fileName of fileNames) {
    yield {root: directory, filename: fileName};
  }
}

type FileMatchExpr = string;
interface FileMatchingOptions {
  // Only used for searching directories.
  includePattern?: string;
  excludePattern?: string;
}

// Exclude takes precedence so these defaults can be overwritten easily.
const DEFAULT_INCLUDE_PATTERN = ".js .jsx .js.map .ts .tsx .css .json .jpg .jpeg .gif .png";


// Rather than a true glob pattern, users may just give a list of file extensions.
function parseIncludePattern(pattern: string) {
  if (!pattern) {
    return pattern;
  }

  if (glob.hasMagic(pattern)) {
    return pattern;
  }

  const parts = pattern.split(/[,; ]/);
  const patternString = parts.map(p => `*${p}`).join(',')
  return `{${patternString}}`;
}


/**
 * Returns a file list from multiple expressions; each expression can be a file,
 * a directory, or a glob.
 *
 * Deduplicates.
 */
export async function* resolveFileExpressions(
    exprs: FileMatchExpr[],
    matchingOpts: FileMatchingOptions): AsyncIterable<FileSpecToBeMeasured>
{
  const alreadyFound: FileSpecToBeMeasured[] = [];
  function add(file: FileSpecToBeMeasured) {
    // TODO: Remove duplicates
    alreadyFound.push(file);
  }

  for (const expr of exprs) {
    // Is it a glob?
    //
    // I'd like to use https://github.com/micromatch/micromatch, but it seems
    // there isn't any library that handles traversing the actual file system;
    // We'd have to first find *all* files, then filter, which is ridiculous.
    // See https://github.com/isaacs/node-glob/issues/332
    if (glob.hasMagic(expr)) {
      const files = glob.sync(expr);
      if (!files.length) {
        throw new FileResolveError(`The glob expression "${expr}" does not mach any files`);
      }

      const prefix = commonPathPrefix(files);
      for (const file of files) {
        add({
          root: prefix,
          filename: file
        })
      }
    }

    else {
      let isDir;
      try {
        isDir = fs.lstatSync(expr).isDirectory();
      }
      catch (e) {
        throw new FileResolveError(`No such file or directory: ${expr}`)
      }

      if (isDir) {
        const findFilesIter = findFilesInDirectory(
          expr,
          parseIncludePattern(matchingOpts.includePattern || ""),
          parseIncludePattern(matchingOpts.excludePattern || "")
        );

        for await (const iter of findFilesIter) {
          add(iter);
        }
      }
      else {
        // Add a single file, as given
        add({
          root: '',
          filename: expr
        })
      }
    }
  };

  for (const result of alreadyFound) {
    yield result;
  }
}


/**
 * Find all the files in `directory`, measure them, return an array.
 */
export async function readFilesFromDirectories(
    expr: string[],
    matchingOpts: FileMatchingOptions): Promise<FileWithMeasurement[]>
{
  const iterator = resolveFileExpressions(expr, matchingOpts);
  const fileSizesIterator = measureFileSizes(iterator);
  return syncifyAsyncIterator(fileSizesIterator);
}


/**
 * Measure the size of all files in the list, return an array. This
 * is a wrapper around the internal function that resolves the async
 * iterator.
 */
export async function measureFileList(fileList: string[]): Promise<FileWithMeasurement[]> {
  const iterator = measureFileSizes(fileList as any);
  return syncifyAsyncIterator(iterator);
}