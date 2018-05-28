import * as fs from "fs";
import * as path from "path";

export const RBXTYPE_MODULESCRIPT = "ModuleScript";
export const RBXTYPE_LOCALSCRIPT = "LocalScript";
export const RBXTYPE_SCRIPT = "Script";

export const RBXTYPE_MODULESCRIPT_ALIASES = ["ModuleScript", "module"];
export const RBXTYPE_LOCALSCRIPT_ALIASES = ["LocalScript", "local", "client"];
export const RBXTYPE_SCRIPT_ALIASES = ["Script", "server", ""];

export const FSEXT_LUA = ".lua";
export const FSEXT_MOON = ".moon";

export function isScript(type: string): boolean {
	return type === RBXTYPE_MODULESCRIPT || type === RBXTYPE_LOCALSCRIPT || type === RBXTYPE_SCRIPT;
}

export function isAliasOf(str: string, aliases: string[]): boolean {
	for (var i = 0; i < aliases.length; i++) {
		if (aliases[i].toLowerCase() === str.toLowerCase()) {
			return true;
		}
	}
	return false;
}

export function jsArrayToLuaArrayString(jsarray: any[]): string {
	let bin = jsarray.map(x => {
		if (typeof x === "number") {
			return x.toString();
		} else if (typeof x === "string") {
			return '"' + x + '"';
		} else if (typeof x === "boolean") {
			return x ? "true" : "false";
		} else if (x === null || x === undefined) {
			return "nil";
		} else if (Array.isArray(x)) {
			return jsArrayToLuaArrayString(x);
		} else {
			return "";
		}
	});
	return "{" + bin.join(", ") + "}";
}

export function matchAssetRbxType(str: string): string {
	if (isAliasOf(str, RBXTYPE_LOCALSCRIPT_ALIASES)) {
		return RBXTYPE_LOCALSCRIPT;
	} else if (isAliasOf(str, RBXTYPE_SCRIPT_ALIASES)) {
		return RBXTYPE_SCRIPT;
	} else if (isAliasOf(str, RBXTYPE_MODULESCRIPT_ALIASES)) {
		return RBXTYPE_MODULESCRIPT;
	} else {
		console.warn("Unknown file subext: " + str);
		return RBXTYPE_MODULESCRIPT;
	}
}

function getTemplate(templatePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, templatePath)).toString();
}

export const SRC_UTILITY_FUNC_LUA = getTemplate("./../templates/UtilityFuncLua.template.lua");
export const SRC_SET_SOURCE_CALL_LUA = getTemplate("./../templates/SetSourceCall.template.lua");
export const SRC_REMOVE_FILE_CALL_LUA = getTemplate("./../templates/RemoveFileCall.template.lua");
export const SRC_PRINT_LUA = getTemplate("./../templates/Print.template.lua");
export const SRC_SYNC_TO_FS_LUA = getTemplate("./../templates/SyncToFs.template.lua");
export const SRC_GUARD_LUA = getTemplate("./../templates/Guard.template.lua");
