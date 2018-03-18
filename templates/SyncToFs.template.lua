local RBXTYPE_MODULESCRIPT = "ModuleScript"
local RBXTYPE_LOCALSCRIPT = "LocalScript"
local RBXTYPE_SCRIPT = "Script"

local function isScript(itrChild)
	return itrChild.ClassName == RBXTYPE_SCRIPT or itrChild.ClassName == RBXTYPE_LOCALSCRIPT or itrChild.ClassName == RBXTYPE_MODULESCRIPT
end

local function hasScriptChildren(itr)
	if isScript(itr) then return true end
	local children = itr:GetChildren()
	for i = 1, #children do
		local itrChild = children[i]
		if isScript(itrChild) then
			return true
		end
		local childHasScriptChildren = hasScriptChildren(itrChild)
		if childHasScriptChildren then
			return true
		end
	end
	return false
end

local function consObj(name, type, hasSource)
	local rtv = { name = name, type = type, children = {} }
	if hasSource == true then
		rtv.source = ""
	end
	return rtv
end

local function pushDir(obj, dirName, dirType)
	local rtv = consObj(dirName, dirType, false)
	table.insert(obj.children, rtv)
	return rtv
end

local function pushScript(obj, dirName, dirType, source)
	local rtv = consObj(dirName, dirType, true)
	rtv.source = source
	table.insert(obj.children, rtv)
	return rtv
end

local function syncRTraversal(instance, obj, useChildren)
	local instanceChildren
	if useChildren ~= nil then
		instanceChildren = useChildren
	else
		instanceChildren = instance:GetChildren()
	end
	for i = 1, #instanceChildren do
		local itr = instanceChildren[i]
		if hasScriptChildren(itr) == true then
			local itrObj
			if isScript(itr) then
				itrObj = pushScript(obj, itr.Name, itr.ClassName, itr.Source)
			else
				itrObj = pushDir(obj, itr.Name, itr.ClassName)
			end
			syncRTraversal(itr, itrObj)
		end
	end
end

local objGame = consObj("game", "DataModel", false)
syncRTraversal(game, objGame, {
	game:FindFirstChild("Workspace"),
	game:FindFirstChild("ReplicatedFirst"),
	game:FindFirstChild("ReplicatedStorage"),
	game:FindFirstChild("ServerScriptService"),
	game:FindFirstChild("ServerStorage"),
	game:FindFirstChild("StarterGui"),
	game:FindFirstChild("StarterPlayer"),
	game:FindFirstChild("Chat")
})

local jsonStr = game:GetService("HttpService"):JSONEncode(objGame)
local jsonStrLen = #jsonStr
local requestSize = 1000000
local i = 1
while i < jsonStrLen do
	local iEnd = i + requestSize
	if iEnd > jsonStrLen then
		iEnd = jsonStrLen
	end
	game:GetService("HttpService"):PostAsync("http://localhost:8888", string.sub(jsonStr, i, iEnd))
	i = iEnd + 1
end
game:GetService("HttpService"):PostAsync("http://localhost:8888", "$$END$$")
