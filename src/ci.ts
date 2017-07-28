/**
 * Get information from a CI environment.
 */


type MatchEnv = {[envKey: string]: string};
type EnvGetterFunc = (env: any) => EnvGetter|false;
type EnvGetter = string|string[]|EnvGetterFunc;
type PresenceEnvGetter = EnvGetter|MatchEnv;

interface CIProvider {
  id: string,
  name: string,
  presence: EnvGetter|MatchEnv,
  branch: EnvGetter|false,
  tag: EnvGetter|false,
  commitId: EnvGetter|false,
  event: EnvGetter|false,
}

const ENVS: CIProvider[] = [
  // https://circleci.com/docs/1.0/environment-variables/
  {
    id: 'circleci',
    name: "CircleCi",
    presence: ["CIRCLECI"],
    branch: "CIRCLE_BRANCH",
    tag: "CIRCLE_TAG",
    commitId: "CIRCLE_SHA1",
    event: false
  },

  // https://docs.travis-ci.com/user/environment-variables/
  {
    id: 'travis',
    name: "Travis",
    presence: "TRAVIS",
    event: "TRAVIS_EVENT_TYPE",
    branch: "",
    tag: ["TRAVIS_PULL_REQUEST_BRANCH", "TRAVIS_BRANCH"],
    commitId: ["TRAVIS_PULL_REQUEST_SHA", "TRAVIS_COMMIT"]
  },

  // https://wiki.jenkins.io/display/JENKINS/Building+a+software+project#Buildingasoftwareproject-JenkinsSetEnvironmentVariables
  {
    id: 'jenkins',
    name: "Jenkins",
    presence: "JENKINS_URL",
    branch: ["GIT_BRANCH", "CVS_BRANCH"],
    tag: false,
    commitId: ["GIT_COMMIT", "SVN_REVISION"],
    event: false
  },

  // https://docs.gitlab.com/ee/ci/variables/
  {
    id: 'gitlab',
    name: "Gitlab CI",
    presence: "GITLAB_CI",
    commitId: "CI_COMMIT_SHA",
    tag: "CI_COMMIT_TAG",
    // CI_COMMIT_REF_NAME might be a tag, we don't want to return that.
    branch: (env) => env.CI_COMMIT_REF_NAME !== env.CI_COMMIT_TAG ? "CI_COMMIT_REF_NAME" : false,
    event: "CI_PIPELINE_SOURCE"
  },

  // https://documentation.codeship.com/basic/builds-and-configuration/set-environment-variables/
  {
    id: 'codeship',
    name: "Codeship",
    presence: {CI_NAME: 'codeship'},
    commitId: "CI_COMMIT_ID",
    tag: false,
    branch: "CI_BRANCH",
    event: false
  },

  // http://readme.drone.io/0.5/usage/environment-reference/
  {
    id: 'drone',
    name: "Drone CI",
    presence: "DRONE",
    commitId: "DRONE_COMMIT_SHA",
    tag: "DRONE_COMMIT_REF",
    branch: "DRONE_COMMIT_REF",
    event: "DRONE_BUILD_EVENT"
  },

  // https://www.appveyor.com/docs/environment-variables/
  {
    id: 'appveyor',
    name: "Appveyor",
    presence: "APPVEYOR",
    commitId: "APPVEYOR_REPO_COMMIT",
    tag: "APPVEYOR_REPO_TAG_NAME",
    // If it's a pull request, the we only get the base branch apparently.
    branch: env => env.APPVEYOR_PULL_REQUEST_NUMBER ? false : "APPVEYOR_REPO_BRANCH",
    event: false
  }
]


/**
 * Tries to figure out the CI. Will then return a 2-tuple
 * [Info from CI, Env-Keys we read the info from].
 */
export function getCIInfo() {
  for (let ciDef of ENVS) {
    // Check if this CI is present
    const ciPresent = checkPresence(ciDef.presence);
    if (!ciPresent) {
      continue;
    }

    const resolvedCommitId = resolveEnvGetter(ciDef.commitId);
    const resolvedTag = resolveEnvGetter(ciDef.tag);
    const resolvedBranch = resolveEnvGetter(ciDef.branch);
    const resolvedEvent = resolveEnvGetter(ciDef.event);

    return [
      {
        id: ciDef.id,
        name: ciDef.name,
        commitId: resolvedCommitId[0],
        tag: resolvedTag[0],
        branch: resolvedBranch[0],
        event: resolvedEvent[0],
      },
      {
        commitId: resolvedCommitId[1],
        tag: resolvedTag[1],
        branch: resolvedBranch[1],
        event: resolvedEvent[1],
      }
    ];
  }

  return [null, null];
}


function checkPresence(presence: PresenceEnvGetter) {
  if (typeof presence == 'object') {
    const invalidKeys = Object.keys(presence).filter(envKey => {
      return process.env[envKey] !== (presence as MatchEnv)[envKey];
    })
  }
  const [isPresent] = resolveEnvGetter((presence as EnvGetter));
  return !!isPresent;
}


/**
 * Return value is a 2-tuple [value from environment, env key read from].
 */
function resolveEnvGetter(getter: EnvGetter|false): [string|null, string|null] {
  if (getter === false) {
    return [null, null];
  }

  if (typeof getter == 'string') {
    const value = process.env[getter] || null;
    return [value, getter];
  }

  // See if one of the variables exist
  if (Array.isArray(getter)) {
    for (let envVar of getter) {
      if (process.env[envVar]) {
        return [(process.env[envVar] as string), envVar];
      }
    }
    return [null, null];
  }

  if (typeof getter == 'function') {
    const newGetter = getter(process.env);
    return resolveEnvGetter(newGetter);
  }

  return [null, null];
}