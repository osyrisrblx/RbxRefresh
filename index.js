/*
TODO:
	- Set up process for studio to filesystem sync
*/

var chokidar = require("chokidar");
var fs = require("fs");
var http = require("http");
var url = require("url");
var path = require('path');
var util = require('util');

var SOURCE_DIR = process.argv[2];

var __launch_sync_to_fs = false;
if (process.argv[3]) {
	__launch_sync_to_fs = (process.argv[3] == "sync_to_fs")
}

var SRC_UTILITY_FUNC_LUA = fs.readFileSync(
	path.resolve(
		__dirname,
		"templates/UtilityFuncLua.template.lua")).toString();

var SRC_SET_SOURCE_CALL_LUA = fs.readFileSync(
	path.resolve(
		__dirname,
		"templates/SetSourceCall.template.lua")).toString();

var SRC_REMOVE_FILE_CALL_LUA = fs.readFileSync(
	path.resolve(
		__dirname,
		"templates/RemoveFileCall.template.lua")).toString()

var SRC_PRINT_LUA = fs.readFileSync(
	path.resolve(
		__dirname,
		"templates/Print.template.lua")).toString()

var FSEXT_LUA = ".lua";

var RBXTYPE_MODULESCRIPT = "ModuleScript"
var RBXTYPE_LOCALSCRIPT = "LocalScript"
var RBXTYPE_SCRIPT = "Script"

function generateUpdateAllFilesCode_rTraversal(dir, outCodeLines) {
	fs.readdirSync(dir).forEach(function(itrFileName) {
		var itrFilePath = path.resolve(dir, itrFileName);
		if (fs.statSync(itrFilePath).isDirectory()) {
			generateUpdateAllFilesCode_rTraversal(itrFilePath, outCodeLines);
		} else {
			var fileExt = path.extname(itrFilePath);
			if (fileExt == FSEXT_LUA) {
				outCodeLines.push(generateUpdateFileCode(itrFilePath));
			}
		}
	});
}

function generateUpdateAllFilesCodeLines(dir) {
	var outCodeLines = [];
	generateUpdateAllFilesCode_rTraversal(dir, outCodeLines);
	return outCodeLines;
}

function jsArrayToLuaArrayString(jsarray) {
	return "{" + jsarray.map(function(x) { return "\"" + x + "\"" }).join() + "}";
}

function matchAssetRbxType(str) {
	if (str == RBXTYPE_LOCALSCRIPT) { return RBXTYPE_LOCALSCRIPT; }
	if (str == RBXTYPE_SCRIPT) { return RBXTYPE_SCRIPT; }
	if (str == RBXTYPE_MODULESCRIPT) { return RBXTYPE_MODULESCRIPT; }
	console.warn("Unknown file subext:"+str);
	return RBXTYPE_MODULESCRIPT;
}

function getAssetRbxInfoFromFilepath(filepath) {
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
		assetRbxName = path.basename(assetFullName, "." + assetRbxType);
		assetRbxType = matchAssetRbxType(assetRbxType);
	}

	var relativeFilepathArray = path.relative(SOURCE_DIR, filepath).split(path.sep);
	relativeFilepathArray.pop();

	return {
		RbxName: assetRbxName,
		RbxType: assetRbxType,
		RbxPath: relativeFilepathArray
	}
}

function generateUpdateFileCode(filepath) {
	var fileExt = path.extname(filepath);
	if (fileExt != FSEXT_LUA) {
		return "";
	}
	var assetInfo = getAssetRbxInfoFromFilepath(filepath);
	var fileContents = fs.readFileSync(filepath).toString();
	return util.format(
		SRC_SET_SOURCE_CALL_LUA,
		assetInfo.RbxName,
		assetInfo.RbxType,
		jsArrayToLuaArrayString(assetInfo.RbxPath),
		fileContents);
}

function requestSendAddFilepath(filepath) {
	var code = generateUpdateFileCode(filepath);

	var assetInfo = getAssetRbxInfoFromFilepath(filepath);
	var debugOutput = util.format("---setSource(%s,%s,[%s])",assetInfo.RbxName,assetInfo.RbxType,assetInfo.RbxPath.join())

	console.log(debugOutput)
	sendSource(util.format(SRC_PRINT_LUA, debugOutput) + ";" + SRC_UTILITY_FUNC_LUA + ";" + code + ";" + util.format(SRC_PRINT_LUA, "--- Completed"));
}

function requestSendRemoveFilepath(filepath) {
	var assetInfo = getAssetRbxInfoFromFilepath(filepath);
	var debugOutput = util.format("---removeFile(%s,%s,[%s])",assetInfo.RbxName,assetInfo.RbxType,assetInfo.RbxPath.join());

	var code = util.format(
		SRC_REMOVE_FILE_CALL_LUA,
		assetInfo.RbxName,
		assetInfo.RbxType,
		jsArrayToLuaArrayString(assetInfo.RbxPath));

	console.log(debugOutput)
	sendSource(util.format(SRC_PRINT_LUA, debugOutput) + ";" + SRC_UTILITY_FUNC_LUA + ";" + code + ";" + util.format(SRC_PRINT_LUA, "--- Completed"));
}

function requestSendFullUpdate(dir) {
	var code = generateUpdateAllFilesCodeLines(dir).join(";");

	var debugOutput = util.format("---fullUpdate()")
	console.log(debugOutput)
	sendSource(util.format(SRC_PRINT_LUA, debugOutput) + ";" + SRC_UTILITY_FUNC_LUA + ";" + code + ";" + util.format(SRC_PRINT_LUA, "--- Completed"));
}

var _requestQueue = [];
var _sendQueue = [];

function writeCodeToRequest(code,request) {
	request.writeHead(200, {"Content-Type": "text/plain"});
	request.end(code);
}

function sendSource(code) {
	if (_requestQueue.length > 0) {
		writeCodeToRequest(code,_requestQueue.shift());
	} else {
		_sendQueue.push(code);
	}
}

function onRequest(req, res) {
	var args = url.parse(req.url, true).query;
	if (args.kill == "true") {
		process.exit();
		return;
	}
	if (_sendQueue.length > 0) {
		writeCodeToRequest(_sendQueue.shift(),res)
	} else {
		_requestQueue.push(res);
	}
}

http.get("http://localhost:8888?kill=true").on("error", (e) => {});
setTimeout(function() {
	http.createServer(onRequest).listen(8888, "0.0.0.0");
	if (__launch_sync_to_fs) {

		return;
	}
	
	console.log(util.format("RbxRefresh running on dir(%s)", SOURCE_DIR));
	requestSendFullUpdate(SOURCE_DIR);

	chokidar.watch(SOURCE_DIR, {
		ignored: /[\/\\]\./,
		persistent: true
	})
	.on("change", function(filepath) {
		requestSendAddFilepath(filepath);
	})
	.on("add",function(filepath) {
		requestSendAddFilepath(filepath);
	})
	.on("unlink",function(filepath) {
		requestSendRemoveFilepath(filepath);
		requestSendFullUpdate(SOURCE_DIR);
	});

}, 1000);
