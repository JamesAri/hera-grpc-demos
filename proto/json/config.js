const path = require('path')

module.exports = {
	filename: path.join(__dirname, '/json.proto'),
	serviceName: 'hera.internal.v1.JsonService', // namespace
}
