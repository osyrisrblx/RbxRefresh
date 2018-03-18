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
    // array
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
function getAssetRbxInfoFromFilePath(filePath) {
    var assetFullName = path.basename(filePath, path.extname(filePath));
    var assetRbxName = "";
    var assetType = path.extname(assetFullName).replace(".", "");
    if (assetType == "") {
        if (filePath.indexOf("ServerScriptService") != -1) {
            assetType = Utility_1.RBXTYPE_SCRIPT;
        }
        else if (filePath.indexOf("StarterPlayer") != -1) {
            assetType = Utility_1.RBXTYPE_LOCALSCRIPT;
        }
        else {
            assetType = Utility_1.RBXTYPE_MODULESCRIPT;
        }
        assetRbxName = assetFullName;
    }
    else {
        assetRbxName = path.basename(assetFullName, "." + assetType);
        assetType = Utility_1.matchAssetRbxType(assetType);
    }
    var relativeFilePathArray = path.relative(SOURCE_DIR, filePath).split(path.sep);
    relativeFilePathArray.pop();
    return {
        name: assetRbxName,
        type: assetType,
        path: relativeFilePathArray
    };
}
function generateUpdateFileCode(filePath) {
    var fileExt = path.extname(filePath);
    if (fileExt != Utility_1.FSEXT_LUA && fileExt != Utility_1.FSEXT_MOON) {
        return "";
    }
    var assetInfo = getAssetRbxInfoFromFilePath(filePath);
    var fileContents = "";
    if (fileExt == Utility_1.FSEXT_LUA) {
        fileContents = fs.readFileSync(filePath).toString();
    }
    else if (fileExt == Utility_1.FSEXT_MOON) {
        fileContents = child_process_1.spawnSync("moonc -p " + filePath, {
            shell: true
        }).stdout.toString();
    }
    if (fileContents.length === 0) {
        return "";
    }
    return util.format(Utility_1.SRC_SET_SOURCE_CALL_LUA, assetInfo.name, assetInfo.type, Utility_1.jsArrayToLuaArrayString(assetInfo.path), fileContents);
}
function requestSendAddFilePath(filePath, attempt) {
    if (attempt === void 0) { attempt = 1; }
    var code = generateUpdateFileCode(filePath);
    if (code.length === 0) {
        console.log("File empty!");
        if (attempt < 5) {
            console.log("Retrying..");
            setTimeout(requestSendAddFilePath, 100, filePath, attempt + 1);
            return;
        }
    }
    var assetInfo = getAssetRbxInfoFromFilePath(filePath);
    var debugOutput = util.format("setSource(%s, %s, [%s])", assetInfo.name, assetInfo.type, assetInfo.path.join(", "));
    console.log(debugOutput);
    sendSource([
        util.format(Utility_1.SRC_PRINT_LUA, debugOutput),
        Utility_1.SRC_UTILITY_FUNC_LUA,
        code,
        util.format(Utility_1.SRC_PRINT_LUA, "Completed")
    ]);
}
function requestSendRemoveFilePath(filePath) {
    var assetInfo = getAssetRbxInfoFromFilePath(filePath);
    var debugOutput = util.format("removeFile(%s, %s, [%s])", assetInfo.name, assetInfo.type, assetInfo.path.join(", "));
    var code = util.format(Utility_1.SRC_REMOVE_FILE_CALL_LUA, assetInfo.name, assetInfo.type, Utility_1.jsArrayToLuaArrayString(assetInfo.path));
    console.log(debugOutput);
    sendSource([
        util.format(Utility_1.SRC_PRINT_LUA, debugOutput),
        Utility_1.SRC_UTILITY_FUNC_LUA,
        code,
        util.format(Utility_1.SRC_PRINT_LUA, "Completed")
    ]);
}
function requestSendFullUpdate(dir) {
    var code = generateUpdateAllFilesCodeLines(dir).join("\n");
    var debugOutput = util.format("fullUpdate()");
    console.log(debugOutput);
    sendSource([
        util.format(Utility_1.SRC_PRINT_LUA, debugOutput),
        Utility_1.SRC_UTILITY_FUNC_LUA,
        code,
        util.format(Utility_1.SRC_PRINT_LUA, "Completed")
    ]);
}
var responseQueue = [];
var codeQueue = [];
function writeCodeToRequest(code, response) {
    if (!code || !response)
        return;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(code, function () {
        if (program.fullupdateonly) {
            if (codeQueue.length == 0) {
                process.exit();
            }
        }
    });
}
function sendSource(codeArray) {
    if (doPlaceIdGuard) {
        codeArray.unshift(util.format(Utility_1.SRC_GUARD_LUA, placeIdLuaArray));
    }
    var code = codeArray.join("\n");
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
        var buffer_1 = "";
        req.on("data", function (data) {
            buffer_1 += data.toString();
        });
        req.on("end", function () {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end();
            if (buffer_1 == "$$END$$") {
                SyncFS_1.syncSourceDirFromObj(SOURCE_DIR, JSON.parse(syncFsJson.toString()));
            }
            else {
                console.log("SyncToFS Load bytes:", buffer_1.length);
                syncFsJson += buffer_1;
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
        sendSource([Utility_1.SRC_SYNC_TO_FS_LUA]);
    }
    console.log(util.format("[%s] Running on PROJECT_DIR(%s)", pkgjson.version, path.resolve(PROJECT_DIR)));
    requestSendFullUpdate(SOURCE_DIR);
    if (program.fullupdateonly)
        return;
    chokidar
        .watch(SOURCE_DIR, {
        ignored: /(^|[\/\\])\.(?![$\/\\])/,
        persistent: true,
        ignoreInitial: true,
        usePolling: program.poll ? true : false
    })
        .on("change", function (path) { return requestSendAddFilePath(path); })
        .on("add", function (path) { return requestSendAddFilePath(path); })
        .on("unlink", function (path) {
        requestSendRemoveFilePath(path);
        requestSendFullUpdate(SOURCE_DIR);
    });
}, 1000);
//# sourceMappingURL=index.js.map