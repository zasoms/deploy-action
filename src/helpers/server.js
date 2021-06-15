const Client = require('ssh2').Client


/**
 * 服务器部署方案
 */
const Server = function(options) {
  this.connecting = false
  this.options = options || {
    host: '',
    port: '',
    username: '',
    password: ''
  }
  this.client = new Client()
}
Server.prototype.connect = function() {
  const that = this
  return new Promise(function (resolve) {
    if (that.connecting) return resolve()

    const options = that.options
    that.client.on('ready', function() {
      that.connecting = true
      resolve()
    }).connect({
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password
    })
  })
}
Server.prototype.sftp = function(source, target) {
  const that = this
  return new Promise(function(resolve, reject) {
    if (!that.connecting) {
      return reject('请先链接服务器')
    }

    that.client.sftp(function(err, sftp) {
      sftp.fastPut(source, target, {}, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  })
}
Server.prototype.shell = function(cmd) {
  return new Promise(function (resolve, reject) {
    this.client.shell((err, stream) => {
      stream.on('data', (data) => {
        // 输出部署时的信息
        console.log('data: ', data.toString());
      }).on('exit', (code, ...args) => {
        if (code === 0) {
          resolve()
        } else {
          console.log(args)
          reject(args)
        }
      })

      stream.end(`
        ${ cmd }
        exit
      `)
    })
  })
}
Server.prototype.close = function() {
  this.connecting = false
  this.client.end()
}

 module.exports = Server