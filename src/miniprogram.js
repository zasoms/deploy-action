const fs = require("fs");
const path = require("path");

const MiniProgram = require("./helpers/miniprogram");

module.exports = function (action, config) {
  return new Promise((resolve, reject) => {
    const fields = ["appid", "input", "privatekey"];
    // 简单的校验一下规则
    const hasAcess = fields.every((item) => config[item]);
    if (!hasAcess) {
      return reject("参数配置错误，需要" + fields.join(","));
    }

    const projectPath = path.resolve(config.workspace, "./" + config.input);
    const privateKeyPath = path.resolve(config.workspace, "./private.key");
    const qrcodeOutputPath = path.resolve(config.workspace, "./qrcode.png");

    fs.writeFileSync(privateKeyPath, config.privatekey, "utf-8");

    const weapp = new MiniProgram({
      appid: config.appid,
      version: config.version,
      dsec: config.dsec,
      projectPath: projectPath,
      privateKeyPath: privateKeyPath,
    });

    if (action === "preview") {
      weapp.preview({}, qrcodeOutputPath).then(() => {
        resolve({
          message: '提交成功',
          qrcodePath: qrcodeOutputPath,
        }).catch((error) => {
          reject(error.toString());
        });
      });
    } else {
      weapp
        .upload()
        .then(() => {
          resolve({
            message: '提交成功'
          });
        })
        .catch((error) => {
          reject(error.toString());
        });
    }
  });
};
