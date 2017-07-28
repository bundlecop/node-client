import * as yargs from 'yargs';
import {existsSync} from 'fs';
import {readFilesFromDirectories, FileResolveError} from './collector';
import submitReading, {ValidationError} from  './submission';
import {getRepoInfo} from './repo';
import * as colors from 'colors';


class CommandError extends Error {};


// https://github.com/yargs/yargs/issues/510
function wrap(func: any) {
  return function decorator(...args: any[]) {
    const promise = func(...args);
    promise.catch((e: any) => {
      if (!(e instanceof CommandError)) {
        console.log(e.stack);
      }
      console.log(colors.red(`ERROR: ${e.message}`));
      process.exit(1);
    });
  }
}


yargs
  .version('0.1.0');


yargs
  .help()
  .strict();


yargs
  .option('api-url', {
    global: true
  });


yargs
  .command(
    'get-repo-info',
    (false as any),
    (yargs: yargs.Argv) => {
      return yargs
    },
    (argv: any) => {
      console.log(getRepoInfo());
    });


yargs
  .command(
    'submit <FILES_DIRS_GLOBS...>',
    'Submit the sizes for all files in this directory',
    (yargs: yargs.Argv) => {
      return yargs
        .option('projectKey', {
          describe: 'Project key authenticates you for a project on Bundlecop'
        })
        .option('bundleset', {
          type: 'string',
          describe: 'ID of the bundleset the reading should be submitted for'
        })

        .option('commit', {
          type: 'string',
          describe: 'Arbitrary commit id or hash that you want to associate with the reading'
        })
        .option('branch', {
          type: 'string',
          describe: 'Arbitrary branch name. If given, and no parent commit is specified, '+
            'then the most recent reading from this branch will be the parent'
        })
        .option('parent-commits', {
          type: 'array',
          describe: 'The commit id of the parent reading. This is the reading that new values'+
            ' will be compare to. Instead of explicitly specifying the commit, you can also use '+
            ' the --branch option'
        })

        .option('include', {
          type: 'string',
          describe: 'Glob pattern of files to include if a directory is specified.'
        })
        .option('exclude', {
          type: 'string',
          describe: 'Glob pattern of files to exclude if a directory is specified.'
        })

        .option('only-if-env', {
          describe: 'Do not submit if the given environment variable is not set.'
        });
    },
    wrap(async (argv: any) => {
      // Find all the files given
      let files;
      try {
        files = await readFilesFromDirectories(argv.FILES_DIRS_GLOBS, {
          includePattern: argv.include,
          excludePattern: argv.exclude
        });
      }
      catch (e) {
        if (e instanceof FileResolveError) {
          throw new CommandError(e.message);
        }
        throw e;
      }

      try {
        await submitReading(files, {
          bundleSet: argv.bundleset,
          commit: argv.commit,
          branch: argv.branch,
          parentCommits: argv.parentCommits,
          projectKey: argv.projectKey,
          apiUrl: argv.apiUrl,
          onlyIfEnv: argv.onlyIfEnv
        });
      }
      catch (e) {
        if (e instanceof ValidationError) {
          throw new CommandError(e.message);
        }
        throw e;
      }
    })
  );


yargs.demandCommand(1).argv
