require('dotenv').config()

const path = require('path')

const { ServiceClient } = require('@slechtaj/service-client')
const { grpc, compression } = require('@slechtaj/service-client')
const debug = require('debug')('caller')
const { service: healthServiceMethods } = require('grpc-health-check')

const HealthService = grpc.makeGenericClientConstructor(healthServiceMethods)

const ChatClient = require('./chat/client')
const TestClientInterceptor = require('./client-interceptor')
const config = require('./config')
const sendFile = require('./file-share/client')
const JsonClient = require('./json/client')
const poiClient = require('./poi/client')
const { client: proxyClient } = require('./proxy')
const { teardown } = require('./utils')

const RANDOM_FILE = path.join(__dirname, 'caller.js')

const cleanups = []

teardown((err, signal) => {
	if (err) {
		console.error(err)
	}
	debug(`Received ${signal}, closing connections and shutting down`)
	cleanups.forEach((cleanup) => {
		cleanup()
	})
})

async function caller() {
	const sc = new ServiceClient(config)

	cleanups.push(() => {
		sc.close()
		process.exit(1)
	})

	try {
		await sc.connect()

		debug('Connected to the service network')

		const demo = process.argv[2]

		// run long-lived bidi-stream rpc
		if (demo === 'chat') {
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/chat')
			const peer = stub.getChannel().getTarget()
			const healthService = new HealthService(peer, grpc.credentials.createInsecure())

			healthService.check({ service: '' }, (error, response) => {
				if (error) {
					console.error(`[caller] | demo | health check failed: ${error.message}`)
				} else {
					console.log(`[caller] | demo | health check: ${response.status}`)
					const chat = new ChatClient(stub, async () => {
						stub.close()
						await sc.close()
						console.log('Closed connection after await')
					})
					chat.start()
				}
			})
			return
		}

		// run the popular grpc demo
		if (demo === 'poi') {
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/poi')
			await poiClient(stub)
			stub.close()
		}

		if (demo === 'json') {
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/json')
			const JC = new JsonClient(stub)
			await JC.json({ hello: 'world from caller' })
			stub.close()
		}

		if (demo === 'file-share') {
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/file_share')
			await sendFile(stub, RANDOM_FILE)
			stub.close()
		}

		if (demo === 'disable-compression') {
			const clientOptions = {
				'grpc.default_compression_level': compression.LEVELS.NONE,
				'grpc.default_compression_algorithm': compression.ALGORITHMS.NO_COMPRESSION,
			}
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/file_share', clientOptions)
			await sendFile(stub, RANDOM_FILE)
			stub.close()
		}

		if (demo === 'dangerous-client-usage') {
			// eslint-disable-next-line no-constant-condition
			if (false) {
				// Don't do this! It will still work, but we might end up with multiple
				// connections which will be very resource intensive.
				for (let i = 0; i < 100; i++) {
					const stub = await sc.getStub('/slechtaj-1/dev~service_route/file_share')
					await sendFile(stub, RANDOM_FILE) // share some rnd file
					stub.close()
				}
				sc.close()
			}
			// Instead reuse the channel like this:
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/file_share')
			for (let i = 0; i < 100; i++) {
				await sendFile(stub, RANDOM_FILE) // share some rnd file
			}
			stub.close()
		}

		if (demo === 'lb-round-robin') {
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/file_share')
			// run multiple callee instances and let the load balancer distribute the requests
			for (let i = 0; i < 50; i++) {
				await sendFile(stub, RANDOM_FILE)
				await new Promise((resolve) => setTimeout(resolve, 500)) // so we can "see" the LB in action
			}
			stub.close()
		}

		if (demo === 'proxy') {
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/simple_proxy')
			const proxyTarget = '/slechtaj-1/dev~service_route/simple_server'
			const request = 'AABBCCDDEEFFGGHHIIJJ'
			const response = await proxyClient(stub, proxyTarget, request)
			console.log(`[caller] | demo | response: ${response.join(' ')}`)
			stub.close()
		}

		if (demo === 'proxy-cancel-propagation') {
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/simple_proxy')
			const proxyTarget = '/slechtaj-1/dev~service_route/simple_server'
			const request = 'AABBCCDDEEFFGGHHIIJJ'
			try {
				const response = await proxyClient(stub, proxyTarget, request, {
					onCall: (call) => {
						setTimeout(() => {
							console.log('[caller] | demo | cancelling call | call.cancel() after 5s')
							call.cancel()
						}, 5000)
					},
				})
				console.log(`[caller] | demo | response: ${response}`)
			} catch (error) {
				console.error(`[caller] | demo | error: ${error.message}`)
			} finally {
				stub.close()
			}
		}

		if (demo === 'proxy-deadline-propagation') {
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/simple_proxy')
			const proxyTarget = '/slechtaj-1/dev~service_route/simple_server'
			const request = 'AABBCCDDEEFFGGHHIIJJ'
			const deadline = new Date()
			deadline.setTime(deadline.setSeconds(deadline.getSeconds() + 5))
			try {
				const response = await proxyClient(stub, proxyTarget, request, {}, { deadline })
				console.log(`[caller] | demo | response: ${response}`)
			} catch (error) {
				console.error(`[caller] | demo | error: ${error.message}`)
			} finally {
				stub.close()
			}
		}

		if (demo === 'interceptor') {
			const clientOptions = { interceptors: [new TestClientInterceptor().interceptor] }
			const stub = await sc.getStub('/slechtaj-1/dev~service_route/file_share', clientOptions)
			await sendFile(stub, RANDOM_FILE /** clientOptions */) // NOTE: cannot use interceptors on call, only at stub creation
			stub.close()
		}

		sc.close()
	} catch (error) {
		console.error('Caller error:', error)
		sc.close()
	}
}

module.exports = caller

if (require.main === module) {
	caller()
}
