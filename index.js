const util = require("util");
const exec = util.promisify(require("child_process").exec);
const imagemin = require("imagemin");
const imageminJpegtran = require("imagemin-jpegtran");

class HandleAssetsPlugin {
  constructor(copy = null, minify = null) {
    this.copy = copy;
    this.minify = minify;
    this.pushError = () => {};
  }
  async copyAssets(settings) {
    if (!settings.in || !settings.out) {
      throw new Error("\nError when copying: invalid settings provided\n");
    }
    try {
      const { stdout } = await exec(
        `rsync -r -P --ignore-existing ${settings.in} ${settings.out}`
      );
      console.log(`\n${stdout}`);
    } catch (error) {
      this.pushError(error.stderr);
    }
  }
  async minifyAssets(path, cachedAssets = []) {
    try {
      const paths = [`${path}*.jpg`, ...cachedAssets];
      const files = await imagemin(paths, path, {
        plugins: [imageminJpegtran({ progressive: true })]
      });
      console.log(`\n${files.length} assets minified`);
      return files;
    } catch (error) {
      this.pushError(error);
    }
  }
  apply(compiler) {
    compiler.hooks.emit.tapAsync(
      "HandleAssetsPlugin",
      async (compilation, callback) => {
        this.pushError = error => compilation.errors.push(error);
        if (!this.copy && !this.minify) {
          callback();
        }
        if (this.copy) {
          if (!Array.isArray(this.copy)) {
            compilation.errors.push(
              "Error when copying: invalid config provided"
            );
          }
          for (const settings of this.copy) {
            await this.copyAssets(settings);
          }
        }
        if (this.minify) {
          if (!Array.isArray(this.minify)) {
            compilation.errors.push(
              "Error when minifying: invalid config provided"
            );
          }
          for (const path of this.minify) {
            const files = await this.minifyAssets(path, compiler.cachedAssets);
            if (!compiler.cachedAssets) {
              compiler.cachedAssets = files.map(file => "!" + file.path);
            } else {
              for (const file of files) {
                if (compiler.cachedAssets.indexOf("!" + file) === -1) {
                  compiler.cachedAssets.push("!" + file);
                }
              }
            }
          }
        }
        callback();
      }
    );
  }
}

module.exports = HandleAssetsPlugin;
