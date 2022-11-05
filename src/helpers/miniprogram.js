const ci = require("miniprogram-ci");

const defaultSettings = {
  urlCheck: true,
  es6: true,
  enhance: false,
  postcss: true,
  minified: true,
  newFeature: true,
  coverView: true,
  nodeModules: false,
  autoAudits: false,
  showShadowRootInWxmlPanel: true,
  scopeDataCheck: false,
  uglifyFileName: false,
  checkInvalidKey: true,
  checkSiteMap: true,
  uploadWithSourceMap: true,
  compileHotReLoad: false,
  useMultiFrameRuntime: true,
  useApiHook: true,
  useApiHostProcess: true,
  bundle: false,
  useIsolateContext: true,
  packNpmManually: false,
  packNpmRelationList: [],
  minifyWXSS: true,
  autoPrefixWXSS: true,
  ignoreUploadUnusedFiles: true
}
/**
 * 小程序ci
 * @param {*} options
 */
function MiniProgram(options) {
  this.options = options;

  this.project = new ci.Project({
    appid: options.appid,
    type: "miniProgram",
    projectPath: options.projectPath,
    privateKeyPath: options.privateKeyPath,
    ignores: ["node_modules/**/*"],
  });
}
MiniProgram.prototype.preview = function (setting, qrcodeOutputDest) {
  setting = setting || {};
  qrcodeOutputDest = qrcodeOutputDest || "./";
  return ci.preview({
    project: this.project,
    desc: this.options.desc, // 此备注将显示在“小程序助手”开发版列表中
    setting: Object.assign(
      {},
      defaultSettings,
      setting
    ),
    qrcodeFormat: "image",
    qrcodeOutputDest: qrcodeOutputDest,
  });
};
MiniProgram.prototype.upload = function (setting) {
  setting = setting || {};
  return ci.upload({
    project: this.project,
    version: this.options.version,
    desc: this.options.desc,
    setting: Object.assign(
      {},
      defaultSettings,
      setting
    ),
    // onProgressUpdate: console.log,
  });
};

module.exports = MiniProgram;
