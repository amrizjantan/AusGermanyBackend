import fs from "fs";
import semver from "semver";
import childProcess from "child_process";

// checks that current node and npm versions satisfies requirements in package.json
// to run manually:   node check-version.js [verbose]

const VERBOSE_FORCED = false;
const args = process.argv.slice(2);
const VERBOSE = VERBOSE_FORCED || (args.length > 0 && args[0] === "verbose");

const printErrAndExit = (x) => {
  console.error(x);
  console.error("Aborting");
  process.exit(1);
};

const checkNpmVersion = (npmVersionRequired) => {
  if (!npmVersionRequired) {
    console.log("No required npm version specified"); // eslint-disable-line no-console
    return;
  }
  const npmVersion = `${childProcess.execSync("npm -v")}`.trim();
  if (VERBOSE)
    // eslint-disable-next-line no-console
    console.log(
      `npm required: '${npmVersionRequired}' - current: '${npmVersion}'`
    );
  if (!semver.satisfies(npmVersion, npmVersionRequired)) {
    printErrAndExit(
      `Required npm version '${npmVersionRequired}' not satisfied. Current: '${npmVersion}'.`
    );
  }
};

const checkNodeVersion = (nodeVersionRequired) => {
  if (!nodeVersionRequired) {
    console.log("No required node version specified"); // eslint-disable-line no-console
    return;
  }
  const nodeVersion = process.version;
  if (VERBOSE)
    // eslint-disable-next-line no-console
    console.log(
      `node required: '${nodeVersionRequired}' - current: '${nodeVersion}'`
    );
  if (!semver.satisfies(nodeVersion, nodeVersionRequired)) {
    printErrAndExit(
      `Required node version '${nodeVersionRequired}' not satisfied. Current: '${nodeVersion}'.`
    );
  }
};

const json = JSON.parse(fs.readFileSync("./package.json"));
if (!json.engines) printErrAndExit("no engines entry in package json?");
checkNodeVersion(json.engines.node);
checkNpmVersion(json.engines.npm);
