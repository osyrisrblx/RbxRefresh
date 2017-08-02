local validPlaceIds = %s
local isValidPlaceId = false
for _, placeId in pairs(validPlaceIds) do
    if game.PlaceId == placeId then
        isValidPlaceId = true
    end
end
if not isValidPlaceId then
    warn("[RbxRefresh] Bad game.PlaceId!")
    return
end