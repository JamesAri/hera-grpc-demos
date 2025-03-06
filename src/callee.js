require('dotenv').config()

const debug = require('debug')('callee')
const { ServiceClient } = require('hera-client')

const chatServiceConfig = require('../proto/chat/config')
const fileShareServiceConfig = require('../proto/file-share/config')
const poiServiceConfig = require('../proto/poi/config')
const { simpleProxyConfig, simpleServerConfig } = require('../proto/proxy/config')

const config = require('./config')
const TestServerInterceptor = require('./server-interceptor')
const { teardown } = require('./utils')

const cleanups = []

teardown((err, signal) => {
	if (err) {
		console.error(err)
	}
	debug(`Received ${signal}, closing connections and shutting down`)
	cleanups.forEach((cleanup) => {
		cleanup()
	})
})

// service with long-lived bidi-stream
const chatService = {
	routes: '/slechtaj-1/dev~service_route/chat',
	handlers: require('./chat/handlers'),
	serviceName: chatServiceConfig.serviceName,
	filename: chatServiceConfig.filename,
	loadOptions: chatServiceConfig.loadOptions,
}

// service with all types of grpc streams/requests
const poiService = {
	routes: '/slechtaj-1/dev~service_route/poi',
	handlers: require('./poi/handlers'),
	serviceName: poiServiceConfig.serviceName,
	filename: poiServiceConfig.filename,
	loadOptions: poiServiceConfig.loadOptions,
}

// service with request-stream file upload demo
const fileShareService = {
	routes: '/slechtaj-1/dev~service_route/file_share',
	handlers: require('./file-share/handlers'),
	serviceName: fileShareServiceConfig.serviceName,
	filename: fileShareServiceConfig.filename,
}

// service for parent demo - proxy
const simpleProxyService = {
	routes: '/slechtaj-1/dev~service_route/simple_proxy',
	handlers: require('./proxy').simpleProxyHandler,
	serviceName: simpleProxyConfig.serviceName,
	filename: simpleProxyConfig.filename,
	loadOptions: simpleProxyConfig.loadOptions,
}

// service for parent demo - server
const simpleServerService = {
	routes: '/slechtaj-1/dev~service_route/simple_server',
	handlers: require('./proxy').simpleServerHandler,
	serviceName: simpleServerConfig.serviceName,
	filename: simpleServerConfig.filename,
	loadOptions: simpleServerConfig.loadOptions,
}

const jsonService = {
	routes: '/slechtaj-1/dev~service_route/json',
	handlers: require('./json/handlers'),
	serviceName: 'hera.internal.v1.JsonService',
}

const registerServices = (services, sc) => {
	for (const service of services) {
		sc.registerService({
			routes: service.routes,
			filename: service.filename,
			serviceName: service.serviceName,
			handlers: service.handlers,
			loadOptions: service.loadOptions,
		})
	}
}

const services = [chatService, poiService, fileShareService, jsonService]

const demo = process.argv[2]

if (demo === 'simple-proxy') services.push(simpleProxyService)
if (demo === 'simple-server') services.push(simpleServerService)

async function callee() {
	try {
		const serverOptions = { interceptors: [new TestServerInterceptor().interceptor] }
		const sc = new ServiceClient({ ...config, serverOptions })

		cleanups.push(sc.close)

		registerServices(services, sc)

		await sc.connect()
	} catch (error) {
		console.error('Callee error:', error)
	}
}

module.exports = callee

if (require.main === module) {
	callee()
}
