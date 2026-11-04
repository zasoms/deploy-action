const Client = require("ssh2").Client;

/**
 * 私钥规范化：去掉首尾空白、补末尾换行（ssh2 对换行敏感）
 */
const normalizeKey = (key) => {
  const k = String(key || "").replace(/\r\n/g, "\n").trim();
  if (!k) return "";
  return k.endsWith("\n") ? k : k + "\n";
};

/**
 * 服务器部署方案（SSH Key 优先，兼容密码）
 */
const Server = function (options) {
  this.connecting = false;
  this.options = options || {
    host: "",
    port: "",
    username: "",
    privateKey: "",
    password: "",
  };
  this.client = new Client();
};

Server.prototype.connect = function () {
  return new Promise((resolve, reject) => {
    if (this.connecting) return resolve();
    const options = this.options;

    const privateKey = normalizeKey(options.privateKey);
    const auth = privateKey
      ? { privateKey }
      : { password: options.password };

    if (!auth.privateKey && !auth.password) {
      return reject("缺少认证凭据：需要 key(私钥) 或 password");
    }

    this.client
      .on("ready", () => {
        this.connecting = true;
        resolve();
      })
      .on("error", (err) => {
        reject(err);
      })
      .connect({
        host: options.host,
        port: options.port,
        username: options.username,
        readyTimeout: 30000,
        ...auth,
      });
  });
};

Server.prototype.sftp = function (source, target) {
  return new Promise((resolve, reject) => {
    if (!this.connecting) {
      return reject("请先链接服务器");
    }

    this.client.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(source, target, {}, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
};

/**
 * 执行单条远程命令（受限 command= 场景必须用 exec，不能开交互 shell）
 * resolved: { code, stdout, stderr }
 */
Server.prototype.exec = function (cmd) {
  return new Promise((resolve, reject) => {
    if (!this.connecting) {
      return reject("请先链接服务器");
    }

    this.client.exec(cmd, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";
      let code = null;

      stream
        .on("data", (data) => {
          stdout += data.toString();
          process.stdout.write(data);
        })
        .on("close", (exitCode) => {
          code = exitCode;
          if (code === 0) {
            resolve({ code, stdout, stderr });
          } else {
            reject(
              `远程命令执行失败(code=${code}) ${
                stderr.trim() || stdout.trim()
              }`
            );
          }
        });

      stream.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    });
  });
};

Server.prototype.close = function () {
  this.connecting = false;
  this.client.end();
};

module.exports = Server;
