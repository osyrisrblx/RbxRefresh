-- luacheck: ignore

globals = {
	-- global functions
	"script",
	"warn",
	"wait",
	"spawn",
	"delay",
	"tick",
	"UserSettings",
	"settings",
	"time",
	"typeof",
	"game",
	"unpack",
	"getfenv",
	"setfenv",

	-- types
	"Axes",
	"BrickColor",
	"CFrame",
	"Color3",
	"ColorSequence",
	"ColorSequenceKeypoint",
	"Enum",
	"Faces",
	"Instance",
	"NumberRange",
	"NumberSequence",
	"NumberSequenceKeypoint",
	"PhysicalProperties",
	"Ray",
	"Rect",
	"Region3",
	"Region3int16",
	"TweenInfo",
	"UDim",
	"UDim2",
	"Vector2",
	"Vector3",
	"Vector3int16",

	-- math library
	"math.clamp",
	"math.sign",

	-- plugin
	"plugin",
}

ignore = {
	-- fix methods
	"self",
	"super",
}

exclude_files = {
	"templates/*"
}

-- prevent max line lengths
max_line_length = false
max_code_line_length = false
max_string_line_length = false
max_comment_line_length = false