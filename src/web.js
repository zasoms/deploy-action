const path = require("path")
const fs = require("fs")
const Server = require("./helpers/server")

module.exports = function (config) {
  return new Promise((resolve, reject) => {
    const fields = ["host", "port", "username", "password", "output"]
    // 简单的校验一下规则
    const hasAcess = fields.every((item) => config[item])
    if (!hasAcess) {
      return reject("参数配置错误，需要" + fields.join(","))
    }
    const targetPath = `${config.output}${config.output.endsWith("/") ? "" : "/"}`
    const zipFileName = config.input ? config.input : "dist.zip"
    
    if (targetPath.includes("..") || targetPath === "/") {
      return reject("目标路径不能包含..或/")
    }
    // 处理清理文件的逻辑
    let cleanCommand = ""
    if (config.clean) {
      if (Array.isArray(config.cleanPaths) && config.cleanPaths.length > 0) {
        // 对每个路径进行安全检查和处理
        const safePaths = config.cleanPaths
          .map(p => p.trim())
          .filter(p => p && !p.includes("..") && !p.startsWith("/"))
          .map(p => `rm -rf ${p}`)
        cleanCommand = safePaths.join(" && ")
      } else {
        console.warn("警告: 未指定清理路径，跳过清理步骤")
      }
    }

    const script =
      config.script ||
      `cd ${targetPath}
      ${cleanCommand}
      ${zipFileName.includes("tar.gz") ? `tar -zxvf ${zipFileName} --overwrite` : `unzip -o ${zipFileName}`}
    `
    const zipFile = path.resolve(config.workspace, "./" + zipFileName)

    const server = new Server({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
    })

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
          return Promise.reject("文件/文件夹上传失败:" + err)
        })
      })
      .then(() => {
        return server
          .shell(script)
          .then(() => {
            resolve("部署成功")
          })
          .catch((e) => {
            console.log(e)
            return Promise.reject("部署失败")
          })
      })
      .then(() => server.close())
      .catch((err) => {
        console.log(err)
        server.close()
        reject(err)
      })
  })
}
