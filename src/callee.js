require('dotenv').config()

const { ServiceClient } = require('@slechtaj/service-client')
const debug = require('debug')('callee')

const chatServiceConfig = require('../proto/chat/config')
const fileShareServiceConfig = require('../proto/file-share/config')
const poiServiceConfig = require('../proto/poi/config')
const { simpleProxyConfig, simpleServerConfig } = require('../proto/proxy/config')

const config = require('./config')
const { teardown } = require('./utils')

// service with long-lived bidi-stream
const chatService = {
	route: '/slechtaj-1.0.0/dev~service_route/chat',
	handlers: require('./chat/handlers'),
	serviceName: chatServiceConfig.serviceName,
	filename: chatServiceConfig.filename,
	loadOptions: chatServiceConfig.loadOptions,
}

// service with all types of grpc streams/requests
const poiService = {
	route: '/slechtaj-1.0.0/dev~service_route/poi',
	handlers: require('./poi/handlers'),
	serviceName: poiServiceConfig.serviceName,
	filename: poiServiceConfig.filename,
	loadOptions: poiServiceConfig.loadOptions,
}

// service with request-stream file upload demo
const fileShareService = {
	route: '/slechtaj-1.0.0/dev~service_route/file_share',
	handlers: require('./file-share/handlers'),
	serviceName: fileShareServiceConfig.serviceName,
	filename: fileShareServiceConfig.filename,
}

// service for parent demo - proxy
const simpleProxyService = {
	route: '/slechtaj-1.0.0/dev~service_route/simple_proxy',
	handlers: require('./proxy').simpleProxyHandler,
	serviceName: simpleProxyConfig.serviceName,
	filename: simpleProxyConfig.filename,
	loadOptions: simpleProxyConfig.loadOptions,
}

// service for parent demo - server
const simpleServerService = {
	route: '/slechtaj-1.0.0/dev~service_route/simple_server',
	handlers: require('./proxy').simpleServerHandler,
	serviceName: simpleServerConfig.serviceName,
	filename: simpleServerConfig.filename,
	loadOptions: simpleServerConfig.loadOptions,
}

const jsonService = {
	route: '/slechtaj-1.0.0/dev~service_route/json',
	handlers: require('./json/handlers'),
	serviceName: 'hera.internal.v1.JsonService',
}

const registerServices = (services, sc) => {
	for (const service of services) {
		sc.registerService({
			routes: service.route,
			filename: service.filename,
			serviceName: service.serviceName,
			handlers: service.handlers,
			loadOptions: service.loadOptions,
		})
	}
}

function callee() {
	const sc = new ServiceClient(config)

	const demo = process.argv[2]

	teardown((err, signal) => {
		if (err) {
			console.error(err)
		}
		debug(`Received ${signal}, closing connections and shutting down`)
		sc.close()
	})

	try {
		sc.once('connected', () => {
			debug('Connected to the service network and ready to send requests')
		})

		sc.once('registered', (port) => {
			debug(`gRPC server listening on http://${config.connection.host}:${port}`)
			debug('Services registered to zookeeper and ready to handle requests')
		})

		sc.once('error', (error) => {
			console.error(error)
		})

		sc.once('close', () => {
			console.log('Server closing')
			process.exit()
		})

		const services = [chatService, poiService, fileShareService, jsonService]

		if (demo === 'simple-proxy') services.push(simpleProxyService)
		if (demo === 'simple-server') services.push(simpleServerService)

		registerServices(services, sc)
		sc.connect()
	} catch (error) {
		console.error('Callee error:')
		console.error(error)
	}
}

module.exports = callee

if (require.main === module) {
	callee()
}
