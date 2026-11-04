const Client = require("ssh2").Client;
const crypto = require("crypto");
const { utils } = require("ssh2");

/**
 * 打印认证信息与私钥指纹，方便和服务器 authorized_keys 对账（不含私钥内容）
 */
const logAuthInfo = (options, privateKey) => {
  const target = `${options.username}@${options.host}:${options.port || 22}`;
  if (!privateKey) {
    console.log(`auth: ${target} method=password`);
    return;
  }
  try {
    const parsed = utils.parseKey(privateKey);
    if (parsed instanceof Error) {
      console.log(`auth: ${target} 私钥解析失败: ${parsed.message}`);
      return;
    }
    const blob = parsed.getPublicSSH();
    const fp = crypto
      .createHash("sha256")
      .update(blob)
      .digest("base64")
      .replace(/=+$/, "");
    console.log(
      `auth: ${target} method=publickey keyType=${parsed.type} fingerprint=SHA256:${fp}`
    );
  } catch (e) {
    console.log(`auth: ${target} 私钥指纹计算失败: ${e.message}`);
  }
};

/**
 * 私钥规范化：去掉首尾空白、补末尾换行（ssh2 对换行敏感）
 */
const normalizeKey = (key) => {
  const k = String(key || "").replace(/\r\n/g, "\n").trim();
  if (!k) return "";
  return k.endsWith("\n") ? k : k + "\n";
};

/**
 * 主机条目是否匹配（支持明文与 HashKnownHosts 的 |1|salt|hash 形式）
 */
const hostsFieldMatches = (hostsField, targets) => {
  if (!hostsField.startsWith("|1|")) {
    return hostsField
      .split(",")
      .some((h) => targets.includes(h.trim()));
  }
  // |1|<base64 salt>|<base64 HMAC-SHA1(host)>
  const parts = hostsField.split("|");
  if (parts.length < 4) return false;
  const saltB64 = parts[2];
  const expected = parts[3];
  try {
    const salt = Buffer.from(saltB64, "base64");
    return targets.some((t) => {
      const digest = crypto
        .createHmac("sha1", salt)
        .update(t)
        .digest("base64")
        .replace(/=+$/, "");
      return digest === expected.replace(/=+$/, "");
    });
  } catch (e) {
    return false;
  }
};

/**
 * 从 known_hosts 内容里取出该主机的 key 指纹（sha256 hex）
 */
const fingerprintsFromKnownHosts = (content, host, port) => {
  const targets = [String(host), `[${host}]:${port}`];
  const result = [];
  fingerprintsFromKnownHosts.seen = [];
  String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 3) return;
      const [hostsField, keyType, keyB64] = parts;
      if (keyType.startsWith("@")) return; // @cert-authority 等标记行
      fingerprintsFromKnownHosts.seen.push(
        hostsField.length > 40
          ? hostsField.slice(0, 40) + "…"
          : hostsField
      );
      if (!hostsFieldMatches(hostsField, targets)) return;
      try {
        const digest = crypto
          .createHash("sha256")
          .update(Buffer.from(keyB64, "base64"))
          .digest("hex");
        result.push(digest);
      } catch (e) {
        // 忽略解析不了的条目
      }
    });
  return result;
};

/**
 * 服务器部署方案（SSH Key 优先，兼容密码）
 */
const Server = function (options) {
  this.connecting = false;
  this.options = options || {};
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

    logAuthInfo(options, auth.privateKey);

    const extra = {};
    if (options.knownHosts) {
      const allowed = fingerprintsFromKnownHosts(
        options.knownHosts,
        options.host,
        options.port || 22
      );
      if (!allowed.length) {
        const seen = fingerprintsFromKnownHosts.seen || [];
        return reject(
          `knownHosts 里没有匹配 ${options.host}:${options.port ||
            22} 的条目。` +
            `已解析条目数=${seen.length}` +
            (seen.length
              ? `，主机字段示例=${seen.slice(0, 3).join(" / ")}`
              : "（内容不是 known_hosts 格式，或只有注释行）")
        );
      }
      extra.hostHash = "sha256";
      extra.hostVerifier = (hashedKey) =>
        allowed.some((fp) => fp === String(hashedKey).toLowerCase());
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
        ...extra,
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

/**
 * 执行远程命令并把本地文件从 stdin 灌进去（服务端禁 sftp 时用这条）
 */
Server.prototype.execWithFile = function (cmd, filePath) {
  return new Promise((resolve, reject) => {
    if (!this.connecting) {
      return reject("请先链接服务器");
    }

    const fs = require("fs");

    this.client.exec(cmd, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";
      let code = null;
      let failed = false;

      stream
        .on("data", (data) => {
          stdout += data.toString();
          process.stdout.write(data);
        })
        .on("close", (exitCode) => {
          code = exitCode;
          if (failed) return;
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

      const rs = fs.createReadStream(filePath);
      rs.on("error", (e) => {
        failed = true;
        try {
          stream.close();
        } catch (err) {
          /* ignore */
        }
        reject("读取本地包失败: " + e.message);
      });
      // pipe 结束会向远程 stdin 发送 EOF
      rs.pipe(stream);
    });
  });
};

Server.prototype.close = function () {
  this.connecting = false;
  this.client.end();
};

module.exports = Server;
