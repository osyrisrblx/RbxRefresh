# RbxRefresh
With RbxRefresh, you can use external editors (Like Sublime Text 3 or Atom) for ROBLOX development.
RbxRefresh syncs your changes back into studio every time you save your files locally.

## Prerequisites
1. NodeJS
2. NPM (Node Package Manager)
3. ROBLOX Studio
4. [RbxRefresh Studio Plugin](https://www.roblox.com/library/852039069/RbxRefresh)

## Usage
1. `npm install rbxrefresh -g`
2. `rbxrefresh SOURCE_DIRECTORY`
3. [Enable Studio Plugin](https://www.roblox.com/library/852039069/RbxRefresh)
4. Make changes and save.

Your source folder should mirror the roblox explorer structure. i.e.
```
ProjectFolder
	ReplicatedStorage
		Classes
			Module.ModuleScript.lua
	ServerScriptService
		Server.Script.lua
	StarterPlayer
		StarterPlayerScripts
			Client.LocalScript.lua
```

## Sublime Text 3
An easy way to use Sublime Text 3 with RbxRefresh is by creating a build system.

You can do this using the following steps:
1. Tools > Build System > New Build System...
2. Paste the following into the new file
```{
	"shell_cmd": "rbxrefresh $folder/src"
}```
3. Save it as `RbxRefresh.sublime-build`
4. Tools > Build System > RbxRefresh

After creating the build system you can use `Ctrl+B` on Windows or `Cmd+B` on MacOS to start RbxRefresh instantly.
RbxRefresh will be run on your top most project folder in the side bar.
To add a project folder to Sublime, just drag it onto the window.
