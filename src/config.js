const { logLevels } = require('hera-grpc')

module.exports = {
	zk: 'zk://localhost:2181/hera-grpc',
	logLevel: logLevels.ALL,
}
