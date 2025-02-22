require('dotenv').config()

const path = require('path')

const ServiceClient = require('@slechtaj/service-client')
const { grpc } = require('@slechtaj/service-client')
const debug = require('debug')('caller')
const { service: healthServiceMethods } = require('grpc-health-check')

const HealthService = grpc.makeGenericClientConstructor(healthServiceMethods)

const ChatClient = require('./chat/client')
const config = require('./config')
const FileShareClient = require('./file-share/client')
const poiClient = require('./poi/client')
const { client: proxyClient } = require('./proxy')
const { teardown } = require('./utils')

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
						// run long-lived bidi-stream rpc
						chat.start()
					}
				})
			}

			if (demo === 'file-share') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/file_share')
				const fsc = new FileShareClient(stub)
				await fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
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
						const fsc = new FileShareClient(stub)
						await fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
						stub.close()
					}
					sc.close()
				}
				// Instead reuse the channel like this:
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/file_share')
				const fsc = new FileShareClient(stub)
				for (let i = 0; i < 100; i++) {
					await fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
				}
				stub.close()
				sc.close()
			}

			if (demo === 'poi') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/poi')
				await poiClient(stub) // run the popular grpc demo
				stub.close()
				sc.close()
			}

			if (demo === 'lb-round-robin') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/file_share')
				// run multiple callee instances and let the load balancer distribute the requests
				const fsc = new FileShareClient(stub)
				for (let i = 0; i < 50; i++) {
					await fsc.sendFile(path.join(__dirname, 'caller.js'))
					await new Promise((resolve) => setTimeout(resolve, 500)) // so we can "see" the LB in action
				}
				stub.close()
				sc.close()
			}

			if (demo === 'proxy') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/simple_proxy')
				const path = '/slechtaj-1.0.0/dev~service_route/simple_server'

				const request = 'AABBCCDDEEFFGGHHIIJJ'

				const response = await proxyClient(stub, path, request)

				console.log(`[caller] | demo | response: ${response.join(' ')}`)
				stub.close()
				sc.close()
			}

			if (demo === 'proxy-cancel-propagation') {
				const stub = await sc.getStub('/slechtaj-1.0.0/dev~service_route/simple_proxy')
				const path = '/slechtaj-1.0.0/dev~service_route/simple_server'

				const request = 'AABBCCDDEEFFGGHHIIJJ'

				const response = await proxyClient(stub, path, request, {
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
				const path = '/slechtaj-1.0.0/dev~service_route/simple_server'

				const request = 'AABBCCDDEEFFGGHHIIJJ'

				const response = await proxyClient(stub, path, request, {}, { deadline: new Date().getTime() + 5000 })
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
