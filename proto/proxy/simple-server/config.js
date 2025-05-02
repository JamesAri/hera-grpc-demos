const path = require('path')

const loadOptions = {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
	includeDirs: [path.join(__dirname, '/../../common')],
}

module.exports = {
	filename: path.join(__dirname, '/simple-server.proto'),
	loadOptions,
	serviceName: 'hera.proxy.v1.SimpleServer', // namespace
}
