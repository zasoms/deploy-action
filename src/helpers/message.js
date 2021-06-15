const https = require('https')

/**
 * 群机器人通知
 */
const Message = function(robotkey) {
  this.robotkey = robotkey
}
Message.prototype.request = function(data) {
  const robotkey = this.robotkey
  if (!robotkey) return console.log(data)

  const options = {
    protocol:'https:',
    host: 'qyapi.weixin.qq.com',
    path: `/cgi-bin/webhook/send?key=${ robotkey }`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }
  const req = https.request(options, res => {
    res.on('data', (d) => {
      process.stdout.write(d)
    })
  })
  req.on('error', error => {
    console.error(error)
  })
  req.write(data);
  req.end()
}
Message.prototype.sendText = function(content) {
  this.request(JSON.stringify({
    msgtype: "text",
    text: { content }
  }))

}
 module.exports = Message
