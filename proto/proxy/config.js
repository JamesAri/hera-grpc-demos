const path = require('path')

const loadOptions = {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
}

module.exports = {
	simpleProxyConfig: {
		filename: path.join(__dirname, '/simple-proxy.proto'),
		loadOptions,
		serviceName: 'SimpleProxy', // namespace
	},
	simpleServerConfig: {
		filename: path.join(__dirname, '/simple-server.proto'),
		loadOptions,
		serviceName: 'SimpleServer', // namespace
	},
}
