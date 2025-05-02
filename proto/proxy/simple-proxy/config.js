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
	filename: path.join(__dirname, '/simple-proxy.proto'),
	loadOptions,
	serviceName: 'hera.proxy.v1.SimpleProxy', // namespace
}
