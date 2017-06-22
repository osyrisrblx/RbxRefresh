# RbxRefresh
Mirrors a local file structure to ROBLOX Studio. 

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
