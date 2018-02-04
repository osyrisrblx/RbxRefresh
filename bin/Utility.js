"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
exports.RBXTYPE_MODULESCRIPT = "ModuleScript";
exports.RBXTYPE_LOCALSCRIPT = "LocalScript";
exports.RBXTYPE_SCRIPT = "Script";
exports.RBXTYPE_MODULESCRIPT_ALIASES = ["ModuleScript", "module"];
exports.RBXTYPE_LOCALSCRIPT_ALIASES = ["LocalScript", "local", "client"];
exports.RBXTYPE_SCRIPT_ALIASES = ["Script", "server", ""];
exports.FSEXT_LUA = ".lua";
exports.FSEXT_MOON = ".moon";
function isScript(type) {
    return type == exports.RBXTYPE_MODULESCRIPT ||
        type == exports.RBXTYPE_LOCALSCRIPT ||
        type == exports.RBXTYPE_SCRIPT;
}
exports.isScript = isScript;
function isAliasOf(str, aliases) {
    for (var i = 0; i < aliases.length; i++) {
        if (aliases[i].toLowerCase() == str.toLowerCase()) {
            return true;
        }
    }
    return false;
}
exports.isAliasOf = isAliasOf;
function jsArrayToLuaArrayString(jsarray) {
    return "{" + jsarray.map(function (x) {
        if (typeof x == "number") {
            return x;
        }
        else if (typeof x == "string") {
            return "\"" + x + "\"";
        }
    }).join(", ") + "}";
}
exports.jsArrayToLuaArrayString = jsArrayToLuaArrayString;
function matchAssetRbxType(str) {
    if (isAliasOf(str, exports.RBXTYPE_LOCALSCRIPT_ALIASES)) {
        return exports.RBXTYPE_LOCALSCRIPT;
    }
    else if (isAliasOf(str, exports.RBXTYPE_SCRIPT_ALIASES)) {
        return exports.RBXTYPE_SCRIPT;
    }
    else if (isAliasOf(str, exports.RBXTYPE_MODULESCRIPT_ALIASES)) {
        return exports.RBXTYPE_MODULESCRIPT;
    }
    else {
        console.warn("Unknown file subext: " + str);
        return exports.RBXTYPE_MODULESCRIPT;
    }
}
exports.matchAssetRbxType = matchAssetRbxType;
function getTemplate(templatePath) {
    return fs.readFileSync(path.resolve(__dirname, templatePath)).toString();
}
exports.SRC_UTILITY_FUNC_LUA = getTemplate("./../templates/UtilityFuncLua.template.lua");
exports.SRC_SET_SOURCE_CALL_LUA = getTemplate("./../templates/SetSourceCall.template.lua");
exports.SRC_REMOVE_FILE_CALL_LUA = getTemplate("./../templates/RemoveFileCall.template.lua");
exports.SRC_PRINT_LUA = getTemplate("./../templates/Print.template.lua");
exports.SRC_SYNC_TO_FS_LUA = getTemplate("./../templates/SyncToFs.template.lua");
exports.SRC_GUARD_LUA = getTemplate("./../templates/Guard.template.lua");
