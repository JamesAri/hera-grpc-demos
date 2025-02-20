const path = require('path')

const loadOptions = {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
	includeDirs: [path.join(__dirname, '/../common')],
}

module.exports = {
	simpleProxyConfig: {
		filename: path.join(__dirname, '/simple-proxy.proto'),
		loadOptions,
		serviceName: 'hera.proxy.v1.SimpleProxy', // namespace
	},
	simpleServerConfig: {
		filename: path.join(__dirname, '/simple-server.proto'),
		loadOptions,
		serviceName: 'hera.proxy.v1.SimpleServer', // namespace
	},
}
