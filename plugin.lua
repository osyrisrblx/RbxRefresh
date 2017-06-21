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
		print("Running on localhost port " .. PORT)
		local isFirstReq = true
		while tag == myTag do
			if not enabled then break end
			print("Requesting...")
			local source
			local success, message = pcall(function()
				source = HttpService:GetAsync(string.format("http://localhost:%s?fullUpdate=%s", PORT, isFirstReq and "true" or "false"))
			end)
			if not success then
				local lowerMessage = string.lower(message)
				if (lowerMessage:find("error") and not lowerMessage:find("timeout")) then
					print("RbxRefresh ending because:", message)
					wait(1)
				elseif (lowerMessage:find("enabled")) then
					print(message)
					wait(1)
				end
			else
				loadstring(source)()
			end
			isFirstReq = false
			wait(0.1)
		end
	else
		print("RbxRefresh stopped")
	end
end)
