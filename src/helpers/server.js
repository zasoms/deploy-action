const Client = require("ssh2").Client;

/**
 * 服务器部署方案
 */
const Server = function (options) {
  this.connecting = false;
  this.options = options || {
    host: "",
    port: "",
    username: "",
    password: "",
  };
  this.client = new Client();
};
Server.prototype.connect = function () {
  return new Promise((resolve, reject) => {
    if (this.connecting) return resolve();
    const options = this.options;

    this.client
      .on("ready", () => {
        this.connecting = true;
        resolve();
      })
      .on('error', (err) => {
        reject(err)
      })
      .connect({
        host: options.host,
        port: options.port,
        username: options.username,
        password: options.password,
      });
  });
};
Server.prototype.sftp = function (source, target) {
  return new Promise((resolve, reject) => {
    if (!this.connecting) {
      return reject("请先链接服务器");
    }

    this.client.sftp(function (err, sftp) {
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
Server.prototype.shell = function (cmd) {
  return new Promise((resolve, reject) => {
    if (!this.connecting) {
      return reject("请先链接服务器");
    }

    this.client.shell((err, stream) => {
      stream
        .on("data", (data) => {
          // 输出部署时的信息
          console.log("data: ", data.toString());
        })
        .on("exit", (code, ...args) => {
          if (code === 0) {
            resolve();
          } else {
            console.log(args);
            reject(args);
          }
        });

      stream.end(`
        ${cmd}
        exit
      `);
    });
  });
};
Server.prototype.close = function () {
  this.connecting = false;
  this.client.end();
};

module.exports = Server;
