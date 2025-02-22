require('dotenv').config()

const ServiceClient = require('@slechtaj/service-client')
const debug = require('debug')('callee')

const chatLoadConfig = require('../proto/chat/config')
const fileShareLoadConfig = require('../proto/file-share/config')
const poiLoadConfig = require('../proto/poi/config')
const { simpleProxyConfig, simpleServerConfig } = require('../proto/proxy/config')

const config = require('./config')
const { teardown } = require('./utils')

// service with long-lived bidi-stream
const chatService = {
	route: '/slechtaj-1.0.0/dev~service_route/chat',
	handlers: require('./chat/handlers'),
	serviceName: chatLoadConfig.serviceName,
	filename: chatLoadConfig.filename,
	loadOptions: chatLoadConfig.loadOptions,
}

// service with all types of grpc streams/requests
const poiService = {
	route: '/slechtaj-1.0.0/dev~service_route/poi',
	handlers: require('./poi/handlers'),
	serviceName: poiLoadConfig.serviceName,
	filename: poiLoadConfig.filename,
	loadOptions: poiLoadConfig.loadOptions,
}

// service with request-stream file upload demo
const fileShareService = {
	route: '/slechtaj-1.0.0/dev~service_route/file_share',
	handlers: require('./file-share/handlers'),
	serviceName: fileShareLoadConfig.serviceName,
	filename: fileShareLoadConfig.filename,
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

const registerServices = (services, sc) => {
	for (const service of services) {
		sc.registerService(service.route, service.filename, service.serviceName, service.handlers, service.loadOptions)
	}
}

function callee() {
	const sc = new ServiceClient(config)

	const demo = process.argv[2]

	teardown((err, signal) => {
		if (err) {
			console.error(err)
		}
		// debug(`Received ${signal}, closing connections and shutting down`)
		// sc.close()
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

		const services = [chatService, poiService, fileShareService]

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
