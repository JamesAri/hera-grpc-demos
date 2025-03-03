const path = require('path')

const { ServiceClient } = require('@slechtaj/service-client')

const poiProtoPath = path.join(__dirname, '../proto/poi/poi.proto')

// Handlers from the POI service tutorial
const poiHandlers = require('../poi/handlers')

const sc = new ServiceClient({
	host: 'localhost',
	port: 50051,
	zk: 'zk://localhost:2181/hera-test',
})

sc.registerService({
	routes: '/example-1.0.0/dev~service_route/poi',
	serviceName: 'RouteGuide',
	handlers: poiHandlers,
	filename: poiProtoPath,
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
})

sc.on('error', (error) => {
	console.error('Error from service client:', error)
})

try {
	sc.connect()
} catch (error) {
	console.error('Callee error:', error)
	sc.close()
}
