function setSource(assetRbxName, assetRbxType, rbxPathArray, fileContents)
  local currentDir = game
  for i=1,#rbxPathArray do
    local itrName = rbxPathArray[i]
    if currentDir:FindFirstChild(itrName) == nil then
      local newFolder = Instance.new("Folder",currentDir)
      newFolder.Name = itrName
    end
    currentDir = currentDir:FindFirstChild(itrName)
  end

  local targetFile = currentDir:FindFirstChild(assetRbxName)
  if targetFile ~= nil and typeof(targetFile) ~= assetRbxType then
    targetFile:Destroy()
    targetFile = nil
  end
  if targetFile == nil then
    targetFile = Instance.new(assetRbxType,currentDir)
    targetFile.Name = assetRbxName
  end
  targetFile.Source = fileContents
end
