
module.exports = {
  RBXTYPE_MODULESCRIPT: "ModuleScript",
  RBXTYPE_LOCALSCRIPT: "LocalScript",
  RBXTYPE_SCRIPT: "Script",
  FSEXT_LUA: ".lua",

  IsScript: function(type) {
    return type == this.RBXTYPE_MODULESCRIPT ||
      type == this.RBXTYPE_LOCALSCRIPT ||
      type == this.RBXTYPE_SCRIPT;
  }
};
