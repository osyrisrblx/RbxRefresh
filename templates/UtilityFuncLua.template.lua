function traverseRbxPathArray(rbxPathArray)
  local currentDir = game
  for i=1,#rbxPathArray do
    local itrName = rbxPathArray[i]
    if currentDir:FindFirstChild(itrName) == nil then
      local newFolder = Instance.new("Folder",currentDir)
      newFolder.Name = itrName
      print("Creating Folder(".. newFolder:GetFullName() ..")")
    end
    currentDir = currentDir:FindFirstChild(itrName)
  end
  return currentDir
end

function setSource(assetRbxName, assetRbxType, rbxPathArray, fileContents)
  local currentDir = traverseRbxPathArray(rbxPathArray)
  local targetFile = currentDir:FindFirstChild(assetRbxName)
  if targetFile ~= nil and typeof(targetFile) ~= assetRbxType then
    print("Removing Existing(".. targetFile:GetFullName() ..")")
    targetFile:Destroy()
    targetFile = nil
  end
  if targetFile == nil then
    targetFile = Instance.new(assetRbxType,currentDir)
    targetFile.Name = assetRbxName
    print("Creating(".. targetFile:GetFullName() ..")")
  end
  targetFile.Source = fileContents
end

function removeFile(assetRbxName, assetRbxType, rbxPathArray)
  local currentDir = traverseRbxPathArray(rbxPathArray)
  for _,child in pairs(currentDir:GetChildren()) do
    if child.Name == assetRbxName and child.ClassName == assetRbxType then
      print("Removing("..child:GetFullName()..")")
      child:Destroy()
    end
  end
end
