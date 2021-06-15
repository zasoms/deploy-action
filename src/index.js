const core = require('@actions/core')
// const github = require('@actions/github')

const Message = require('./helpers/message')

const web = require('./web')
// const miniprogram = require('./miniprogram')

try {
  // 应用类型暂时只支持message、web、miniprogram
  const type = core.getInput('type') || 'web'
	const robotKey = core.getInput('robotkey')
	const message = new Message(robotKey)

	const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE

	switch (type) {
		case 'web':
			var host = core.getInput('host')
			var port = core.getInput('port')
			var username = core.getInput('username')
			var password = core.getInput('password')
			var input = core.getInput('input')
			var output = core.getInput('output')

			web({
				host: host,
				port: port,
				username: username,
				password: password,
				input: input,
				input: output,
			}, GITHUB_WORKSPACE, message)
			break
		case 'miniprogram':
			break
		case 'message':
			var content = core.getInput('content')
			if (!content) {
				return console.log('参数配置缺失，需要content')
			}
			message.sendText(content)
			break
	}

} catch (error) {
  core.setFailed(error.message)
}