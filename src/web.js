const path = require("path");
const fs = require("fs");
const util = require("./util");
const Server = require("./helpers/server");

module.exports = function (config) {
  return new Promise((resolve, reject) => {
    const fields = ["host", "port", "username", "password", "input", "output"];
    // 简单的校验一下规则
    const hasAcess = fields.every((item) => config[item]);
    if (!hasAcess) {
      return reject("参数配置错误，需要" + fields.join(","));
    }
    const targetPath = `${config.output}${
      config.output.slice(-1) === "/" ? "" : "/"
    }`;
    const sourcePath = path.resolve(config.workspace, "./" + config.input);
    const zipFileName = Date.now() + ".zip";
    const zipFile = sourcePath + "/" + zipFileName;


    util.zip(sourcePath, zipFile);

    const server = new Server({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    });

    
    /*  
    mv ${zipFileName} /tmp
    rm -rf *
    mv /tmp/${zipFileName} .
    unzip -o ${zipFileName}
    */
    
    server
      .connect()
      .then(() => {
        return server.sftp(zipFile, targetPath + zipFileName).catch((err) => {
          return Promise.reject("文件/文件夹上传失败:" + err);
        });
      })
      .then(() => {
        return server
          .shell(
            `
          cd ${targetPath}
          rm -rf index.html js/ css/ static/ miniweb/
          unzip -o ${zipFileName}
          rm -rf ${ zipFileName }
        `
          )
          .then(() => {
            resolve("部署成功");
          })
          .catch(() => {
            return Promise.reject("部署失败");
          })
      })
      .then(() => server.close())
      .catch((err) => {
        console.log((err))
        server.close();
        reject(err)
      });
  });
};
