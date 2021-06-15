const path = require('path')
const util = require('./util')
const Server = require('./helpers/server')

module.exports = function(config, workspace, message) {
  const fields =['host', 'port', 'username', 'password', 'input', 'output']
  // 简单的校验一下规则
  const hasAcess = fields.every(item => config[item])
  if (!hasAcess) {
    return console.log('参数配置缺失，需要' + fields.join(','))
  }
  const targetPath = `${ config.output }${ config.output.slice(0, -1) === '/' ? '' : '/' }`
  const sourcePath = path.resolve(workspace, './' + config.input)
  const zipFileName = Date.now() + '.zip'
  const zipFile = sourcePath + '/' + zipFileName

  util.zip(sourcePath, zipFile)

  var server = new Server({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password
  })

  server.connect()
    .then(() => {
      return server.sftp(zipFile, targetPath + zipFileName)
        .catch(() => {
          message.sendText(msgSuffix + '文件/文件夹上传失败')
          return Promise.reject()
        })
    })
    .then(() => {
      return server.shell(`
        cd ${ targetPath }
        mv ${ zipFileName } /tmp
        rm -rf *
        mv /tmp/${ zipFileName } .
        unzip ${ zipFileName }
      `).then(() => {
        message.sendText(msgSuffix + '部署成功')
      }).catch(() => {
        message.sendText( msgSuffix + '部署失败')
      }).then(() => server.close())
    })
}

