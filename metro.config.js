const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

function escapeCharForRegex(char) {
  if (/[A-Za-z]/.test(char)) {
    return `[${char.toLowerCase()}${char.toUpperCase()}]`;
  }

  return /[|\\{}()[\]^$+*?.]/.test(char) ? `\\${char}` : char;
}

function escapeForRegex(inputPath) {
  return inputPath
    .split(path.sep)
    .map((segment) => Array.from(segment).map(escapeCharForRegex).join(""))
    .join("[\\\\/]");
}

const backendRoot = path.resolve(projectRoot, "5second-answers-api");
const backendBlockPattern = new RegExp(`^${escapeForRegex(backendRoot)}([\\\\/].*)?$`);

config.resolver.blockList = [...(config.resolver.blockList || []), backendBlockPattern];

module.exports = config;
