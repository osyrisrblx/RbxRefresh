#!/usr/bin/env node

var chokidar = require("chokidar");
var fs = require("fs");
var http = require("http");
var url = require("url");
var path = require("path");
var util = require("util");
var zlib = require('zlib');
var SyncFS = require("./SyncFS")
var Util = require("./Util")

var SOURCE_DIR;

var pkgjson = require("./package.json");
var program = require("commander");
program
	.version(pkgjson.version)
	.usage("rbxrefresh [options] <dir>")
	.arguments("<dir>")
	.option("-s, --sync", "Enables sync to filesystem")
	.action(function(env) {
		SOURCE_DIR = env;
	})
	.parse(process.argv);

function getTemplate(templatePath) {
	return fs.readFileSync(path.resolve(__dirname, templatePath)).toString();
}

var SRC_UTILITY_FUNC_LUA = getTemplate("templates/UtilityFuncLua.template.lua");
var SRC_SET_SOURCE_CALL_LUA = getTemplate("templates/SetSourceCall.template.lua");
var SRC_REMOVE_FILE_CALL_LUA = getTemplate("templates/RemoveFileCall.template.lua");
var SRC_PRINT_LUA = getTemplate("templates/Print.template.lua");
var SRC_SYNC_TO_FS_LUA = getTemplate("templates/SyncToFs.template.lua");

var FSEXT_LUA = Util.FSEXT_LUA;

var RBXTYPE_MODULESCRIPT_ALIASES = ["ModuleScript", "module"];
var RBXTYPE_LOCALSCRIPT_ALIASES = ["LocalScript", "local", "client"];
var RBXTYPE_SCRIPT_ALIASES = ["Script", "server", ""];

var RBXTYPE_MODULESCRIPT = Util.RBXTYPE_MODULESCRIPT
var RBXTYPE_LOCALSCRIPT = Util.RBXTYPE_LOCALSCRIPT
var RBXTYPE_SCRIPT = Util.RBXTYPE_SCRIPT

function isAliasOf(str, aliases) {
	for (var i = 0; i < aliases.length; i++) {
		if (aliases[i].toLowerCase() == str.toLowerCase()) {
			return true;
		}
	}
	return false;
}

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
	if (isAliasOf(str, RBXTYPE_LOCALSCRIPT_ALIASES)) {
		return RBXTYPE_LOCALSCRIPT;
	} else if (isAliasOf(str, RBXTYPE_SCRIPT_ALIASES)) {
		return RBXTYPE_SCRIPT;
	} else if (isAliasOf(str, RBXTYPE_MODULESCRIPT_ALIASES)) {
		return RBXTYPE_MODULESCRIPT;
	} else {
		console.warn("Unknown file subext:" + str);
		return RBXTYPE_MODULESCRIPT;
	}
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
		fileContents
	);
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

var _sync_fs_json = "";

function onRequest(req, res) {
	if (req.method == 'POST') {
		var buffer = "";
		req.on('data', function (data) {
				buffer += data;
		});
		req.on('end', function () {
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end('ok');

			if (buffer == "$$END$$") {
				var obj_root = JSON.parse(_sync_fs_json.toString());
				SyncFS.SyncSourceDirFromObj(SOURCE_DIR,obj_root);
				process.exit();
			} else {
				console.log("SYNC_FS_BUFFER + ",buffer.length)
				_sync_fs_json += buffer;
			}
		});
		return;
	}

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
	if (program.sync) {
		sendSource(SRC_SYNC_TO_FS_LUA);
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
