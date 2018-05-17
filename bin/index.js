#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chokidar = require("chokidar");
const colors = require("colors");
const commander = require("commander");
const fs = require("fs");
const http = require("http");
const path = require("path");
const url = require("url");
const util = require("util");
const uuid = require("uuid/v1");
const child_process_1 = require("child_process");
const SyncFS_1 = require("./SyncFS");
const Utility_1 = require("./Utility");
let jsLog = console.log;
console.log = (...args) => jsLog(colors.red(colors.bold("[RbxRefresh]")), ...args);
class Project {
    constructor(projectDir) {
        this.projectDir = projectDir;
        if (!fs.existsSync(projectDir)) {
            throw new Error("Could not find project directory!");
        }
        this.sourceDir = projectDir.replace(/\/+$/, "") + "/src";
        if (!fs.existsSync(this.sourceDir)) {
            if (commander.sync) {
                fs.mkdirSync(this.sourceDir);
            }
            else {
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
let projects = [];
let pkgjson = require("./../package.json");
commander
    .version(pkgjson.version)
    .usage("rbxrefresh [options] [dir]")
    .arguments("[dir...]")
    .option("-s, --sync", "Enables sync to filesystem")
    .option("-f, --fullupdateonly", "Terminates server after full update")
    .option("-p, --poll", "Makes Chokidar use polling mode")
    .action((dirs) => {
    if (dirs) {
        dirs.forEach(dir => projects.push(new Project(dir)));
    }
    else {
        projects.push(new Project("."));
    }
})
    .parse(process.argv);
let doPlaceIdGuard = false;
let placeIdSet = new Set();
projects.forEach(project => {
    let config = {};
    try {
        let configPath = project.projectDir + "/.rbxrefreshrc";
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, "utf8"));
        }
        else if (commander.sync) {
            // create .rbxrefreshrc?
        }
    }
    catch (e) { }
    let localSet = new Set();
    let placeIdData = config.placeId;
    if (typeof placeIdData === "number") {
        localSet.add(placeIdData);
    }
    else if (typeof placeIdData === "string") {
        let id = parseInt(placeIdData);
        if (!isNaN(id)) {
            localSet.add(id);
        }
        else {
            throw new Error("Invalid data type!");
        }
    }
    else if (typeof placeIdData === "object") {
        // array
        for (let id of placeIdData) {
            if (typeof id === "number") {
                localSet.add(id);
            }
            else if (typeof id === "string") {
                let idNum = parseInt(id);
                if (!isNaN(idNum)) {
                    localSet.add(idNum);
                }
                else {
                    throw new Error("Invalid data type!");
                }
            }
        }
    }
    else {
        // this should probably be more specific
        console.error("Bad placeId type in .rbxrefreshrc!");
        process.exit();
    }
    // grab the intersection of the two sets
    if (localSet.size > 0) {
        doPlaceIdGuard = true;
        if (placeIdSet.size > 0) {
            placeIdSet = new Set([...localSet].filter(x => placeIdSet.has(x)));
        }
        else {
            placeIdSet = localSet;
        }
    }
});
let placeIdLuaArray = Utility_1.jsArrayToLuaArrayString(Array.from(placeIdSet));
console.log("placeIdLuaArray", placeIdLuaArray);
function generateUpdateAllFilesCodeRbxTraversal(sourceDir, dir, outCodeLines) {
    fs.readdirSync(dir).forEach(itrFileName => {
        let itrFilePath = path.resolve(dir, itrFileName);
        if (fs.statSync(itrFilePath).isDirectory()) {
            generateUpdateAllFilesCodeRbxTraversal(sourceDir, itrFilePath, outCodeLines);
        }
        else {
            let fileExt = path.extname(itrFilePath);
            if (fileExt === Utility_1.FSEXT_LUA || fileExt === Utility_1.FSEXT_MOON) {
                outCodeLines.push(generateUpdateFileCode(sourceDir, itrFilePath));
            }
        }
    });
}
function getAssetRbxInfoFromFilePath(sourceDir, filePath) {
    let assetFullName = path.basename(filePath, path.extname(filePath));
    let assetRbxName = "";
    let assetType = path.extname(assetFullName).replace(".", "");
    if (assetType === "") {
        if (filePath.indexOf("ServerScriptService") !== -1) {
            assetType = Utility_1.RBXTYPE_SCRIPT;
        }
        else if (filePath.indexOf("StarterPlayer") !== -1) {
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
    let relativeFilePathArray = path.relative(sourceDir, filePath).split(path.sep);
    relativeFilePathArray.pop();
    return {
        name: assetRbxName,
        type: assetType,
        path: relativeFilePathArray
    };
}
function generateUpdateFileCode(sourceDir, filePath) {
    let fileExt = path.extname(filePath);
    if (fileExt !== Utility_1.FSEXT_LUA && fileExt !== Utility_1.FSEXT_MOON) {
        return "";
    }
    let assetInfo = getAssetRbxInfoFromFilePath(sourceDir, filePath);
    let fileContents = "";
    if (fileExt === Utility_1.FSEXT_LUA) {
        fileContents = fs.readFileSync(filePath).toString();
    }
    else if (fileExt === Utility_1.FSEXT_MOON) {
        fileContents = child_process_1.spawnSync("moonc -p " + filePath, {
            shell: true
        }).stdout.toString();
    }
    if (fileContents.length === 0) {
        return "";
    }
    return util.format(Utility_1.SRC_SET_SOURCE_CALL_LUA, assetInfo.name, assetInfo.type, Utility_1.jsArrayToLuaArrayString(assetInfo.path), fileContents);
}
function requestSendAddFilePath(sourceDir, filePath, attempt = 1) {
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
    sendSource(util.format(Utility_1.SRC_PRINT_LUA, debugOutput), Utility_1.SRC_UTILITY_FUNC_LUA, code);
}
function requestSendRemoveFilePath(sourceDir, filePath) {
    let assetInfo = getAssetRbxInfoFromFilePath(sourceDir, filePath);
    let debugOutput = util.format("removeFile(%s, %s, [%s])", assetInfo.name, assetInfo.type, assetInfo.path.join(", "));
    let code = util.format(Utility_1.SRC_REMOVE_FILE_CALL_LUA, assetInfo.name, assetInfo.type, Utility_1.jsArrayToLuaArrayString(assetInfo.path));
    console.log(debugOutput);
    sendSource(util.format(Utility_1.SRC_PRINT_LUA, debugOutput), Utility_1.SRC_UTILITY_FUNC_LUA, code);
}
function requestSendFullUpdate(dir) {
    let codeLines = [];
    generateUpdateAllFilesCodeRbxTraversal(dir, dir, codeLines);
    let code = codeLines.join("\n");
    sendSource(util.format(Utility_1.SRC_PRINT_LUA, "fullUpdate() [ " + dir + " ]"), Utility_1.SRC_UTILITY_FUNC_LUA, code);
}
let responseQueue = [];
let codeQueue = [];
function sendSource(...codeArray) {
    if (doPlaceIdGuard) {
        codeArray.unshift(util.format(Utility_1.SRC_GUARD_LUA, placeIdLuaArray));
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
function onRequest(req, res) {
    if (req.method === "POST") {
        let buffer = "";
        req.on("data", (data) => {
            buffer += data.toString();
        });
        req.on("end", () => {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end();
            if (buffer === "$$END$$") {
                SyncFS_1.syncSourceDirFromObj(projects[0].sourceDir, JSON.parse(syncFsJson.toString()));
            }
            else {
                console.log("SyncToFS Load bytes:", buffer.length);
                syncFsJson += buffer;
            }
        });
    }
    else if (req.method === "GET") {
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
                    if (commander.fullupdateonly) {
                        if (codeQueue.length === 0) {
                            process.exit();
                        }
                    }
                });
            }
            res.end();
        }
        else {
            responseQueue.push(res);
        }
    }
}
http.get("http://localhost:8888?id=" + sessionId).on("error", _ => { });
setTimeout(() => {
    http.createServer(onRequest).listen(8888, "0.0.0.0");
    if (commander.sync) {
        console.log("Syncing..");
        sendSource(Utility_1.SRC_SYNC_TO_FS_LUA);
    }
    console.log(util.format("RbxRefresh v%s running on:", pkgjson.version));
    projects.forEach(project => {
        console.log("\t", path.resolve(project.projectDir));
        requestSendFullUpdate(project.sourceDir);
    });
    if (commander.fullupdateonly) {
        return;
    }
    projects.forEach(project => {
        let srcPath = path.resolve(project.sourceDir);
        chokidar
            .watch(srcPath, {
            ignored: /(^|[\/\\])\../,
            ignoreInitial: true
        })
            .on("change", (path) => requestSendAddFilePath(srcPath, path))
            .on("add", (path) => requestSendAddFilePath(srcPath, path))
            .on("unlink", (path) => {
            requestSendRemoveFilePath(srcPath, path);
            requestSendFullUpdate(srcPath);
        });
    });
}, 1000);
//# sourceMappingURL=index.js.map