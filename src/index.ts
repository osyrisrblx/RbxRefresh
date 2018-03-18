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
	isAliasOf,
	jsArrayToLuaArrayString,
	matchAssetRbxType,
	FSEXT_LUA,
	FSEXT_MOON,
	RBXTYPE_LOCALSCRIPT_ALIASES,
	RBXTYPE_LOCALSCRIPT,
	RBXTYPE_MODULESCRIPT_ALIASES,
	RBXTYPE_MODULESCRIPT,
	RBXTYPE_SCRIPT_ALIASES,
	RBXTYPE_SCRIPT,
	SRC_GUARD_LUA,
	SRC_PRINT_LUA,
	SRC_REMOVE_FILE_CALL_LUA,
	SRC_SET_SOURCE_CALL_LUA,
	SRC_SYNC_TO_FS_LUA,
	SRC_UTILITY_FUNC_LUA
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
} catch (e) {}

let doPlaceIdGuard = true;
let placeIdJsArray: number[] = [];
if (typeof config.placeId == "number") {
	placeIdJsArray.push(config.placeId);
} else if (typeof config.placeId == "object") {
	// array
	placeIdJsArray = config.placeId;
} else if (typeof config.placeId == "undefined") {
	// placeId either didn't exist or wasn't an expected type
	doPlaceIdGuard = false;
} else {
	console.error("Bad placeId type in .rbxrefreshrc!");
	process.exit();
}
let placeIdLuaArray = jsArrayToLuaArrayString(placeIdJsArray);

function generateUpdateAllFilesCodeRbxTraversal(dir: string, outCodeLines: string[]) {
	fs.readdirSync(dir).forEach(itrFileName => {
		let itrFilePath = path.resolve(dir, itrFileName);
		if (fs.statSync(itrFilePath).isDirectory()) {
			generateUpdateAllFilesCodeRbxTraversal(itrFilePath, outCodeLines);
		} else {
			let fileExt = path.extname(itrFilePath);
			if (fileExt == FSEXT_LUA || fileExt == FSEXT_MOON) {
				outCodeLines.push(generateUpdateFileCode(itrFilePath));
			}
		}
	});
}

function generateUpdateAllFilesCodeLines(dir: string): string[] {
	let outCodeLines: string[] = [];
	generateUpdateAllFilesCodeRbxTraversal(dir, outCodeLines);
	return outCodeLines;
}

function getAssetRbxInfoFromFilePath(filePath: string): RbxInfo {
	let assetFullName = path.basename(filePath, path.extname(filePath));
	let assetRbxName = "";
	let assetType = path.extname(assetFullName).replace(".", "");

	if (assetType == "") {
		if (filePath.indexOf("ServerScriptService") != -1) {
			assetType = RBXTYPE_SCRIPT;
		} else if (filePath.indexOf("StarterPlayer") != -1) {
			assetType = RBXTYPE_LOCALSCRIPT;
		} else {
			assetType = RBXTYPE_MODULESCRIPT;
		}
		assetRbxName = assetFullName;
	} else {
		assetRbxName = path.basename(assetFullName, "." + assetType);
		assetType = matchAssetRbxType(assetType);
	}

	let relativeFilePathArray = path.relative(SOURCE_DIR, filePath).split(path.sep);
	relativeFilePathArray.pop();

	return {
		name: assetRbxName,
		type: assetType,
		path: relativeFilePathArray
	};
}

function generateUpdateFileCode(filePath: string): string {
	let fileExt = path.extname(filePath);
	if (fileExt != FSEXT_LUA && fileExt != FSEXT_MOON) {
		return "";
	}
	let assetInfo = getAssetRbxInfoFromFilePath(filePath);
	let fileContents = "";
	if (fileExt == FSEXT_LUA) {
		fileContents = fs.readFileSync(filePath).toString();
	} else if (fileExt == FSEXT_MOON) {
		fileContents = spawnSync("moonc -p " + filePath, {
			shell: true
		}).stdout.toString();
	}
	if (fileContents.length === 0) {
		return "";
	}
	return util.format(
		SRC_SET_SOURCE_CALL_LUA,
		assetInfo.name,
		assetInfo.type,
		jsArrayToLuaArrayString(assetInfo.path),
		fileContents
	);
}

function requestSendAddFilePath(filePath: string, attempt = 1) {
	let code = generateUpdateFileCode(filePath);
	if (code.length === 0) {
		console.log("File empty!");
		if (attempt < 5) {
			console.log("Retrying..");
			setTimeout(requestSendAddFilePath, 100, filePath, attempt + 1);
			return;
		}
	}
	let assetInfo = getAssetRbxInfoFromFilePath(filePath);
	let debugOutput = util.format("setSource(%s, %s, [%s])", assetInfo.name, assetInfo.type, assetInfo.path.join(", "));
	console.log(debugOutput);
	sendSource([
		util.format(SRC_PRINT_LUA, debugOutput),
		SRC_UTILITY_FUNC_LUA,
		code,
		util.format(SRC_PRINT_LUA, "Completed")
	]);
}

function requestSendRemoveFilePath(filePath: string) {
	let assetInfo = getAssetRbxInfoFromFilePath(filePath);
	let debugOutput = util.format(
		"removeFile(%s, %s, [%s])",
		assetInfo.name,
		assetInfo.type,
		assetInfo.path.join(", ")
	);
	let code = util.format(
		SRC_REMOVE_FILE_CALL_LUA,
		assetInfo.name,
		assetInfo.type,
		jsArrayToLuaArrayString(assetInfo.path)
	);
	console.log(debugOutput);
	sendSource([
		util.format(SRC_PRINT_LUA, debugOutput),
		SRC_UTILITY_FUNC_LUA,
		code,
		util.format(SRC_PRINT_LUA, "Completed")
	]);
}

function requestSendFullUpdate(dir: string) {
	let code = generateUpdateAllFilesCodeLines(dir).join("\n");
	let debugOutput = util.format("fullUpdate()");
	console.log(debugOutput);
	sendSource([
		util.format(SRC_PRINT_LUA, debugOutput),
		SRC_UTILITY_FUNC_LUA,
		code,
		util.format(SRC_PRINT_LUA, "Completed")
	]);
}

let responseQueue: http.ServerResponse[] = [];
let codeQueue: string[] = [];

function writeCodeToRequest(code?: string, response?: http.ServerResponse) {
	if (!code || !response) return;
	response.writeHead(200, { "Content-Type": "application/json" });
	response.end(code, () => {
		if (program.fullupdateonly) {
			if (codeQueue.length == 0) {
				process.exit();
			}
		}
	});
}

function sendSource(codeArray: string[]) {
	if (doPlaceIdGuard) {
		codeArray.unshift(util.format(SRC_GUARD_LUA, placeIdLuaArray));
	}
	let code = codeArray.join("\n");
	if (responseQueue.length > 0) {
		while (responseQueue.length > 0) {
			writeCodeToRequest(code, responseQueue.shift());
		}
	} else {
		codeQueue.push(code);
	}
}

let syncFsJson = "";

function onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
	if (req.method == "POST") {
		let buffer = "";
		req.on("data", (data: string | Buffer) => {
			buffer += data.toString();
		});
		req.on("end", () => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end();
			if (buffer == "$$END$$") {
				syncSourceDirFromObj(SOURCE_DIR, JSON.parse(syncFsJson.toString()));
			} else {
				console.log("SyncToFS Load bytes:", buffer.length);
				syncFsJson += buffer;
			}
		});
	} else {
		if (typeof req.url == "string") {
			let args = url.parse(req.url, true).query;
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

http.get("http://localhost:8888?kill=true").on("error", e => {});

setTimeout(() => {
	http.createServer(onRequest).listen(8888, "0.0.0.0");
	if (program.sync) {
		console.log("Syncing..");
		sendSource([SRC_SYNC_TO_FS_LUA]);
	}
	console.log(util.format("[%s] Running on PROJECT_DIR(%s)", pkgjson.version, path.resolve(PROJECT_DIR)));
	requestSendFullUpdate(SOURCE_DIR);
	if (program.fullupdateonly) return;
	chokidar
		.watch(SOURCE_DIR, {
			ignored: /(^|[\/\\])\.(?![$\/\\])/,
			persistent: true,
			ignoreInitial: true,
			usePolling: program.poll ? true : false
		})
		.on("change", (path: string) => requestSendAddFilePath(path))
		.on("add", (path: string) => requestSendAddFilePath(path))
		.on("unlink", (path: string) => {
			requestSendRemoveFilePath(path);
			requestSendFullUpdate(SOURCE_DIR);
		});
}, 1000);
