const path = require('path')
const core = require('@actions/core')

const util = require('./util')
const Server = require('./helpers/server')

module.exports = function(workspace, message) {
  var host = core.getInput('host')
  var port = core.getInput('port')
  var username = core.getInput('username')
  var password = core.getInput('password')
  var input = core.getInput('input')
  var output = core.getInput('output')

  const fields =['host', 'port', 'username', 'password', 'input', 'output']
  if (!host || !port || !username || !password || !input || !output) {
    return console.log('参数配置缺失，需要' + fields.join(','))
  }
  const targetPath = `${ output }${ output.slice(0, -1) === '/' ? '' : '/' }`
  const sourcePath = path.resolve(workspace, './' + input)
  const zipFileName = Date.now() + '.zip'
  const zipFile = sourcePath + '/' + zipFileName

  util.zip(sourcePath, zipFile)

  var server = new Server({
    host: host,
    port: port,
    username: username,
    password: password
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

