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
	for (var i = 0; i < obj.Children.length; i++) {
		var child = obj.Children[i];
		var childPath = path.resolve(objPath, child.Name);
		if (isScript(child.Type)) {
			childPath = childPath + "." + child.Type + FSEXT_LUA;
			console.log("Create[FILE]:", childPath);

			if (pathGetStat(childPath) != null) {
				fs.unlinkSync(childPath);
			}
			fs.writeFileSync(childPath, child.Source);
			childPath = childPath + "." + child.Type;
			if (child.Children.length > 0) {
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