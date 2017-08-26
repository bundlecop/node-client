/**
 * Helper for getting information from source control.
 */

import fromGitRepo from './git-repo-info.js';


export function getRepoInfo() {
  const {sha, branch, tag, path, parents, commitMessage} = fromGitRepo();

  if (!sha || !path) {
    return null;
  }

  return {
    system: "git",
    commitId: sha,
    commitMessage,
    branch,
    tag,
    parentCommitIds: parents.length ? parents : null
  }
}


