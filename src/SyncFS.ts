import * as fs from "fs";
import * as path from "path";

import {
	FSEXT_LUA,
	isScript,
} from "./Utility";

function pathGetStat(path: string): fs.Stats | null {
	try {
		return fs.statSync(path);
	} catch (e) {
		return null;
	}
}

function mkdir(path: string): void {
	console.log("Create[DIR]:", path);
	if (pathGetStat(path) == null) {
		fs.mkdirSync(path);
	}
}

function objRbxTraversal(objPath: string, obj: RbxObject): void {
	for (var i = 0; i < obj.children.length; i++) {
		var child = obj.children[i];
		var childPath = path.resolve(objPath, child.name);
		if (isScript(child.type)) {
			childPath = childPath + "." + child.type + FSEXT_LUA;
			console.log("Create[FILE]:", childPath);

			if (pathGetStat(childPath) != null) {
				fs.unlinkSync(childPath);
			}
			fs.writeFileSync(childPath, child.source);
			childPath = childPath + "." + child.type;
			if (child.children.length > 0) {
				mkdir(childPath);
			}
		} else {
			mkdir(childPath);
		}
		objRbxTraversal(childPath, child);
	}
}

export function syncSourceDirFromObj(sourceDir: string, rootObj: RbxObject): void {
	objRbxTraversal(sourceDir, rootObj);
}