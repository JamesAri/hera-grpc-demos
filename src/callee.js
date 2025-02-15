const debug = require('debug')('callee')

const ServiceClient = require('@slechtaj/service-client')
const config = require('./config')
const { teardown } = require('./utils')

// Mock some services that we want to register
const chatLoadConfig = require('../proto/chat/config')
const poiLoadConfig = require('../proto/poi/config')
const fileShareLoadConfig = require('../proto/file-share/config')

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
	loadOptions: fileShareLoadConfig.loadOptions,
}

const registerServices = (services, sc) => {
	for (const service of services) {
		sc.registerService(service.route, service.filename, service.serviceName, service.handlers, service.loadOptions)
	}
}

function callee() {
	const sc = new ServiceClient({ config })

	teardown((err, signal) => {
		if (err) {
			console.error(err)
		}
		debug(`Received ${signal}, closing connections and shutting down`)
		sc.close()
		process.exit()
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
			process.exitCode = 1
			console.error(error)
			// sc.close()
		})

		sc.once('close', () => {
			process.exit()
		})

		registerServices([chatService, poiService, fileShareService], sc)
		sc.connect()
	} catch (error) {
		console.error('Unexpected error:')
		console.error(error)
	}
}

if (require.main === module) {
	callee()
}
