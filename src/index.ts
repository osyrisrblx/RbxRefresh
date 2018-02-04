#!/usr/bin/env node
import * as chokidar from "chokidar";
import * as colors from "colors";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as url from "url";
import * as util from "util";

import { spawnSync } from "child_process";

import { syncSourceDirFromObj } from "./SyncFS";
import {
	RBXTYPE_MODULESCRIPT,
	RBXTYPE_LOCALSCRIPT,
	RBXTYPE_SCRIPT,
	RBXTYPE_MODULESCRIPT_ALIASES,
	RBXTYPE_LOCALSCRIPT_ALIASES,
	RBXTYPE_SCRIPT_ALIASES,
	FSEXT_LUA,
	FSEXT_MOON,
	isAliasOf,
	jsArrayToLuaArrayString,
	matchAssetRbxType,
	SRC_UTILITY_FUNC_LUA,
	SRC_SET_SOURCE_CALL_LUA,
	SRC_REMOVE_FILE_CALL_LUA,
	SRC_PRINT_LUA,
	SRC_SYNC_TO_FS_LUA,
	SRC_GUARD_LUA,
} from "./Utility";

let jsLog = console.log;
console.log = (...args: any[]) => jsLog(colors.red(colors.bold("[RbxRefresh]")), ...args);

let PROJECT_DIR = ".";

let pkgjson = require("./../package.json");
import * as program from "commander";
program
	.version(pkgjson.version)
	.usage("rbxrefresh [options] [dir]")
	.arguments("[dir]")
	.option("-s, --sync", "Enables sync to filesystem")
	.option("-f, --fullupdateonly", "Terminates server after full update")
	.option("-p, --poll", "Makes Chokidar use polling mode")
	.action((env: string) => {
		if (env) {
			PROJECT_DIR = env;
		}
	})
	.parse(process.argv);

if (!fs.existsSync(PROJECT_DIR)) {
	throw new Error("Could not find project directory!");
}

let SOURCE_DIR = PROJECT_DIR + "/src";
if (!fs.existsSync(SOURCE_DIR)) {
	if (program.sync) {
		fs.mkdirSync(SOURCE_DIR);
	} else {
		// let's try old behavior?
		SOURCE_DIR = PROJECT_DIR;
		PROJECT_DIR = SOURCE_DIR + "/../";
		if (!fs.existsSync(PROJECT_DIR)) {
			throw new Error("Could not find project directory!");
		}
		if (!fs.existsSync(SOURCE_DIR)) {
			throw new Error("Could not find src directory!");
		}
	}
}

let config: RbxRefreshConfig = {};
try {
	if (fs.existsSync(`${PROJECT_DIR}/.rbxrefreshrc`)) {
		config = JSON.parse(fs.readFileSync(`${PROJECT_DIR}/.rbxrefreshrc`, "utf8"));
	} else if (program.sync) {
		// create .rbxrefreshrc
	}
} catch (e) { }

let doPlaceIdGuard = true;
let placeIdJsArray: number[] = [];
if (typeof config.placeId == "number") {
	placeIdJsArray.push(config.placeId);
} else if (typeof config.placeId == "object") { // array
	placeIdJsArray = config.placeId;
} else if (typeof config.placeId == "undefined") {
	// placeId either didn't exist or wasn't an expected type
	doPlaceIdGuard = false;
} else {
	console.error("Bad placeId type in .rbxrefreshrc!");
	process.exit();
}
let placeIdLuaArray = jsArrayToLuaArrayString(placeIdJsArray);

function generateUpdateAllFilesCodeRbxTraversal(dir: string, outCodeLines: string[]): void {
	fs.readdirSync(dir).forEach(function (itrFileName) {
		var itrFilePath = path.resolve(dir, itrFileName);
		if (fs.statSync(itrFilePath).isDirectory()) {
			generateUpdateAllFilesCodeRbxTraversal(itrFilePath, outCodeLines);
		} else {
			var fileExt = path.extname(itrFilePath);
			if (fileExt == FSEXT_LUA || fileExt == FSEXT_MOON) {
				outCodeLines.push(generateUpdateFileCode(itrFilePath));
			}
		}
	});
}

function generateUpdateAllFilesCodeLines(dir: string): string[] {
	var outCodeLines: string[] = [];
	generateUpdateAllFilesCodeRbxTraversal(dir, outCodeLines);
	return outCodeLines;
}

function getAssetRbxInfoFromFilepath(filepath: string): RbxInfo {
	var assetFullName = path.basename(filepath, path.extname(filepath));
	var assetRbxName = "";
	var assetRbxType = path.extname(assetFullName).replace(".", "");

	if (assetRbxType == "") {
		if (filepath.indexOf("ServerScriptService") != -1) {
			assetRbxType = RBXTYPE_SCRIPT;
		} else if (filepath.indexOf("StarterPlayer") != -1) {
			assetRbxType = RBXTYPE_LOCALSCRIPT;
		} else {
			assetRbxType = RBXTYPE_MODULESCRIPT;
		}
		assetRbxName = assetFullName;

	} else {
		assetRbxName = path.basename(assetFullName, "." + assetRbxType);
		assetRbxType = matchAssetRbxType(assetRbxType);
	}

	var relativeFilepathArray = path.relative(SOURCE_DIR, filepath).split(path.sep);
	relativeFilepathArray.pop();

	return {
		RbxName: assetRbxName,
		RbxType: assetRbxType,
		RbxPath: relativeFilepathArray
	};
}

function generateUpdateFileCode(filepath: string): string {
	var fileExt = path.extname(filepath);
	if (fileExt != FSEXT_LUA && fileExt != FSEXT_MOON) {
		return "";
	}
	var assetInfo = getAssetRbxInfoFromFilepath(filepath);
	var fileContents
	if (fileExt == FSEXT_LUA) {
		fileContents = fs.readFileSync(filepath).toString();
	} else if (fileExt == FSEXT_MOON) {
		fileContents = spawnSync("moonc -p " + filepath, { shell: true }).stdout.toString();
	}
	return util.format(
		SRC_SET_SOURCE_CALL_LUA,
		assetInfo.RbxName,
		assetInfo.RbxType,
		jsArrayToLuaArrayString(assetInfo.RbxPath),
		fileContents
	);
}

function requestSendAddFilepath(filepath: string): void {
	var code = generateUpdateFileCode(filepath);
	var assetInfo = getAssetRbxInfoFromFilepath(filepath);
	var debugOutput = util.format("setSource(%s, %s, [%s])", assetInfo.RbxName, assetInfo.RbxType, assetInfo.RbxPath.join(", "));
	console.log(debugOutput);
	sendSource(util.format(SRC_PRINT_LUA, debugOutput) + "\n" + SRC_UTILITY_FUNC_LUA + "\n" + code + "\n" + util.format(SRC_PRINT_LUA, "Completed"));
}

function requestSendRemoveFilepath(filepath: string): void {
	var assetInfo = getAssetRbxInfoFromFilepath(filepath);
	var debugOutput = util.format("removeFile(%s, %s, [%s])", assetInfo.RbxName, assetInfo.RbxType, assetInfo.RbxPath.join(", "));
	var code = util.format(
		SRC_REMOVE_FILE_CALL_LUA,
		assetInfo.RbxName,
		assetInfo.RbxType,
		jsArrayToLuaArrayString(assetInfo.RbxPath));
	console.log(debugOutput);
	sendSource(util.format(SRC_PRINT_LUA, debugOutput) + "\n" + SRC_UTILITY_FUNC_LUA + "\n" + code + "\n" + util.format(SRC_PRINT_LUA, "Completed"));
}

function requestSendFullUpdate(dir: string): void {
	var code = generateUpdateAllFilesCodeLines(dir).join("\n");
	var debugOutput = util.format("fullUpdate()");
	console.log(debugOutput);
	sendSource(util.format(SRC_PRINT_LUA, debugOutput) + "\n" + SRC_UTILITY_FUNC_LUA + "\n" + code + "\n" + util.format(SRC_PRINT_LUA, "Completed"));
}

var responseQueue: http.ServerResponse[] = [];
var codeQueue: string[] = [];

function writeCodeToRequest(code: string | undefined, response: http.ServerResponse | undefined): void {
	if (!code || !response) return;
	response.writeHead(200, { "Content-Type": "text/plain" });
	response.end(code, function () {
		if (program.fullupdateonly) {
			if (codeQueue.length == 0) {
				process.exit();
			}
		}
	});
}

function sendSource(code: string): void {
	if (doPlaceIdGuard) {
		code = util.format(SRC_GUARD_LUA, placeIdLuaArray) + "\n" + code;
	}
	if (responseQueue.length > 0) {
		while (responseQueue.length > 0) {
			writeCodeToRequest(code, responseQueue.shift());
		}
	} else {
		codeQueue.push(code);
	}
}

var syncFsJson = "";

function onRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
	if (req.method == "POST") {
		var buffer = "";
		req.on("data", function(data: string | Buffer) {
			buffer += data;
		});
		req.on("end", function(): void {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end("ok");
			if (buffer == "$$END$$") {
				syncSourceDirFromObj(SOURCE_DIR, JSON.parse(syncFsJson.toString()));
			} else {
				console.log("SyncToFS Load bytes:", buffer.length);
				syncFsJson += buffer;
			}
		});
	} else {
		if (typeof req.url == "string") {
			var args = url.parse(req.url, true).query;
			if (args.kill == "true") {
				process.exit();
				return;
			}
		}
		if (codeQueue.length > 0) {
			while (codeQueue.length > 0) {
				writeCodeToRequest(codeQueue.shift(), res);
			}
		} else {
			responseQueue.push(res);
		}
	}
}

http.get("http://localhost:8888?kill=true").on("error", function (e) { });

setTimeout(function () {
	http.createServer(onRequest).listen(8888, "0.0.0.0");
	if (program.sync) {
		console.log("Syncing..");
		sendSource(SRC_SYNC_TO_FS_LUA);
	}
	console.log(util.format("Running on PROJECT_DIR(%s)", path.resolve(PROJECT_DIR)));
	requestSendFullUpdate(SOURCE_DIR);
	if (program.fullupdateonly) return;
	chokidar.watch(SOURCE_DIR, {
		ignored: /(^|[\/\\])\.(?![$\/\\])/,
		persistent: true,
		ignoreInitial: true,
		usePolling: program.poll ? true : false
	})
		.on("change", requestSendAddFilepath)
		.on("add", requestSendAddFilepath)
		.on("unlink", function (filepath) {
			requestSendRemoveFilepath(filepath);
			requestSendFullUpdate(SOURCE_DIR);
		});
}, 1000);
