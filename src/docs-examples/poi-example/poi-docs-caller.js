const { ServiceClient } = require('@slechtaj/service-client')

const poiClient = require('../../poi/client')

const sc = new ServiceClient({
	zk: 'zk://localhost:2181/hera-test',
})

const run = async () => {
	await sc.connect()
	// Get stub with the rpc methods for the specified route
	const stub = await sc.getStub('/example-1.0.0/dev~service_route/poi')
	stub.close()

	// Client from the tutorial
	await poiClient(stub)
}

run().catch(console.error).finally(sc.close)
