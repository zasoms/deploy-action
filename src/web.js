const path = require("path")
const Server = require("./helpers/server")

/**
 * 目标路径安全校验
 */
const assertTargetDir = (output) => {
  if (!output) throw new Error("缺少 output(目标目录)")
  if (!output.startsWith("/")) throw new Error("output 必须是绝对路径")
  if (output.includes("..")) throw new Error("output 不能包含 ..")
  const dir = output.replace(/\/+$/, "")
  if (!dir || dir === "/") throw new Error("output 不能是根目录")
  return dir
}

/**
 * 包名安全校验（统一 tar.gz）
 */
const assertPackage = (input) => {
  if (!input) throw new Error("缺少 input(包名，如 dist.tar.gz)")
  const file = path.basename(input.trim())
  if (file !== input.trim()) throw new Error("input 只能是包名，不能带路径")
  if (!/^[A-Za-z0-9._-]{1,120}\.(tar\.gz|tgz)$/.test(file)) {
    throw new Error("input 必须是 .tar.gz/.tgz 包名，例如 dist.tar.gz")
  }
  return file
}

/**
 * 清理项安全校验
 */
const assertCleanPaths = (cleanPaths) => {
  const list = (cleanPaths || [])
    .map((p) => String(p).trim())
    .filter(Boolean)
  const bad = list.find(
    (p) => p.includes("..") || p.startsWith("/") || !/^[A-Za-z0-9._-]{1,64}$/.test(p)
  )
  if (bad) throw new Error(`cleanPaths 含非法路径: ${bad}`)
  if (list.length > 20) throw new Error("cleanPaths 最多 20 项")
  return list
}

/**
 * 远程包名唯一化：避免并发部署互相覆盖同名包
 * 例：dist.tar.gz -> dist-1723456789-1.tar.gz
 */
const uniquePackage = (file) => {
  const storedExt = /\.tar\.gz$/.test(file) ? ".tar.gz" : ".tgz"
  const base =
    file.slice(0, file.length - storedExt.length).replace(/[^A-Za-z0-9._-]/g, "") ||
    "dist"
  const suffix = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || "1"}`
    : String(Date.now())
  const head = base.length > 90 ? base.slice(0, 90) : base
  return `${head}-${suffix}${storedExt}`
}

module.exports = function (config) {
  return new Promise((resolve, reject) => {
    const fields = ["host", "port", "username", "output", "input"]
    const missing = fields.filter((item) => !config[item])
    if (missing.length) {
      return reject("参数配置错误，缺少:" + missing.join(","))
    }
    if (!config.key && !config.password) {
      return reject("参数配置错误，需要 key(私钥) 或 password")
    }

    let targetDir, packageFile, cleanList
    try {
      targetDir = assertTargetDir(config.output)
      packageFile = assertPackage(config.input)
      cleanList = assertCleanPaths(config.cleanPaths)
    } catch (e) {
      return reject(e.message)
    }

    if (config.clean && !cleanList.length) {
      console.warn("警告: clean=true 但未指定 cleanPaths，跳过清理步骤")
    }

    const remoteFile = config.script ? packageFile : uniquePackage(packageFile)
    const cleanArg = cleanList.join(",")
    const uploadMode = (config.uploadMode || "sftp").toLowerCase()

    // 包在 runner 上的本地路径（input 就是包名）
    const localFile = path.resolve(config.workspace, "./" + packageFile)

    const server = new Server({
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey: config.key,
      password: config.password,
      knownHosts: config.knownHosts,
    })

    const deployCmd = config.script
      ? config.script
      : ["deploy", targetDir, remoteFile, cleanArg]
          .filter((item, index) => item || index < 3)
          .join(" ")

    server
      .connect()
      .then(() => {
        if (uploadMode === "stdin") {
          // 服务端禁 sftp：把包从 stdin 灌给 upload 指令，写入其私有暂存目录
          const uploadCmd = ["upload", targetDir, remoteFile]
            .map((item) => item)
            .join(" ")
          console.log("upload cmd: " + uploadCmd)
          return server
            .execWithFile(uploadCmd, localFile)
            .catch((err) => Promise.reject("文件上传失败:" + err))
        }
        return server
          .sftp(localFile, `${targetDir}/${remoteFile}`)
          .catch((err) => {
            return Promise.reject("文件上传失败:" + err)
          })
      })
      .then(() => {
        console.log("deploy cmd: " + deployCmd)
        return server.exec(deployCmd)
      })
      .then((res) => {
        server.close()
        resolve("部署成功" + (res && res.stdout ? ": " + res.stdout.trim() : ""))
      })
      .catch((err) => {
        console.log(err)
        server.close()
        reject(typeof err === "string" ? err : err.message || String(err))
      })
  })
}
