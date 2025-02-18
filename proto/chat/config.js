const path = require('path')

module.exports = {
	filename: [path.join(__dirname, '/chat.proto')],
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
	serviceName: 'ChatRoom',
}
