import * as path from 'path';
import {Plugin, Compiler} from 'webpack';
import {measureFileList} from './collector';
import submitReading, {SubmissionOptions} from './submission';


export default class BundleCopPlugin implements Plugin {
  opts: SubmissionOptions;

  // TODO: Use a different plugin hook, and refactor the submitReading()
  // module, so that we can validate the options early, and fail early.

  constructor(opts: Partial<SubmissionOptions>) {
    this.opts = {
      onlyIfEnv: null,
      branch: null,
      bundleSet: null,
      commit: null,
      parentCommits: null,
      projectKey: null,
      apiUrl: null,
      ...opts,
    };
  }

  apply(compiler: Compiler) {
    // Note: some webpack plugins write to the build directory directly.
    // We don't catch such files. Smarter plugins write files to the
    // webpack outputfileSystem, so they work with the dev-server. We
    // currently would ignore such files also. The best ones (for example
    // the manifest plugin) attach an asset to the webpack compilation
    // result (see https://github.com/danethurber/webpack-manifest-plugin/blob/master/lib/plugin.js)
    // These are the ones that we would catch.
    compiler.plugin('after-emit', async compilation => {
      const outputDir = getBundleDirFromCompiler(compilation.compiler);
      const stats = compilation.getStats().toJson({
        assets: true
      });

      // Get all the filenames from these assets
      let files = stats.assets.map((asset: any) => {
        // Remove any potential leading slash!
        // / XXX from the filename
        return {
          root: outputDir,
          filename: path.join(outputDir, asset.name)
        }
      });
      files = await measureFileList(files);

      // const files = await readFilesFromDirectory(outputDir);
      await submitReading(files, this.opts);

      // The assets are the files that have been written.
      // They may or may not be connected to a chunk (JS). They also include map files.
      // CSS files written via ExtractTextPlugin usually belong to chunk, but are listed
      // compilation.children.
    });
  }
}


function getBundleDirFromCompiler(compiler: Compiler) {
  return (compiler.outputFileSystem.constructor.name === 'MemoryFileSystem')
    ? null
    : (compiler as any).outputPath;
}