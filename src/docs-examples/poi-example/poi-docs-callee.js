const path = require('path')

const { ServiceClient } = require('@slechtaj/service-client')

// Handlers from the POI service tutorial
const poiHandlers = require('../../poi/handlers')

const sc = new ServiceClient({
	zk: 'zk://localhost:2181/hera-grpc',
})

sc.registerService({
	routes: '/example-1/dev~service_route/poi',
	serviceName: 'RouteGuide',
	handlers: poiHandlers,
	filename: path.join(__dirname, '../../../proto/poi/poi.proto'),
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
})

const run = async () => {
	await sc.connect()
}

run().catch(console.error)
