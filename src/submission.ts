/**
 * Encaspulate the submission logic.
 *
 * We have multiple entry points for submission: The CLI,
 * the webpack plugin, maybe others in the future. They
 * should largely support the same options regarding
 * server, user provided data, console output and so on.
 *
 * This also includes reading certain settings from the
 * environment, which is why this happens here, instead of
 * using the env functionality that yargs has built in.
 */

import Api, {FileReading} from './api';
import {getCIInfo} from './ci';
import * as colors from 'colors';
import {getRepoInfo} from './repo';


export class ValidationError extends Error {};


export interface SubmissionOptions {
  projectKey: string|null;
  apiUrl: string|null;
  bundleSet: string|null;

  commit: string|null;
  commitMessage: string|null;
  parentCommits: string[]|null;
  branch: string|null;
  baseBranch: string|null;
  isFeatureBranch: boolean|null;

  onlyIfEnv: string|null;
}

const DEFAULT_API_URL = 'https://api.bundlecop.com/api';


const MAPPING: any = {
  projectKey: 'BUNDLECOP_KEY'
};
function readOption(name: string, split?: boolean): string|null {
  const envKey = MAPPING[name] || `BUNDLECOP_${name.toUpperCase()}`;
  let value = process.env[envKey];
  return value || null;
}

function readOptionExt<T>(name: string, func: (v: string) => T) {
  const value = readOption(name);
  if (value === null) {
    return value;
  }
  return func(value);
}


function readOptionsFromEnv(): SubmissionOptions {
  return {
    projectKey: readOption('projectKey'),
    apiUrl: readOption('apiUrl'),
    bundleSet: readOption('bundleSet'),
    commit: readOption('commit'),
    commitMessage: readOption('commitMessage'),
    parentCommits: readOptionExt('parentCommits', s => s.split(',')),
    baseBranch: readOption('baseBranch'),
    isFeatureBranch: readOptionExt('isFeatureBranch', s => asBool(s)),
    branch: readOption('branch'),
    onlyIfEnv: readOption('onlyifEnv')
  }
}


export function validateConfig(opts: SubmissionOptions) {
  if (!opts.apiUrl) {
    throw new ValidationError('The apiUrl option needs to be set to something.')
  }

  if (!opts.projectKey) {
    throw new ValidationError('The projectKey option needs to be set to something.')
  }

  if (!opts.bundleSet) {
    throw new ValidationError('The bundleSet option needs to be set to something.')
  }
}


export default async function submitReading(
    files: FileReading[],
    explicitOptions: SubmissionOptions)
{
  // Find info in CI & Git & Env
  const [ciData, sourceKeys] = getCIInfo();
  const repoData = getRepoInfo();
  const envData = readOptionsFromEnv();

  const onlyIfEnv = explicitOptions.onlyIfEnv || envData.onlyIfEnv;
  // Check onlyIfenv, skip submission if required.
  if (onlyIfEnv && !process.env[onlyIfEnv]) {
    console.log(`Skipping submission, because environment variable ${onlyIfEnv} is not set.`);
    return;
  }

  // TODO: Refactor, pass a {cli, env, ci, repo} dict; the order of checkign
  // is then enforced elsewhere + we are sure we don't miss anything.
  const {values, valueSources} = selectValues({
    apiUrl: [
      [explicitOptions.apiUrl, 'options'],
      [envData.apiUrl, 'environment'],
      [DEFAULT_API_URL, 'default']
    ],

    projectKey: [
      [explicitOptions.projectKey, 'options'],
      [envData.projectKey, 'environment'],
    ],

    commit: [
      [explicitOptions.commit, 'specified on command line'],
      [envData.commit, 'environment'],
      ciData && [ciData.commitId, `found in CI env var ${sourceKeys!.commitId}`],
      repoData && [repoData.commitId, `found via ${repoData.system} repo`],
    ],

    commitMessage: [
      [envData.commitMessage, 'environment'],
      ciData && [ciData.commitMessage, `found in CI env var ${sourceKeys!.commitMessage}`],
      repoData && [repoData.commitMessage, `found via ${repoData.system} repo`],
    ],

    branch: [
      [explicitOptions.branch, 'specified on command line'],
      [envData.branch, 'environment'],
      ciData && [ciData.branch, `found in CI env var ${sourceKeys!.branch}`],
      repoData && [repoData.branch, `found via ${repoData.system} repo`],
    ],

    parentCommits: [
      [explicitOptions.parentCommits, 'specified on command line'],
      [envData.parentCommits, 'environment'],
      repoData && [repoData.parentCommitIds, `found via ${repoData.system} repo`],
    ],

    bundleSet: [
      [explicitOptions.bundleSet, 'options'],
      [envData.bundleSet, 'environment']
    ],

    isFeatureBranch: [
      [explicitOptions.isFeatureBranch, 'options'],
      [envData.isFeatureBranch, 'environment'],
      ciData && [ciData.event == 'pull_request', `found in CI env var ${sourceKeys!.event}`],
    ],

    baseBranch: [
      [explicitOptions.baseBranch, 'options'],
      [envData.baseBranch, 'environment'],
      ciData && [ciData.baseBranch, `found in CI env var ${sourceKeys!.baseBranch}`],
    ],
  });

  // At this point, make sure we have all the values we need.
  validateConfig(values as any);

  // Output some info as to what we are about to submit
  function outputDataPoint(label: string, key: string) {
    let value = values[key];
    let reason = valueSources[key] || "not found";
    if (value === null) {
      value = colors.bold("unset")
      reason = "";
    }
    else {
      value = colors.green(value);
      reason = ` (${reason})`;
    }
    console.log(`  ${label}: ${value}${reason}`)
  }
  console.log(`Submitting reading with ${files!.length} files:`)
  outputDataPoint('Commit', 'commit');
  outputDataPoint('Parent Commits', 'parentCommits');
  outputDataPoint('Branch', 'branch');
  if (values.baseBranch) {
    outputDataPoint('Base Branch', 'baseBranch');
  } else {
    outputDataPoint('Is Feature Branch', 'isFeatureBranch');
  }

  // So, submit everything
  const api = new Api(values.apiUrl!, values.projectKey!);
  await api.submitReading({
    files,
    bundleset: values.bundleSet!,
    parentCommits: forceUndefined((values.parentCommits as any)),
    commit: forceUndefined(values.commit),
    commitMessage: forceUndefined(values.commitMessage),
    branch: forceUndefined(values.branch),
    isFeatureBranch: forceUndefined(values.baseBranch || values.isFeatureBranch)
  });

  console.log('');
  console.log(colors.green('✔ Submitted'))
}


function forceUndefined<T>(v: T|null): T|undefined {
  if ((v as any) === "" || v === null) {
    return undefined;
  }
  return v;
}


type ValueSource = any;
type ValuePicker = [any, ValueSource];
type ValuePickers = (ValuePicker|null)[];
type ValuePickerResult = [string, string] | [null, null];
type ValuePickerStrategy = {[varName: string]: ValuePickers};


function selectValues<T extends ValuePickerStrategy>(strategy: ValuePickerStrategy): {
  values: {[key in keyof T]: string|null},
  valueSources: {[key in keyof T]: string|null}
} {
  let values: any = {};
  let valueSources: any = {};

  Object.keys(strategy).map(varName => {
    const picker = strategy[varName];
    const [value, source] = pickOne(picker);
    values[varName] = value;
    valueSources[varName] = source;
  })

  return {
    values,
    valueSources
};
}


/**
 * Give a list of values, returns the first one that is not
 * empty. Empty strings, null, false, undefined and empty lists
 * all count as empty.
 */
function pickOne(values: ValuePickers): ValuePickerResult {
  for (let check of values) {
    // This value has not been set at all, probably a case of
    // "test && value" syntax.
    if (check === null) {
      continue;

    }
    const [value, description] = check;

    if (Array.isArray(value) && value.length == 0) {
      continue;
    }
    if (value === "" || value === null || value === false || value === undefined) {
      continue;
    };

    return [value, description];
  }
  return [null, null];
}


function asBool(s: string) {
  // Is the given string a known false?
  if (!s || s.toLowerCase() == "false" || s == '0') {
    return false;
  }

  return true;
}