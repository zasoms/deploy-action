const path = require("path");
const fs = require("fs");
const Server = require("./helpers/server");

/**
 * 验证配置参数
 * @param {Object} config 配置对象
 * @throws {Error} 如果配置无效
 */
const validateConfig = (config) => {
  const requiredFields = ["host", "port", "username", "password", "output"];
  const missingFields = requiredFields.filter(field => !config[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`配置错误: 缺少必需参数 ${missingFields.join(", ")}`);
  }

  // 验证端口号
  if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
    throw new Error('配置错误: 端口号必须是1-65535之间的数字');
  }

  // 验证工作目录
  if (config.workspace && !fs.existsSync(config.workspace)) {
    throw new Error(`配置错误: 工作目录 ${config.workspace} 不存在`);
  }
};

/**
 * 构建部署脚本
 * @param {Object} config 配置对象
 * @param {string} targetPath 目标路径
 * @param {string} zipFileName 压缩文件名
 * @returns {string} 部署脚本
 */
const buildDeployScript = (config, targetPath, zipFileName) => {
  const cleanCommand = config.clean 
    ? 'find . -mindepth 1 -maxdepth 1 ! -name ".*" -exec rm -rf {} \\;' 
    : '';
  
  const extractCommand = zipFileName.includes('tar.gz')
    ? `tar -zxvf ${zipFileName} --overwrite`
    : `unzip -o ${zipFileName}`;

  return config.script || `
    cd ${targetPath}
    ${cleanCommand}
    ${extractCommand}
  `;
};

/**
 * 部署函数
 * @param {Object} config 配置对象
 * @returns {Promise<string>} 部署结果
 */
module.exports = function deploy(config) {
  return new Promise((resolve, reject) => {
    let server = null;

    try {
      // 验证配置
      validateConfig(config);

      // 准备路径和文件名
      const targetPath = `${config.output}${config.output.slice(-1) === "/" ? "" : "/"}`;
      const zipFileName = config.input || "dist.zip";
      const zipFile = path.resolve(config.workspace || ".", zipFileName);

      // 验证源文件是否存在
      if (!fs.existsSync(zipFile)) {
        throw new Error(`部署失败: 文件 ${zipFile} 不存在`);
      }

      // 创建服务器连接
      server = new Server({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
      });

      // 执行部署流程
      
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
          unzip -o ${zipFileName}
        `
          )
          .then(() => {
            resolve("部署成功");
          })
          .catch((e) => {
            console.log(e)
            return Promise.reject("部署失败");
          })
      })
      .then(() => server.close())
      .catch((err) => {
        console.log((err))
        server.close();
        reject(err)
      });
    } catch (error) {
      // 处理同步代码中的错误
      if (server) {
        server.close()
        console.error('关闭服务器连接时发生错误:', err);
      }
      reject(error);
    }
  });
};
