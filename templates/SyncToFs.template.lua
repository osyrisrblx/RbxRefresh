local RBXTYPE_MODULESCRIPT = "ModuleScript"
local RBXTYPE_LOCALSCRIPT = "LocalScript"
local RBXTYPE_SCRIPT = "Script"

function do_ignore(itr)
  return false
end

function is_script(itr_child)
  return itr_child.ClassName == RBXTYPE_SCRIPT or itr_child.ClassName == RBXTYPE_LOCALSCRIPT or itr_child.ClassName == RBXTYPE_MODULESCRIPT
end

function has_script_children(itr)
  if is_script(itr) then return true end
  local children = itr:GetChildren()
  for i=1,#children do
    local itr_child = children[i]
    if is_script(itr_child) then
      return true
    end
    local child_has_script_children = has_script_children(itr_child)
    if child_has_script_children then
      return true
    end
  end
  return false
end

function cons_obj(name,type,hasSource)
  local rtv = { Name = name; Type = type; Children = {}; }
  if hasSource == true then
    rtv.Source = ""
  end
  return rtv
end

function push_dir(obj,dirname,dirtype)
  local rtv = cons_obj(dirname,dirtype,false)
  table.insert(obj.Children, rtv)
  return rtv
end

function push_script(obj,dirname,dirtype,source)
  local rtv = cons_obj(dirname,dirtype,true)
  rtv.Source = source
  table.insert(obj.Children, rtv)
  return rtv
end

function sync_rtraversal(instance, obj, use_children)
  local instance_children
  if use_children ~= nil then
    instance_children = use_children
  else
    instance_children = instance:GetChildren()
  end
  for i=1,#instance_children do
    local itr = instance_children[i]
    if do_ignore(itr) ~= true and has_script_children(itr) == true then
      local itr_obj = nil
      if is_script(itr) then
        itr_obj = push_script(obj, itr.Name, itr.ClassName, itr.Source)
      else
        itr_obj = push_dir(obj, itr.Name, itr.ClassName)
      end
      sync_rtraversal(itr,itr_obj)
    end
  end
end

local obj_game = cons_obj("game","DataModel",false)
sync_rtraversal(game, obj_game, {
  game:FindFirstChild("ReplicatedFirst"),
  game:FindFirstChild("ReplicatedStorage"),
  game:FindFirstChild("ServerScriptService"),
  game:FindFirstChild("ServerStorage"),
  game:FindFirstChild("StarterGui"),
  game:FindFirstChild("StarterPlayer"),
  game:FindFirstChild("Chat")
})

local json_str = game:GetService("HttpService"):JSONEncode(obj_game)
print(json_str)
