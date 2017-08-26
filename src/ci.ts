/**
 * Get information from a CI environment.
 */


type CIEvent = 'push'|'pull_request';
type MatchEnv = {[envKey: string]: string};
type EnvSourceResult<R=string> = [R, string]|[null,null]|null;
type ResolveEnvSourceFunc<R> = typeof resolveEnvSource;
type EnvSourceFunc<R> = (env: any, resolve: ResolveEnvSourceFunc<R>) => EnvSourceResult<R>;
type EnvSource<R=string> = string|string[]|EnvSourceFunc<R>;
type PresenceEnvSource = EnvSource|MatchEnv;


interface CIProvider {
  id: string,
  name: string,
  presence: PresenceEnvSource,
  branch: EnvSource|false,
  tag: EnvSource|false,
  commitId: EnvSource|false,
  commitMessage: EnvSource|false,
  // Is this a regular push build, or a pull request?
  event: EnvSource<CIEvent>|false,
  // The branch to merge into in case of a pull request
  baseBranch: EnvSource|false,
}


// https://circleci.com/docs/1.0/environment-variables/
const CircleCI: CIProvider = {
  id: 'circleci',
  name: "CircleCi",
  presence: ["CIRCLECI"],
  branch: "CIRCLE_BRANCH",
  tag: "CIRCLE_TAG",
  commitId: "CIRCLE_SHA1",
  commitMessage: false,
  event: (env, r) => env.CI_PULL_REQUEST ? ['pull_request', 'CI_PULL_REQUEST'] : ['push', 'missing CI_PULL_REQUEST'],
  baseBranch: false
};


// https://docs.travis-ci.com/user/environment-variables/
const Travis: CIProvider = {
  id: 'travis',
  name: "Travis",
  presence: "TRAVIS",
  event: (env, r) => env.TRAVIS_EVENT_TYPE == 'pull_request'
    ? r("TRAVIS_EVENT_TYPE")
    : ['push', 'TRAVIS_EVENT_TYPE'],
  tag: "TRAVIS_TAG",
  commitId: ["TRAVIS_PULL_REQUEST_SHA", "TRAVIS_COMMIT"],
  commitMessage: "TRAVIS_COMMIT_MESSAGE",
  // If it's a pull request, TRAVIS_BRANCH contains the base branch!
  branch: ["TRAVIS_PULL_REQUEST_BRANCH", "TRAVIS_BRANCH"],
  // TRAVIS_BRANCH, but only if it's a pull request
  baseBranch: (env, r) => env.TRAVIS_PULL_REQUEST_BRANCH
    ? r('TRAVIS_BRANCH') : null
};


// https://wiki.jenkins.io/display/JENKINS/Building+a+software+project#Buildingasoftwareproject-JenkinsSetEnvironmentVariables
const Jenkins: CIProvider = {
  id: 'jenkins',
  name: "Jenkins",
  presence: "JENKINS_URL",
  branch: ["GIT_BRANCH", "CVS_BRANCH"],
  tag: false,
  commitId: ["GIT_COMMIT", "SVN_REVISION"],
  commitMessage: false,
  event: false,
  baseBranch: false
};


// https://docs.gitlab.com/ee/ci/variables/
const Gitlab: CIProvider = {
  id: 'gitlab',
  name: "Gitlab CI",
  presence: "GITLAB_CI",
  commitId: "CI_COMMIT_SHA",
  commitMessage: false,
  tag: "CI_COMMIT_TAG",
  // CI_COMMIT_REF_NAME might be a tag, we don't want to return that.
  branch: (env, r) => env.CI_COMMIT_REF_NAME !== env.CI_COMMIT_TAG ? r("CI_COMMIT_REF_NAME") : null,
  event: false,
  baseBranch: false
};


// https://documentation.codeship.com/basic/builds-and-configuration/set-environment-variables/
const CodeShip: CIProvider = {
  id: 'codeship',
  name: "Codeship",
  presence: {CI_NAME: 'codeship'},
  commitId: "CI_COMMIT_ID",
  commitMessage: "CI_MESSAGE",
  tag: false,
  branch: "CI_BRANCH",
  event: (env, r) => env.CI_PULL_REQUEST
    ? ['pull_request', "CI_PULL_REQUEST"]
    : ['push', 'missing CI_PULL_REQUEST'],
  baseBranch: false
};


// http://readme.drone.io/0.5/usage/environment-reference/
const DroneCI: CIProvider = {
  id: 'drone',
  name: "Drone CI",
  presence: "DRONE",
  commitId: "DRONE_COMMIT_SHA",
  commitMessage: "DRONE_COMMIT_MESSAGE",
  tag: (env, r) => env.DRONE_COMMIT_REF !== env.DRONE_COMMIT_BRANCH
    ? r("DRONE_COMMIT_REF") : null,
  branch: "DRONE_COMMIT_BRANCH",
  // Can be (push, pull_request, tag)
  event: (env, r) => env.DRONE_BUILD_EVENT == 'tag' ? null : r("DRONE_BUILD_EVENT"),
  baseBranch: false  // Could be DRONE_REPO_BRANCH?
};


// https://www.appveyor.com/docs/environment-variables/
const AppVeyor: CIProvider = {
  id: 'appveyor',
  name: "Appveyor",
  presence: "APPVEYOR",
  commitId: "APPVEYOR_REPO_COMMIT",
  commitMessage: "APPVEYOR_REPO_COMMIT_MESSAGE",
  tag: "APPVEYOR_REPO_TAG_NAME",
  // If it's a pull request, then according to the docs APPVEYOR_REPO_BRANCH
  // is the name of the base branch. There is no other branch-related variable.
  branch: (env, r) => env.APPVEYOR_PULL_REQUEST_NUMBER ? null : r("APPVEYOR_REPO_BRANCH"),
  baseBranch: (env, r) => env.APPVEYOR_PULL_REQUEST_NUMBER ? r("APPVEYOR_REPO_BRANCH") : null,
  event: env => env.APPVEYOR_PULL_REQUEST_NUMBER
    ? ['pull_request', 'APPVEYOR_PULL_REQUEST_NUMBER']
    : ['push', 'missing APPVEYOR_PULL_REQUEST_NUMBER']
}


const ENVS: CIProvider[] = [
  CircleCI,
  Travis,
  Jenkins,
  AppVeyor,
  DroneCI,
  CodeShip,
  Gitlab
]


type CIInfo = [
  {
    id: string,
    name: string,
    commitId: string|null,
    commitMessage: string|null,
    tag: string|null,
    branch: string|null,
    event: CIEvent|null,
    baseBranch: string|null
  },
  {
    commitId: string|null,
    commitMessage: string|null,
    tag: string|null,
    branch: string|null,
    event: string|null,
    baseBranch: string|null
  }
]


/**
 * Tries to figure out the CI. Will then return a 2-tuple
 * [Info from CI, Env-Keys we read the info from].
 */
export function getCIInfo(): CIInfo|[null,null] {
  for (let ciDef of ENVS) {
    // Check if this CI is present
    const ciPresent = checkPresence(ciDef.presence);
    if (!ciPresent) {
      continue;
    }

    const resolvedCommitId = resolveEnvSource(ciDef.commitId);
    const resolvedCommitMessage = resolveEnvSource(ciDef.commitMessage);
    const resolvedTag = resolveEnvSource(ciDef.tag);
    const resolvedBranch = resolveEnvSource(ciDef.branch);
    const resolvedEvent = resolveEnvSource<CIEvent>(ciDef.event);
    const resolvedBaseBranch = resolveEnvSource(ciDef.event);

    return [
      {
        id: ciDef.id,
        name: ciDef.name,
        commitId: resolvedCommitId[0],
        commitMessage: resolvedCommitMessage[0],
        tag: resolvedTag[0],
        branch: resolvedBranch[0],
        event: resolvedEvent[0],
        baseBranch: resolvedBaseBranch[0]
      },
      {
        commitId: resolvedCommitId[1],
        commitMessage: resolvedCommitMessage[1],
        tag: resolvedTag[1],
        branch: resolvedBranch[1],
        event: resolvedEvent[1],
        baseBranch: resolvedBaseBranch[1]
      }
    ];
  }

  return [null, null];
}


export function checkPresence(presence: PresenceEnvSource) {
  if (typeof presence == 'object') {
    const invalidKeys = Object.keys(presence).filter(envKey => {
      return process.env[envKey] !== (presence as MatchEnv)[envKey];
    });
    return !invalidKeys;
  }
  const [isPresent] = resolveEnvSource((presence as EnvSource));
  return !!isPresent;
}


/**
 * Return value is a 2-tuple [value from environment, env key read from].
 */
function resolveEnvSource<T=string>(sourceDef: EnvSource<T>|false): [T,string]|[null,null] {
  // No env source provided
  if (sourceDef === false) {
    return [null, null];
  }

  // Simple string: Just read from that env variable.
  if (typeof sourceDef == 'string') {
    const value = process.env[sourceDef] || null;
    return [value, sourceDef];
  }

  // Array: See if one of the variables given exists.
  if (Array.isArray(sourceDef)) {
    for (let envVar of sourceDef) {
      if (process.env[envVar]) {
        return [(process.env[envVar] as T), envVar];
      }
    }
    return [null, null];
  }

  // Function: The function can provide custom logic.
  if (typeof sourceDef == 'function') {
    const result = sourceDef(process.env, resolveEnvSource);
    if (!result) {
      return [null, null];
    }
    return result;
  }

  throw new Error('Invalid value passed: ' + sourceDef);
}