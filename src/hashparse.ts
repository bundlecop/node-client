/**
 * If a filename has a hash we want to remove that from the filename,
 * such that between two builds we still know which file is which file.
 *
 * This is a though thing to do automatically, but we try to smart
 * without trying too hard.
 */

import * as path from 'path';


const SEPARATOR_CHARACTERS = Array.from('._:-');
const SEPARATOR_CHARACTERS_ARRAY = '._:-';


export function removeBaseFolder(baseFolder: string, fullFileName: string) {
  if (fullFileName.startsWith(baseFolder)) {
    fullFileName = fullFileName.slice(baseFolder.length);
  }
  if (fullFileName.length && fullFileName[0] == path.sep) {
    fullFileName = fullFileName.slice(1);
  }
  return fullFileName;
}


export function removeFileNameHash(fileName: string): {filename: string, hash: string} {
  // Remove any directory part that there may be.
  const baseDirectory = path.dirname(fileName);
  const basename = path.basename(fileName);

  // Split the filename into parts by non-characters.
  // TODO: Insert SEPARATOR_CHARACTERS here.
  const parts = fileName.split(/([^._:-]+)/).filter(p => !!p);

  // Are there at least three non-separator parts (a base,
  // a hash, an extenion)? If not, there is nothing for
  // us to do.
  if (countNonSeperatorElements(parts) < 3) {
    return {filename: fileName, hash: ""};
  }

  // Are there potential hashes?
  const hashIndices = identifyPotentialHashes(parts);
  if (hashIndices.length == 0) {
    return {filename: fileName, hash: ""};
  }
  else if (hashIndices.length == 1) {
    return rebuildWithoutIndex(parts, hashIndices[0], baseDirectory);
  }
  else {
    // Give preference to the last possible hash, except if it's
    // the last element in the parts list, in which case it should
    // be an extension.
    const lastIndex = hashIndices[hashIndices.length-1];
    const indexToUse = (lastIndex == parts.length - 1)
      ? hashIndices[hashIndices.length-2]
      : lastIndex;
    return rebuildWithoutIndex(parts, indexToUse, baseDirectory);
  }
}


function rebuildWithoutIndex(parts: string[], indexToRemove: number, baseDir: string) {
  // Make a copy
  parts = parts.slice();

  // Remove the element in question
  const [hash] = parts.splice(indexToRemove, 1);

  // Adjust one of the seperators.
  let seperatorIndexToAdjust;
  if (indexToRemove == 0) {
    // Adjust the now "next" separator
    seperatorIndexToAdjust = 0;
  }
  else {
    // Adjust the previous one
    seperatorIndexToAdjust = indexToRemove - 1;
  }
  if (parts[seperatorIndexToAdjust].length == 1) {
    // Remove completely
    delete parts[seperatorIndexToAdjust];
  }
  else {
    parts[seperatorIndexToAdjust] = parts[seperatorIndexToAdjust].slice(0, -1);
  }

  const newFilename = parts.join('');
  return {filename: path.join(baseDir, newFilename), hash};
}


function countNonSeperatorElements(parts: string[]) {
  const nonSepElements = parts.filter(part => {
    const nonSeps = Array.from(part).filter(
      character => SEPARATOR_CHARACTERS_ARRAY.indexOf(character) == -1)
    return nonSeps.length > 0;
  });

  return nonSepElements.length;
}


/**
 * A hash is min. 5 character and hexadecimal.
 */
function identifyPotentialHashes(parts: string[]) {
  const indices: number[] = [];
  parts.forEach((part, index) => {
    if (part.length < 5) {
      return;
    }

    if (/^[0-9a-fA-F]+$/.test(part)) {
      indices.push(index);
    }
  });

  return indices;
}