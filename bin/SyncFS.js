"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var Utility_1 = require("./Utility");
function pathGetStat(path) {
    try {
        return fs.statSync(path);
    }
    catch (e) {
        return null;
    }
}
function mkdir(path) {
    console.log("Create[DIR]:", path);
    if (pathGetStat(path) == null) {
        fs.mkdirSync(path);
    }
}
function objRbxTraversal(objPath, obj) {
    for (var i = 0; i < obj.children.length; i++) {
        var child = obj.children[i];
        var childPath = path.resolve(objPath, child.name);
        if (Utility_1.isScript(child.type)) {
            childPath = childPath + "." + child.type + Utility_1.FSEXT_LUA;
            console.log("Create[FILE]:", childPath);
            if (pathGetStat(childPath) != null) {
                fs.unlinkSync(childPath);
            }
            fs.writeFileSync(childPath, child.source);
            childPath = childPath + "." + child.type;
            if (child.children.length > 0) {
                mkdir(childPath);
            }
        }
        else {
            mkdir(childPath);
        }
        objRbxTraversal(childPath, child);
    }
}
function syncSourceDirFromObj(sourceDir, rootObj) {
    objRbxTraversal(sourceDir, rootObj);
}
exports.syncSourceDirFromObj = syncSourceDirFromObj;
//# sourceMappingURL=SyncFS.js.map