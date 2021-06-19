const core = require("@actions/core");
// const github = require('@actions/github')

const Message = require("./helpers/message");

const web = require("./web");
const miniprogram = require("./miniprogram");

try {
  // 应用类型暂时只支持message、web、miniprogram
  const type = core.getInput("type");
  const robotKey = core.getInput("robotkey");
  const content = core.getInput("content");
  const input = core.getInput("input");

  const message = new Message(robotKey);

  const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE;

  switch (type) {
    // web应用
    case "web":
      var host = core.getInput("host");
      var port = core.getInput("port");
      var username = core.getInput("username");
      var password = core.getInput("password");
      var output = core.getInput("output");

      web({
        host: host,
        port: port,
        username: username,
        password: password,
        input: input,
        output: output,
        workspace: GITHUB_WORKSPACE,
      })
        .then((text) => {
          message.sendText(content + '-' + text);
        })
        .catch((text) => {
          message.sendText(content + '-' + text);
        });
      break;
    // 小程序
    case "miniprogram":
      var appid = core.getInput("appid");
      var version = core.getInput("version") || "1.0.0";
      var dsec = core.getInput("dsec") || "问题修复";
      var privatekey = core.getInput("privatekey");
      var action = core.getInput("action") || "preview";

      miniprogram(action, {
        appid: appid,
        version: version,
        dsec: dsec,
        input: input,
        privatekey: privatekey,
        workspace: GITHUB_WORKSPACE,
      })
        .then((res) => {
          if (res.qrcodePath) {
            message.sendImage(res.qrcodePath);
          }
          message.sendText(content + res.message);
        })
        .catch((text) => {
          message.sendText(content + "提交失败:" + text);
        });
      break;
    // 发送消息
    case "message":
      if (!content) {
        return console.log("参数配置缺失，需要content");
      }
      message.sendText(content);
      break;
    default:
      console.log("没有该类型");
  }
} catch (error) {
  core.setFailed(error.message);
}
