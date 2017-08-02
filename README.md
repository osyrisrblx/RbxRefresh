# RbxRefresh
With RbxRefresh, you can use external editors (Like Sublime Text 3 or Atom) for ROBLOX development.
RbxRefresh syncs your changes back into studio every time you save your files locally.

## Prerequisites
1. [NodeJS](https://nodejs.org/)

## Usage
1. `npm install rbxrefresh -g`
2. `rbxrefresh SOURCE_DIRECTORY`
3. Enable `game.HttpService.HttpEnabled`
4. [Install and enable RbxRefresh Studio Plugin](https://www.roblox.com/library/852039069/RbxRefresh)
5. Make changes and save.

Your source folder should mirror the roblox explorer structure where 'src' represents game. i.e.
```
ProjectFolder
	src
		ReplicatedStorage
			Classes
				Module.ModuleScript.lua
		ServerScriptService
			Server.Script.lua
		StarterPlayer
			StarterPlayerScripts
				Client.LocalScript.lua
```

## Visual Studio Code
You can integrate RbxRefresh into your project by creating a `.vscode` folder inside your project directory.
Inside of your `.vscode` folder create a file called `tasks.json`
Here's the source I use for using RbxRefresh as task
```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "taskName": "RbxRefresh",
            "command": "rbxrefresh",
            "args": ["${workspaceRoot}"],
            "type": "shell",
            "problemMatcher": [],
            "group": {
                "kind": "build",
                "isDefault": true
            }
        }
    ]
}
```

After adding that, just hit ctrl+shift+B on Windows or cmd+shift+B on OSX to run RbxRefresh.
Click inside the terminal pane and do Ctrl+C to cancel.

## Sublime Text 3
An easy way to use Sublime Text 3 with RbxRefresh is by creating a build system.

You can do this using the following steps:
1. Tools > Build System > New Build System...
2. Paste the following into the new file
```json
{
	"cmd": ["rbxrefresh", "$folder"],
	"shell": true
}
```
3. Save it as `RbxRefresh.sublime-build`
4. Tools > Build System > RbxRefresh

After creating the build system you can use `Ctrl+B` on Windows or `Cmd+B` on MacOS to start RbxRefresh instantly.
RbxRefresh will be run on your top most project folder in the side bar.
To add a project folder to Sublime, just drag it onto the window.