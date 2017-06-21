/*
TODO:
	- Sync file deletion and creation
	- Set up process for studio to filesystem sync
*/

var chokidar = require("chokidar");
var fs = require("fs");
var http = require("http");
var url = require("url");
var path = require('path');
var util = require('util');

var SOURCE_DIR = process.argv[2];

var responseQueue = [];
var SRC_UTILITY_FUNC_LUA = fs.readFileSync(
	path.resolve(
		__dirname,
		"templates/UtilityFuncLua.template.lua")).toString();

var SRC_SET_SOURCE_CALL_LUA = fs.readFileSync(
		path.resolve(
			__dirname,
			"templates/SetSourceCall.template.lua")).toString();

var FSEXT_LUA = ".lua";

var RBXTYPE_MODULESCRIPT = "ModuleScript"
var RBXTYPE_LOCALSCRIPT = "LocalScript"
var RBXTYPE_SCRIPT = "Script"

function recursiveFileSearchSync(dir, outCodeLines) {
	fs.readdirSync(dir).forEach(function(itrFileName) {
		var itrFilePath = path.resolve(dir, itrFileName);
		if (fs.statSync(itrFilePath).isDirectory()) {
			recursiveFileSearchSync(itrFilePath, outCodeLines);
		} else {
			var fileExt = path.extname(itrFilePath);
			if (fileExt == FSEXT_LUA) {
				outCodeLines.push(updateSingleFile(itrFilePath));
			}
		}
	});
}

function updateAllFiles() {
	var outCodeLines = [];
	recursiveFileSearchSync(SOURCE_DIR, outCodeLines);
	return outCodeLines.join("\n");
}

function updateSingleFile(filepath) {
	var fileExt = path.extname(filepath);
	if (fileExt != FSEXT_LUA) {
		return "";
	}

	var assetFullName = path.basename(filepath, FSEXT_LUA);
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
		assetRbxName = path.basename(assetFullName, "." + assetRbxType)
	}

	var relativeFilepathArray = path.relative(SOURCE_DIR, filepath).split(path.sep);
	relativeFilepathArray.pop();

	var fileContents = fs.readFileSync(filepath).toString();

	return util.format(
		SRC_SET_SOURCE_CALL_LUA,
		assetRbxName,
		assetRbxType,
		"{" + relativeFilepathArray.map(function(x) { return "\"" + x + "\"" }).join() + "}",
		fileContents);
}

var fullUpdateNext = false;
var hasInitialFullUpdated = false;

function onUpdate(filepath) {
	var wasFullUpdate = fullUpdateNext;
	var code = "";
	if (fullUpdateNext) {
		fullUpdateNext = false;
		code = updateAllFiles();
	} else {
		code = updateSingleFile(filepath);
	}

	console.log(util.format("file(%s) fullUpdate(%s) changed, sending...", filepath, wasFullUpdate.toString()));
	while (responseQueue.length > 0) {
		with (responseQueue.shift()) {
			writeHead(200, {"Content-Type": "text/plain"});
			end(SRC_UTILITY_FUNC_LUA + code + "print('Injection Complete')");
		}
	}
}

function onRequest(req, res) {
	var args = url.parse(req.url, true).query;
	if (args.kill == "true") {
		process.exit();
		return;
	}

	if (hasInitialFullUpdated == false) {
		responseQueue.push(res);
		hasInitialFullUpdated = true;
		fullUpdateNext = true;
		onUpdate(SOURCE_DIR);
		return;
	}

	if (args.fullUpdate == "true") {
		fullUpdateNext = true;
	}
	responseQueue.push(res);
}

function setupServer() {
	http.createServer(onRequest).listen(8888, "0.0.0.0");
	chokidar.watch(SOURCE_DIR, {
		ignored: /[\/\\]\./,
		persistent: true
	}).on("change", onUpdate);
	console.log(util.format("RbxRefresh running on dir(%s)", SOURCE_DIR));
}

http.get("http://localhost:8888?kill=true").on("error", (e) => {});
setTimeout(setupServer, 1000);
