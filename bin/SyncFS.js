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
    for (var i = 0; i < obj.Children.length; i++) {
        var child = obj.Children[i];
        var childPath = path.resolve(objPath, child.Name);
        if (Utility_1.isScript(child.Type)) {
            childPath = childPath + "." + child.Type + Utility_1.FSEXT_LUA;
            console.log("Create[FILE]:", childPath);
            if (pathGetStat(childPath) != null) {
                fs.unlinkSync(childPath);
            }
            fs.writeFileSync(childPath, child.Source);
            childPath = childPath + "." + child.Type;
            if (child.Children.length > 0) {
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
