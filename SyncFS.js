var fs = require("fs");
var path = require("path");
var Util = require("./Util");

function path_get_stat(path) {
	try {
	 return fs.statSync(path);
	} catch (e) {
		return null;
	}
}

function mkdir(path) {
	console.log("Create[DIR ]:",path);

	if (path_get_stat(path) == null) {
		fs.mkdirSync(path);
	}
}

function mkscript(path,type,contents) {
	path = path + "." + type + Util.FSEXT_LUA;
	console.log("Create[FILE]:",path);

	if (path_get_stat() != null) {
		fs.unlinkSync(path);
	}
	fs.writeFileSync(path,contents);
}

function obj_rTraversal(obj_path,obj) {
	for (var i = 0; i < obj.Children.length; i++) {
		var itr_child = obj.Children[i];
		var itr_child_path = path.resolve(obj_path,itr_child.Name);
		if (Util.IsScript(itr_child.Type)) {
			mkscript(itr_child_path,itr_child.Type,itr_child.Source);

			itr_child_path = itr_child_path + "." + itr_child.Type;
			if (itr_child.Children.length > 0) {
				mkdir(itr_child_path);
			}
		} else {
			mkdir(itr_child_path);
		}
		obj_rTraversal(itr_child_path, itr_child);
	}
}

module.exports = {
	SyncSourceDirFromObj: function(source_dir, root_obj) {
		obj_rTraversal(source_dir, root_obj);
	}
};