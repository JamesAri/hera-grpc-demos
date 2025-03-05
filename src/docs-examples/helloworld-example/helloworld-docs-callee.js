const path = require('path')

const { ServiceClient } = require('@slechtaj/service-client')

const sc = new ServiceClient({
	host: 'localhost',
	port: 50051,
	zk: 'zk://localhost:2181/hera-test',
})

sc.registerService({
	routes: '/example-1.0.0/dev~service_route/helloworld',
	serviceName: 'my.package.v1.HelloWorld',
	filename: path.join(__dirname, 'helloworld.proto'),
	handlers: {
		addOne: (call, callback) => {
			const { request } = call
			callback(null, { value: request.value + 1 })
		},
	},
})

const run = async () => {
	await sc.connect()
}

run().catch(console.error)
