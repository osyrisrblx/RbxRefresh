local LogService = game:GetService("LogService")
local HttpService = game:GetService("HttpService")

local PORT = 8888

local enabled = false
local tag

plugin:CreateToolbar("RbxRefresh"):CreateButton("RbxRefresh", "", "").Click:connect(function()
	local myTag = {}
	tag = myTag
	enabled = not enabled
	if enabled then
		print("[RbxRefresh] Running on localhost port " .. PORT)

		while tag == myTag do
			if not enabled then break end
			print("[RbxRefresh] Requesting...")
			local source
			local success, message = pcall(function()
				source = HttpService:GetAsync(string.format("http://localhost:%s", PORT))
			end)
			if not success then
				local lowerMessage = string.lower(message)
				if (lowerMessage:find("error") and not lowerMessage:find("timeout")) then
					print("[RbxRefresh] Ending because:", message)
					wait(1)
				elseif (lowerMessage:find("enabled")) then
					print(message)
					wait(1)
				end
			else
				local suc,err = pcall(function()
					loadstring(source)()
				end)
				if not suc then
					warn("[RbxRefresh] ERR:" .. err)
					warn(source)
				end
			end

			wait(0.1)
		end
	else
		print("[RbxRefresh] Stopped")
	end
end)
