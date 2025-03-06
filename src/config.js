const { logLevels } = require('hera-client')

module.exports = {
	zk: 'zk://localhost:2181/hera-grpc',
	logLevel: logLevels.ALL,
}
