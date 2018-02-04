#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chokidar = require("chokidar");
var colors = require("colors");
var fs = require("fs");
var http = require("http");
var path = require("path");
var url = require("url");
var util = require("util");
var child_process_1 = require("child_process");
var SyncFS_1 = require("./SyncFS");
var Utility_1 = require("./Utility");
var jsLog = console.log;
console.log = function () {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    return jsLog.apply(void 0, [colors.red(colors.bold("[RbxRefresh]"))].concat(args));
};
var PROJECT_DIR = ".";
var pkgjson = require("./../package.json");
var program = require("commander");
program
    .version(pkgjson.version)
    .usage("rbxrefresh [options] [dir]")
    .arguments("[dir]")
    .option("-s, --sync", "Enables sync to filesystem")
    .option("-f, --fullupdateonly", "Terminates server after full update")
    .option("-p, --poll", "Makes Chokidar use polling mode")
    .action(function (env) {
    if (env) {
        PROJECT_DIR = env;
    }
})
    .parse(process.argv);
if (!fs.existsSync(PROJECT_DIR)) {
    throw new Error("Could not find project directory!");
}
var SOURCE_DIR = PROJECT_DIR + "/src";
if (!fs.existsSync(SOURCE_DIR)) {
    if (program.sync) {
        fs.mkdirSync(SOURCE_DIR);
    }
    else {
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
var config = {};
try {
    if (fs.existsSync(PROJECT_DIR + "/.rbxrefreshrc")) {
        config = JSON.parse(fs.readFileSync(PROJECT_DIR + "/.rbxrefreshrc", "utf8"));
    }
    else if (program.sync) {
        // create .rbxrefreshrc
    }
}
catch (e) { }
var doPlaceIdGuard = true;
var placeIdJsArray = [];
if (typeof config.placeId == "number") {
    placeIdJsArray.push(config.placeId);
}
else if (typeof config.placeId == "object") {
    placeIdJsArray = config.placeId;
}
else if (typeof config.placeId == "undefined") {
    // placeId either didn't exist or wasn't an expected type
    doPlaceIdGuard = false;
}
else {
    console.error("Bad placeId type in .rbxrefreshrc!");
    process.exit();
}
var placeIdLuaArray = Utility_1.jsArrayToLuaArrayString(placeIdJsArray);
function generateUpdateAllFilesCodeRbxTraversal(dir, outCodeLines) {
    fs.readdirSync(dir).forEach(function (itrFileName) {
        var itrFilePath = path.resolve(dir, itrFileName);
        if (fs.statSync(itrFilePath).isDirectory()) {
            generateUpdateAllFilesCodeRbxTraversal(itrFilePath, outCodeLines);
        }
        else {
            var fileExt = path.extname(itrFilePath);
            if (fileExt == Utility_1.FSEXT_LUA || fileExt == Utility_1.FSEXT_MOON) {
                outCodeLines.push(generateUpdateFileCode(itrFilePath));
            }
        }
    });
}
function generateUpdateAllFilesCodeLines(dir) {
    var outCodeLines = [];
    generateUpdateAllFilesCodeRbxTraversal(dir, outCodeLines);
    return outCodeLines;
}
function getAssetRbxInfoFromFilepath(filepath) {
    var assetFullName = path.basename(filepath, path.extname(filepath));
    var assetRbxName = "";
    var assetRbxType = path.extname(assetFullName).replace(".", "");
    if (assetRbxType == "") {
        if (filepath.indexOf("ServerScriptService") != -1) {
            assetRbxType = Utility_1.RBXTYPE_SCRIPT;
        }
        else if (filepath.indexOf("StarterPlayer") != -1) {
            assetRbxType = Utility_1.RBXTYPE_LOCALSCRIPT;
        }
        else {
            assetRbxType = Utility_1.RBXTYPE_MODULESCRIPT;
        }
        assetRbxName = assetFullName;
    }
    else {
        assetRbxName = path.basename(assetFullName, "." + assetRbxType);
        assetRbxType = Utility_1.matchAssetRbxType(assetRbxType);
    }
    var relativeFilepathArray = path.relative(SOURCE_DIR, filepath).split(path.sep);
    relativeFilepathArray.pop();
    return {
        RbxName: assetRbxName,
        RbxType: assetRbxType,
        RbxPath: relativeFilepathArray
    };
}
function generateUpdateFileCode(filepath) {
    var fileExt = path.extname(filepath);
    if (fileExt != Utility_1.FSEXT_LUA && fileExt != Utility_1.FSEXT_MOON) {
        return "";
    }
    var assetInfo = getAssetRbxInfoFromFilepath(filepath);
    var fileContents;
    if (fileExt == Utility_1.FSEXT_LUA) {
        fileContents = fs.readFileSync(filepath).toString();
    }
    else if (fileExt == Utility_1.FSEXT_MOON) {
        fileContents = child_process_1.spawnSync("moonc -p " + filepath, { shell: true }).stdout.toString();
    }
    return util.format(Utility_1.SRC_SET_SOURCE_CALL_LUA, assetInfo.RbxName, assetInfo.RbxType, Utility_1.jsArrayToLuaArrayString(assetInfo.RbxPath), fileContents);
}
function requestSendAddFilepath(filepath) {
    var code = generateUpdateFileCode(filepath);
    var assetInfo = getAssetRbxInfoFromFilepath(filepath);
    var debugOutput = util.format("setSource(%s, %s, [%s])", assetInfo.RbxName, assetInfo.RbxType, assetInfo.RbxPath.join(", "));
    console.log(debugOutput);
    sendSource(util.format(Utility_1.SRC_PRINT_LUA, debugOutput) + "\n" + Utility_1.SRC_UTILITY_FUNC_LUA + "\n" + code + "\n" + util.format(Utility_1.SRC_PRINT_LUA, "Completed"));
}
function requestSendRemoveFilepath(filepath) {
    var assetInfo = getAssetRbxInfoFromFilepath(filepath);
    var debugOutput = util.format("removeFile(%s, %s, [%s])", assetInfo.RbxName, assetInfo.RbxType, assetInfo.RbxPath.join(", "));
    var code = util.format(Utility_1.SRC_REMOVE_FILE_CALL_LUA, assetInfo.RbxName, assetInfo.RbxType, Utility_1.jsArrayToLuaArrayString(assetInfo.RbxPath));
    console.log(debugOutput);
    sendSource(util.format(Utility_1.SRC_PRINT_LUA, debugOutput) + "\n" + Utility_1.SRC_UTILITY_FUNC_LUA + "\n" + code + "\n" + util.format(Utility_1.SRC_PRINT_LUA, "Completed"));
}
function requestSendFullUpdate(dir) {
    var code = generateUpdateAllFilesCodeLines(dir).join("\n");
    var debugOutput = util.format("fullUpdate()");
    console.log(debugOutput);
    sendSource(util.format(Utility_1.SRC_PRINT_LUA, debugOutput) + "\n" + Utility_1.SRC_UTILITY_FUNC_LUA + "\n" + code + "\n" + util.format(Utility_1.SRC_PRINT_LUA, "Completed"));
}
var responseQueue = [];
var codeQueue = [];
function writeCodeToRequest(code, response) {
    if (!code || !response)
        return;
    response.writeHead(200, { "Content-Type": "text/plain" });
    response.end(code, function () {
        if (program.fullupdateonly) {
            if (codeQueue.length == 0) {
                process.exit();
            }
        }
    });
}
function sendSource(code) {
    if (doPlaceIdGuard) {
        code = util.format(Utility_1.SRC_GUARD_LUA, placeIdLuaArray) + "\n" + code;
    }
    if (responseQueue.length > 0) {
        while (responseQueue.length > 0) {
            writeCodeToRequest(code, responseQueue.shift());
        }
    }
    else {
        codeQueue.push(code);
    }
}
var syncFsJson = "";
function onRequest(req, res) {
    if (req.method == "POST") {
        var buffer = "";
        req.on("data", function (data) {
            buffer += data;
        });
        req.on("end", function () {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("ok");
            if (buffer == "$$END$$") {
                SyncFS_1.syncSourceDirFromObj(SOURCE_DIR, JSON.parse(syncFsJson.toString()));
            }
            else {
                console.log("SyncToFS Load bytes:", buffer.length);
                syncFsJson += buffer;
            }
        });
    }
    else {
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
        }
        else {
            responseQueue.push(res);
        }
    }
}
http.get("http://localhost:8888?kill=true").on("error", function (e) { });
setTimeout(function () {
    http.createServer(onRequest).listen(8888, "0.0.0.0");
    if (program.sync) {
        console.log("Syncing..");
        sendSource(Utility_1.SRC_SYNC_TO_FS_LUA);
    }
    console.log(util.format("Running on PROJECT_DIR(%s)", path.resolve(PROJECT_DIR)));
    requestSendFullUpdate(SOURCE_DIR);
    if (program.fullupdateonly)
        return;
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
