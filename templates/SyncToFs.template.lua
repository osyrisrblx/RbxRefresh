local RBXTYPE_MODULESCRIPT = "ModuleScript"
local RBXTYPE_LOCALSCRIPT = "LocalScript"
local RBXTYPE_SCRIPT = "Script"

local function doIgnore()
	return false
end

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
	local rtv = { Name = name; Type = type; Children = {}; }
	if hasSource == true then
		rtv.Source = ""
	end
	return rtv
end

local function pushDir(obj, dirname, dirtype)
	local rtv = consObj(dirname, dirtype, false)
	table.insert(obj.Children, rtv)
	return rtv
end

local function pushScript(obj, dirname, dirtype, source)
	local rtv = consObj(dirname, dirtype, true)
	rtv.Source = source
	table.insert(obj.Children, rtv)
	return rtv
end

local function syncRTraversal(instance, obj, use_children)
	local instance_children
	if use_children ~= nil then
		instance_children = use_children
	else
		instance_children = instance:GetChildren()
	end
	for i=1, #instance_children do
		local itr = instance_children[i]
		if doIgnore(itr) ~= true and hasScriptChildren(itr) == true then
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

local obj_game = consObj("game", "DataModel", false)
syncRTraversal(game, obj_game, {
	game:FindFirstChild("Workspace"),
	game:FindFirstChild("ReplicatedFirst"),
	game:FindFirstChild("ReplicatedStorage"),
	game:FindFirstChild("ServerScriptService"),
	game:FindFirstChild("ServerStorage"),
	game:FindFirstChild("StarterGui"),
	game:FindFirstChild("StarterPlayer"),
	game:FindFirstChild("Chat")
})

local json_str = game:GetService("HttpService"):JSONEncode(obj_game)
local json_str_len = #json_str
local request_size = 1000000
local i = 1
while i < json_str_len do
	local i_end = i + request_size
	if i_end > json_str_len then
		i_end = json_str_len
	end
	game:GetService("HttpService"):PostAsync("http://localhost:8888", string.sub(json_str, i, i_end))
	i = i_end + 1
end
game:GetService("HttpService"):PostAsync("http://localhost:8888", "$$END$$")
