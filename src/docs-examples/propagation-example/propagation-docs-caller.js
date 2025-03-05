const { assert } = require('console')
const promisify = require('util').promisify

const { ServiceClient } = require('@slechtaj/service-client')

const sc = new ServiceClient({
	zk: 'zk://localhost:2181/hera-test',
})

const run = async () => {
	await sc.connect()

	const stub = await sc.getStub('/example-1.0.0/dev~service_route/helloworld')
	stub.addOne = promisify(stub.addOne)

	const request = { value: 41 }
	const response = await stub.addOne(request)
	stub.close()

	assert(response.value === 42)
}

run().catch(console.error).finally(sc.close)
