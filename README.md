# RbxRefresh
Mirrors a local file structure to ROBLOX Studio. 

## Usage
1. `npm install rbxrefresh -g`
2. `rbxrefresh SOURCE_DIRECTORY`
3. Enable Studio Plugin
4. Make changes and save.

Your source folder should mirror the roblox explorer structure.
i.e.

```
ProjectFolder
	src
		ReplicatedStorage
			Classes
				Module.lua
		ServerScriptService
			Server.lua
		StarterPlayer
			StarterPlayerScripts
				Client.lua
```
