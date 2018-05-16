#!/usr/bin/env node
import * as chokidar from "chokidar";
import * as colors from "colors";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as program from "commander";
import * as url from "url";
import * as util from "util";
import * as uuid from "uuid/v1";

import { spawnSync } from "child_process";

import { syncSourceDirFromObj } from "./SyncFS";
import {
	jsArrayToLuaArrayString,
	matchAssetRbxType,
	FSEXT_LUA,
	FSEXT_MOON,
	RBXTYPE_LOCALSCRIPT,
	RBXTYPE_MODULESCRIPT,
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

class Project {
	public sourceDir: string;
	constructor(public projectDir: string) {
		if (!fs.existsSync(projectDir)) {
			throw new Error("Could not find project directory!");
		}
		this.sourceDir = projectDir.replace(/\/+$/, "") + "/src";
		if (!fs.existsSync(this.sourceDir)) {
			if (program.sync) {
				fs.mkdirSync(this.sourceDir);
			} else {
				// let's try old behavior?
				this.sourceDir = this.projectDir;
				this.projectDir = this.sourceDir + "/../";
				if (!fs.existsSync(this.projectDir)) {
					throw new Error("Could not find project directory!");
				}
				if (!fs.existsSync(this.sourceDir)) {
					throw new Error("Could not find src directory!");
				}
			}
		}
	}
}

let projects: Project[] = [];

let pkgjson = require("./../package.json");
program
	.version(pkgjson.version)
	.usage("rbxrefresh [options] [dir]")
	.arguments("[dir...]")
	.option("-s, --sync", "Enables sync to filesystem")
	.option("-f, --fullupdateonly", "Terminates server after full update")
	.option("-p, --poll", "Makes Chokidar use polling mode")
	.action((dirs?: string[]) => {
		if (dirs) {
			dirs.forEach(dir => projects.push(new Project(dir)));
		} else {
			projects.push(new Project("."));
		}
	})
	.parse(process.argv);

let doPlaceIdGuard = true;
let placeIdSet = new Set<number>();

projects.forEach(project => {
	let config: RbxRefreshConfig = {};
	try {
		let configPath = project.projectDir + "/.rbxrefreshrc";
		if (fs.existsSync(configPath)) {
			config = JSON.parse(fs.readFileSync(configPath, "utf8"));
		} else if (program.sync) {
			// create .rbxrefreshrc?
		}
	} catch (e) {}
	let placeIdData = config.placeId;
	if (typeof placeIdData === "number") {
		placeIdSet.add(placeIdData);
	} else if (typeof placeIdData === "string") {
		let id = parseInt(placeIdData);
		if (!isNaN(id)) {
			placeIdSet.add(id);
		} else {
			throw new Error("Invalid data type!");
		}
	} else if (typeof placeIdData === "object") {
		// array
		for (let id of placeIdData) {
			if (typeof id === "number") {
				placeIdSet.add(id);
			} else if (typeof id === "string") {
				let idNum = parseInt(id);
				if (!isNaN(idNum)) {
					placeIdSet.add(idNum);
				} else {
					throw new Error("Invalid data type!");
				}
			}
		}
	} else {
		doPlaceIdGuard = false;
		// this should probably be more specific
		console.error("Bad placeId type in .rbxrefreshrc!");
		process.exit();
	}
});
let placeIdLuaArray = jsArrayToLuaArrayString(Array.from(placeIdSet));

function generateUpdateAllFilesCodeRbxTraversal(sourceDir: string, dir: string, outCodeLines: string[]) {
	fs.readdirSync(dir).forEach(itrFileName => {
		let itrFilePath = path.resolve(dir, itrFileName);
		if (fs.statSync(itrFilePath).isDirectory()) {
			generateUpdateAllFilesCodeRbxTraversal(sourceDir, itrFilePath, outCodeLines);
		} else {
			let fileExt = path.extname(itrFilePath);
			if (fileExt === FSEXT_LUA || fileExt === FSEXT_MOON) {
				outCodeLines.push(generateUpdateFileCode(sourceDir, itrFilePath));
			}
		}
	});
}

function getAssetRbxInfoFromFilePath(sourceDir: string, filePath: string): RbxInfo {
	let assetFullName = path.basename(filePath, path.extname(filePath));
	let assetRbxName = "";
	let assetType = path.extname(assetFullName).replace(".", "");

	if (assetType === "") {
		if (filePath.indexOf("ServerScriptService") !== -1) {
			assetType = RBXTYPE_SCRIPT;
		} else if (filePath.indexOf("StarterPlayer") !== -1) {
			assetType = RBXTYPE_LOCALSCRIPT;
		} else {
			assetType = RBXTYPE_MODULESCRIPT;
		}
		assetRbxName = assetFullName;
	} else {
		assetRbxName = path.basename(assetFullName, "." + assetType);
		assetType = matchAssetRbxType(assetType);
	}

	let relativeFilePathArray = path.relative(sourceDir, filePath).split(path.sep);
	relativeFilePathArray.pop();

	return {
		name: assetRbxName,
		type: assetType,
		path: relativeFilePathArray
	};
}

function generateUpdateFileCode(sourceDir: string, filePath: string): string {
	let fileExt = path.extname(filePath);
	if (fileExt !== FSEXT_LUA && fileExt !== FSEXT_MOON) {
		return "";
	}
	let assetInfo = getAssetRbxInfoFromFilePath(sourceDir, filePath);
	let fileContents = "";
	if (fileExt === FSEXT_LUA) {
		fileContents = fs.readFileSync(filePath).toString();
	} else if (fileExt === FSEXT_MOON) {
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

function requestSendAddFilePath(sourceDir: string, filePath: string, attempt = 1) {
	let code = generateUpdateFileCode(sourceDir, filePath);
	if (code.length === 0) {
		console.log("File empty!");
		if (attempt < 5) {
			console.log("Retrying..");
			setTimeout(requestSendAddFilePath, 100, sourceDir, filePath, attempt + 1);
			return;
		}
	}
	let assetInfo = getAssetRbxInfoFromFilePath(sourceDir, filePath);
	let debugOutput = util.format("setSource(%s, %s, [%s])", assetInfo.name, assetInfo.type, assetInfo.path.join(", "));
	console.log(debugOutput);
	sendSource(util.format(SRC_PRINT_LUA, debugOutput), SRC_UTILITY_FUNC_LUA, code);
}

function requestSendRemoveFilePath(sourceDir: string, filePath: string) {
	let assetInfo = getAssetRbxInfoFromFilePath(sourceDir, filePath);
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
	sendSource(util.format(SRC_PRINT_LUA, debugOutput), SRC_UTILITY_FUNC_LUA, code);
}

function requestSendFullUpdate(dir: string) {
	let codeLines: string[] = [];
	generateUpdateAllFilesCodeRbxTraversal(dir, dir, codeLines);
	let code = codeLines.join("\n");
	sendSource(util.format(SRC_PRINT_LUA, "fullUpdate() [ " + dir + " ]"), SRC_UTILITY_FUNC_LUA, code);
}

let responseQueue: http.ServerResponse[] = [];
let codeQueue: string[] = [];

function sendSource(...codeArray: string[]) {
	if (doPlaceIdGuard) {
		codeArray.unshift(util.format(SRC_GUARD_LUA, placeIdLuaArray));
	}
	let code = codeArray.join("\n");
	codeQueue.push(code);
	if (responseQueue.length > 0) {
		let bin = [];
		while (responseQueue.length > 0) {
			let res = responseQueue.shift();
			if (res) {
				bin.push(res);
			}
		}

		bin.forEach(res => res.writeHead(200, { "Content-Type": "application/json" }));
		while (codeQueue.length > 0) {
			let code = codeQueue.shift();
			bin.forEach(res => res.write(code + "\n"));
		}
		bin.forEach(res => res.end());
	}
}

let syncFsJson = "";
let sessionId = uuid();

function onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
	if (req.method === "POST") {
		let buffer = "";
		req.on("data", (data: string | Buffer) => {
			buffer += data.toString();
		});
		req.on("end", () => {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end();
			if (buffer === "$$END$$") {
				syncSourceDirFromObj(projects[0].sourceDir, JSON.parse(syncFsJson.toString()));
			} else {
				console.log("SyncToFS Load bytes:", buffer.length);
				syncFsJson += buffer;
			}
		});
	} else if (req.method === "GET") {
		if (typeof req.url === "string") {
			let args = url.parse(req.url, true).query;
			if (args.id && args.id !== sessionId) {
				console.log("Killed by new RbxRefresh");
				process.exit();
				return;
			}
		}

		if (codeQueue.length > 0) {
			res.writeHead(200, { "Content-Type": "application/json" });
			while (codeQueue.length > 0) {
				let code = codeQueue.shift();
				if (!code) {
					break;
				}
				res.write(code + "\n", () => {
					if (program.fullupdateonly) {
						if (codeQueue.length === 0) {
							process.exit();
						}
					}
				});
			}
			res.end();
		} else {
			responseQueue.push(res);
		}
	}
}

http.get("http://localhost:8888?id=" + sessionId).on("error", _ => {});

setTimeout(() => {
	http.createServer(onRequest).listen(8888, "0.0.0.0");
	if (program.sync) {
		console.log("Syncing..");
		sendSource(SRC_SYNC_TO_FS_LUA);
	}

	console.log(util.format("RbxRefresh v%s running on:", pkgjson.version));
	projects.forEach(project => {
		console.log("\t", path.resolve(project.projectDir));
		requestSendFullUpdate(project.sourceDir);
	});

	if (program.fullupdateonly) {
		return;
	}

	projects.forEach(project => {
		let srcPath = path.resolve(project.sourceDir);
		chokidar
			.watch(srcPath, {
				ignored: /(^|[\/\\])\../,
				ignoreInitial: true
			})
			.on("change", (path: string) => requestSendAddFilePath(srcPath, path))
			.on("add", (path: string) => requestSendAddFilePath(srcPath, path))
			.on("unlink", (path: string) => {
				requestSendRemoveFilePath(srcPath, path);
				requestSendFullUpdate(srcPath);
			});
	});
}, 1000);
