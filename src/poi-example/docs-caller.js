const { ServiceClient } = require('@slechtaj/service-client')

const poiClient = require('../poi/client')

const sc = new ServiceClient({
	zk: 'zk://localhost:2181/hera-test',
})

sc.once('connected', async () => {
	// Get stub with the rpc methods for the specified route
	const stub = await sc.getStub('/example-1.0.0/dev~service_route/poi')

	// Client from the tutorial
	await poiClient(stub)

	stub.close()
	sc.close()
})

sc.once('error', (error) => {
	process.exitCode = 1
	console.error('Error from service client:', error)
	sc.close()
})

try {
	sc.connect()
} catch (error) {
	console.error('Caller error:', error)
	sc.close()
}
