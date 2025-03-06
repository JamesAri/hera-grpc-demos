const path = require('path')

const { ServiceClient } = require('hera-grpc')

const sc = new ServiceClient({
	zk: 'zk://localhost:2181/hera-grpc',
})

sc.registerService({
	routes: '/hardworking-service',
	serviceName: 'my.package.v1.HelloWorld',
	filename: path.join(__dirname, 'helloworld.proto'),
	handlers: {
		addOne: async (call, callback) => {
			const { request } = call
			callback(null, { value: request.value + 1 })
		},
	},
})

const run = async () => {
	await sc.connect()
}

run().catch(console.error)
