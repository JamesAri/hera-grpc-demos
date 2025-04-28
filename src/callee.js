// Callee - registerning various gRPC services

/* eslint-disable prettier/prettier */
require('dotenv').config()

const debug = require('debug')('callee')
const { ServiceClient } = require('hera-grpc')

const config = require('./config')
const TestServerInterceptor = require('./interceptors/server-interceptor')
const { teardown } = require('./utils')

const serverOptions = { interceptors: [new TestServerInterceptor().interceptor] }
const sc = new ServiceClient({ ...config, serverOptions })

teardown((err, signal) => {
	if (err) {
		console.error(err)
	}
	debug(`Received ${signal}, closing connections and shutting down`)
	sc.close()
})

const registerService = (routes, config, handlers) => {
	sc.registerService({
		routes: routes,
		filename: config.filename,
		serviceName: config.serviceName,
		loadOptions: config.loadOptions,
		handlers: handlers,
	})
}

const demo = process.argv[2]

registerService(
	'/slechtaj-1/dev~service_route/chat',
	require('../proto/chat/config'),
	require('./chat/handlers')
)

registerService(
	'/slechtaj-1/dev~service_route/poi',
	require('../proto/poi/config'),
	require('./poi/handlers')
)

registerService(
	'/slechtaj-1/dev~service_route/file_share',
	require('../proto/file-share/config'),
	require('./file-share/handlers'),
)

registerService(
	'/slechtaj-1/dev~service_route/json',
	require('../proto/json/config'),
	require('./json/handlers')
)

if (demo === 'simple-proxy') {
	registerService(
		'/slechtaj-1/dev~service_route/simple_proxy',
		require('../proto/proxy/simple-proxy/config'),
		require('./proxy').simpleProxyHandler,
	)
}
if (demo === 'simple-server') {
	registerService(
		'/slechtaj-1/dev~service_route/simple_server',
		require('../proto/proxy/simple-server/config'),
		require('./proxy').simpleServerHandler,
	)
}

async function callee() {
	try {
		await sc.connect()
		debug('Connected to the service network')
	} catch (error) {
		console.error('Callee error:', error)
		await sc.close()
	}
}

module.exports = callee

if (require.main === module) {
	callee()
}
