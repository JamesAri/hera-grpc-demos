const path = require('path')
const promisify = require('util').promisify

const { ServiceClient } = require('@slechtaj/service-client')

const sc = new ServiceClient({
	zk: 'zk://localhost:2181/hera-grpc',
})

sc.registerService({
	routes: '/example-1/dev~service_route/helloworld',
	serviceName: 'my.package.v1.HelloWorld',
	filename: path.join(__dirname, 'helloworld.proto'),
	handlers: {
		addOne: async (call, callback) => {
			const { request } = call

			// this service is lazy... it will pass the work to another one!
			const stub = await call.getStub('/hardworking-service')
			stub.addOne = promisify(stub.addOne)

			const response = await stub.addOne({ value: request.value })

			callback(null, { value: response.value })
		},
	},
})

const run = async () => {
	await sc.connect()
}

run().catch(console.error)
