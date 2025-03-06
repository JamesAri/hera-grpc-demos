const path = require('path')

const { ServiceClient } = require('hera-client')

const sc = new ServiceClient({
	zk: 'zk://localhost:2181/hera-grpc',
})

sc.registerService({
	routes: '/example-1/dev~service_route/helloworld',
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
