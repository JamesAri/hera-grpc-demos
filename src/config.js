const { logLevels } = require('@slechtaj/service-client')

const { getPublicInterface } = require('./utils')

module.exports = {
	host: getPublicInterface() || 'localhost',
	port: process.env.PORT || 0, // 0 means random port
	zk: 'zk://localhost:2181/hera-test',
	logLevel: logLevels.ALL,
}
