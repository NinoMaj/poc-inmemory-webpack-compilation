const webpack = require("webpack");
const realFs = require("fs");
const path = require("path");
const memfs = require("memfs");
const joinPath = require("memory-fs/lib/join");
const recursive = require("recursive-readdir");

const babelConfig = require("./.babelrc.js");
const loadDependenciesInMemory = require("./loadDependenciesInMemory");

// create memory fs with the index.js file
const vol = new memfs.Volume.fromJSON({
  "index.js": `
    console.log('Hello world')
  `
});
const inmemfs = ensureWebpackMemoryFs(memfs.createFsFromVolume(vol));

// what this function does is basically copies the files for dep tree into the memory
loadDependenciesInMemory({
  packages: ["babel-loader"],
  rootPath: "",
  fs: {
    input: realFs,
    output: inmemfs
  }
})
  .then(() => {
    const compiler = webpack({
      mode: "production",
      entry: "./index.js",
      output: {
        filename: "bundle.js",
        path: "/dist"
      },

      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
              loader: "babel-loader",
              options: babelConfig
            }
          }
        ]
      }
    });

    compiler.inputFileSystem = inmemfs;
    compiler.outputFileSystem = inmemfs;

    compiler.run(function webpackCompilerRunCallback(err, stats) {
      if (err) {
        console.error(err);
        return;
      }
      if (stats.hasErrors()) {
        realFs.writeFileSync("./error.js", stats.toJson().errors);
        console.error(stats.toJson().errors);
        return;
      }
      if (stats.hasWarnings()) {
        console.warn(stats.toJson().warnings);
      }

      inmemfs.readFile("/dist/bundle.js", (e, data) => {
        if (e) return console.log(e);
        console.log("bundle.js", data.toString());
      });

      console.log(stats.toJson("minimal"));
    });
  })
  .catch(err => {
    throw err;
  });

function ensureWebpackMemoryFs(fs) {
  // Return it back, when it has Webpack 'join' method
  if (fs.join) {
    return fs;
  }

  // Create FS proxy, adding `join` method to memfs, but not modifying original object
  const nextFs = Object.create(fs);
  nextFs.join = joinPath;

  return nextFs;
}
