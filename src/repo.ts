/**
 * Helper for getting information from source control.
 */

import fromGitRepo from './git-repo-info.js';


export function getRepoInfo() {
  const {sha, branch, tag, path, parents} = fromGitRepo();

  if (!sha || !path) {
    return null;
  }

  return {
    system: "git",
    commitId: sha,
    branch,
    tag,
    parentCommitIds: parents.length ? parents : null
  }
}


