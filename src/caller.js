require('dotenv').config()

const path = require('path')

const { ServiceClient } = require('@slechtaj/service-client')
const { grpc, compression } = require('@slechtaj/service-client')
const debug = require('debug')('caller')
const { service: healthServiceMethods } = require('grpc-health-check')

const HealthService = grpc.makeGenericClientConstructor(healthServiceMethods)

const ChatClient = require('./chat/client')
const config = require('./config')
const sendFile = require('./file-share/client')
const JsonClient = require('./json/client')
const poiClient = require('./poi/client')
const { client: proxyClient } = require('./proxy')
const { teardown } = require('./utils')

const RANDOM_FILE = path.join(__dirname, 'caller.js')

function caller() {
	const sc = new ServiceClient(config)

	teardown((err, signal) => {
		if (err) {
			console.error(err)
		}
		debug(`Received ${signal}, closing connections and shutting down`)
		sc.close()
		process.exit()
	})

	try {
		sc.once('connected', async () => {
			debug('Connected to the service network')

			const demo = process.argv[2]

			// run the popular grpc demo
			if (demo === 'poi') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/poi')
				await poiClient(stub)
				stub.close()
				sc.close()
			}

			// run long-lived bidi-stream rpc
			if (demo === 'chat') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/chat')
				const peer = stub.getChannel().getTarget()
				const healthService = new HealthService(peer, grpc.credentials.createInsecure())

				healthService.check({ service: '' }, (error, response) => {
					if (error) {
						console.error(`[caller] | demo | health check failed: ${error.message}`)
					} else {
						console.log(`[caller] | demo | health check: ${response.status}`)
						const chat = new ChatClient(stub, () => {
							stub.close()
							sc.close()
						})
						chat.start()
					}
				})
			}

			if (demo === 'json') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/json')
				const JC = new JsonClient(stub)
				await JC.json({ hello: 'world from caller' })
				stub.close()
				sc.close()
			}

			if (demo === 'file-share') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/file_share')
				await sendFile(stub, RANDOM_FILE)
				stub.close()
				sc.close()
			}

			if (demo === 'disable-compression') {
				const clientOptions = {
					'grpc.default_compression_level': compression.LEVELS.NONE,
					'grpc.default_compression_algorithm': compression.ALGORITHMS.NO_COMPRESSION,
				}
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/file_share', clientOptions)
				await sendFile(stub, RANDOM_FILE)
				stub.close()
				sc.close()
			}

			if (demo === 'file-share-non-await-spam') {
				// eslint-disable-next-line no-constant-condition
				if (false) {
					// Don't do this! It will still work, but we might end up with multiple
					// connections which will be very resource intensive.
					for (let i = 0; i < 100; i++) {
						const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/file_share')
						await sendFile(stub, RANDOM_FILE) // share come rnd file
						stub.close()
					}
					sc.close()
				}
				// Instead reuse the channel like this:
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/file_share')
				for (let i = 0; i < 100; i++) {
					await sendFile(stub, RANDOM_FILE) // share come rnd file
				}
				stub.close()
				sc.close()
			}

			if (demo === 'lb-round-robin') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/file_share')
				// run multiple callee instances and let the load balancer distribute the requests
				for (let i = 0; i < 50; i++) {
					await sendFile(stub, RANDOM_FILE)
					await new Promise((resolve) => setTimeout(resolve, 500)) // so we can "see" the LB in action
				}
				stub.close()
				sc.close()
			}

			if (demo === 'proxy') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/simple_proxy')
				const proxyTarget = '/slechtaj-1.0.0/dev~service_route/simple_server'
				const request = 'AABBCCDDEEFFGGHHIIJJ'
				const response = await proxyClient(stub, proxyTarget, request)
				console.log(`[caller] | demo | response: ${response.join(' ')}`)
				stub.close()
				sc.close()
			}

			if (demo === 'proxy-cancel-propagation') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/simple_proxy')
				const proxyTarget = '/slechtaj-1.0.0/dev~service_route/simple_server'
				const request = 'AABBCCDDEEFFGGHHIIJJ'
				const response = await proxyClient(stub, proxyTarget, request, {
					onCall: (call) => {
						setTimeout(() => {
							console.log('[caller] | demo | cancelling call | call.cancel() after 3s')
							call.cancel()
						}, 3000)
					},
				})
				console.log(`[caller] | demo | response: ${response}`)
				stub.close()
				sc.close()
			}

			if (demo === 'proxy-deadline-propagation') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/simple_proxy')
				const proxyTarget = '/slechtaj-1.0.0/dev~service_route/simple_server'
				const request = 'AABBCCDDEEFFGGHHIIJJ'
				const deadline = new Date()
				deadline.setTime(deadline.setSeconds(deadline.getSeconds() + 5))
				const response = await proxyClient(stub, proxyTarget, request, {}, { deadline })
				console.log(`[caller] | demo | response: ${response}`)
				stub.close()
				sc.close()
			}
		})

		sc.once('error', (error) => {
			process.exitCode = 1
			console.error(error)
			sc.close()
		})

		sc.once('close', () => {
			process.exit()
		})

		sc.connect()
	} catch (error) {
		console.error('Caller error:')
		console.error(error)
	}
}

module.exports = caller

if (require.main === module) {
	caller()
}
