function str_split(str, delim)
  local rtv = {}
  local last = 0
  for i=1,#str do
    local i_char = string.sub(str,i,i)
    if i_char == "." then
      table.insert(rtv,string.sub(str,last,i-1))
      last = i + 1
    end
  end
  table.insert(rtv,string.sub(str,last,#str))
  return rtv
end

function rbxPathElementHasTypeInfo(rbxPathElement)
  local split = str_split(rbxPathElement,".")
  if #split >= 2 then
    return true, split[1], split[2]
  else
    return false,rbxPathElement,"Folder"
  end
end

function traverseRbxPathArray(rbxPathArray)
  local currentDir = game

  for i=1,#rbxPathArray do
    local hasTypeInfo, itrName, itrType = rbxPathElementHasTypeInfo(rbxPathArray[i])
    local itrTarget = currentDir:FindFirstChild(itrName)
    if hasTypeInfo == true and itrTarget ~= nil and itrTarget.ClassName ~= itrType then
      print("[RbxRefresh] traverseRbxPathArray Removing Existing(".. itrTarget:GetFullName() ..")",itrTarget.ClassName,itrType)
      itrTarget:Destroy()
      itrTarget = nil
    end
    itrTarget = currentDir:FindFirstChild(itrName)
    if itrTarget == nil then
      local newFolder = Instance.new(itrType,currentDir)
      newFolder.Name = itrName
      print("[RbxRefresh] Creating ".. itrType .. "(".. newFolder:GetFullName() ..")")
    end

    currentDir = currentDir:FindFirstChild(itrName)
  end
  return currentDir
end

function setSource(assetRbxName, assetRbxType, rbxPathArray, fileContents)
  local currentDir = traverseRbxPathArray(rbxPathArray)
  local targetFile = currentDir:FindFirstChild(assetRbxName)
  if targetFile ~= nil and targetFile.ClassName ~= assetRbxType then
    print("[RbxRefresh] Removing Existing(".. targetFile:GetFullName() ..")",targetFile.ClassName,assetRbxType)
    targetFile:Destroy()
    targetFile = nil
  end
  if targetFile == nil then
    targetFile = Instance.new(assetRbxType,currentDir)
    targetFile.Name = assetRbxName
    print("[RbxRefresh] Creating(".. targetFile:GetFullName() ..")")
  end
  targetFile.Source = fileContents
end

function removeFile(assetRbxName, assetRbxType, rbxPathArray)
  local currentDir = traverseRbxPathArray(rbxPathArray)
  for _,child in pairs(currentDir:GetChildren()) do
    if child.Name == assetRbxName and child.ClassName == assetRbxType then
      print("[RbxRefresh] Removing("..child:GetFullName()..")",child.ClassName)
      child:Destroy()
    end
  end
end
