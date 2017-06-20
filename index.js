var chokidar = require("chokidar");
var fs = require("fs");
var http = require("http");
var url = require("url");

var sourceDir = process.argv[2];

var responseQueue = [];
var utilityFuncLua = "function setSource(...) local args = {...} local source = table.remove(args) local scriptType = table.remove(args) local amtArgs = #args local currentObject = game for i, objectName in ipairs(args) do local newObject = currentObject:FindFirstChild(objectName) if not newObject then newObject = Instance.new(i == amtArgs and scriptType or 'Folder', currentObject) newObject.Name = objectName end if i == amtArgs then newObject.Source = source end currentObject = newObject end end;";

var LUA_EXTENSION = ".lua";

function recursiveFileSearchSync(dir, rbxDir, sourceData, scriptType) {
	if (rbxDir.length > 0) rbxDir += "', '";
	fs.readdirSync(dir).forEach(function(fileName) {
		var newDir = dir + "/" + fileName;
		if (fs.statSync(newDir).isDirectory()) {
			var newScriptType = scriptType;
			if (fileName == "ServerScriptService") {
				newScriptType = "Script";
			} else if (fileName == "StarterPlayer") {
				newScriptType = "LocalScript";
			}
			recursiveFileSearchSync(newDir, rbxDir + fileName, sourceData, newScriptType);
		} else if (fileName.substr(fileName.length - LUA_EXTENSION.length, fileName.length) == LUA_EXTENSION) {
			var code = fs.readFileSync(newDir).toString();
			sourceData.push("setSource('" + rbxDir + fileName.substr(0, fileName.length - LUA_EXTENSION.length) + "', '" + scriptType + "', [===[" + code + "]===]);");
		}
	});
}

function updateAllFiles() {
	var sourceData = [];
	recursiveFileSearchSync(sourceDir, "", sourceData, "ModuleScript");
	return sourceData.join("\n");
}

function updateSingleFile(path) {
	var rbxPath = path;
	var fileExtension = rbxPath.match("(\\.\\w+)$")[1];
	rbxPath = rbxPath.match("src\\\\(.+)")[1];
	rbxPath = rbxPath.substr(0, rbxPath.length - fileExtension.length);
	rbxPath = rbxPath.split("\\").join("', '");
	var code;
	if (fileExtension == LUA_EXTENSION) {
		code = fs.readFileSync(path).toString();
	}
	var scriptType = "ModuleScript";
	if (rbxPath.indexOf("ServerScriptService") != -1) {
		scriptType = "Script";
	} else if (rbxPath.indexOf("StarterPlayer") != -1) {
		scriptType = "LocalScript";
	}
	return "setSource('" + rbxPath + "', '" + scriptType + "', [===[" + code + "]===])";
}

var fullUpdate = false;

function onUpdate(path) {
	console.log(path.match("src\\\\(.+)")[1] + " changed! Compiling..");
	
	var code;
	if (fullUpdate) {
		console.log("Full update requested")
		fullUpdate = false;
		code = updateAllFiles();
	} else {
		code = updateSingleFile(path);
	}

	while (responseQueue.length > 0) {
		console.log("Injected!");
		with (responseQueue.shift()) {
			writeHead(200, {"Content-Type": "text/plain"});
			end(utilityFuncLua + code + "print('Injection Complete')");
		}
	}
}

function onRequest(req, res) {
	var args = url.parse(req.url, true).query;
	if (args.kill == "true") {
		process.exit();
		return;
	}
	if (args.fullUpdate == "true") {
		fullUpdate = true;
	}
	responseQueue.push(res);
}

function setupServer() {
	http.createServer(onRequest).listen(8888, "0.0.0.0");
	chokidar.watch(sourceDir, {
		ignored: /[\/\\]\./,
		persistent: true
	}).on("change", onUpdate);

	console.log("RbxRefresh running on " + sourceDir);
}

http.get("http://localhost:8888?kill=true").on("error", (e) => {});
setTimeout(setupServer, 1000);