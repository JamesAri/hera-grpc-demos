const { logLevels } = require('hera-grpc')

module.exports = {
	zk: 'zk://localhost:2181/hera-grpc',
	port: 50051,
	logLevel: logLevels.ALL,
}
