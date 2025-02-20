require('dotenv').config()

const path = require('path')

const ServiceClient = require('@slechtaj/service-client')
const debug = require('debug')('caller')

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

			if (demo === 'chat')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/chat', (client) => {
					const chat = new ChatClient(client, () => {
						client.close()
						sc.close()
					})
					// run long-lived bidi-stream rpc
					chat.start()
				})

			if (demo === 'file-share')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', async (client) => {
					const fsc = new FileShareClient(client)
					await fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
					client.close()
					sc.close()
				})

			if (demo === 'file-share-non-await-spam') {
				// eslint-disable-next-line no-constant-condition
				if (false) {
					// Don't do this! It will still work, but we might end up with multiple
					// channels which will be very resource intensive.
					for (let i = 0; i < 100; i++) {
						sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', async (client) => {
							const fsc = new FileShareClient(client)
							await fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
						})
					}
				}
				// Instead reuse the channel like this:
				sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', async (client) => {
					const fsc = new FileShareClient(client)
					for (let i = 0; i < 100; i++) {
						await fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
					}
					client.close()
					sc.close()
				})
			}

			if (demo === 'poi')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/poi', async (client) => {
					await poiClient(client) // run the popular grpc demo
					client.close()
					sc.close()
				})

			if (demo === 'lb-round-robin')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', async (client) => {
					// run multiple callee instances and let the load balancer distribute the requests
					const fsc = new FileShareClient(client)
					for (let i = 0; i < 50; i++) {
						await fsc.sendFile(path.join(__dirname, 'caller.js'))
						await new Promise((resolve) => setTimeout(resolve, 500)) // so we can "see" the LB in action
					}
					client.close()
					sc.close()
				})

			if (demo === 'proxy')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/simple_proxy', async (client) => {
					const path = '/slechtaj-1.0.0/dev~service_route/simple_server'

					const request = 'AABBCCDDEEFFGGHHIIJJ'

					const response = await proxyClient(client, path, request)

					console.log(`[caller] | demo | response: ${response.join(' ')}`)
					client.close()
					sc.close()
				})

			if (demo === 'proxy-cancel-propagation')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/simple_proxy', async (client) => {
					const path = '/slechtaj-1.0.0/dev~service_route/simple_server'

					const request = 'AABBCCDDEEFFGGHHIIJJ'

					const response = await proxyClient(client, path, request, {
						onCall: (call) => {
							setTimeout(() => {
								console.log('[caller] | demo | cancelling call | call.cancel() after 3s')
								call.cancel()
							}, 3000)
						},
					})
					console.log(`[caller] | demo | response: ${response}`)
					client.close()
					sc.close()
				})

			if (demo === 'proxy-deadline-propagation')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/simple_proxy', async (client) => {
					const path = '/slechtaj-1.0.0/dev~service_route/simple_server'

					const request = 'AABBCCDDEEFFGGHHIIJJ'

					const response = await proxyClient(client, path, request, {}, { deadline: new Date().getTime() + 5000 })
					console.log(`[caller] | demo | response: ${response}`)
					client.close()
					sc.close()
				})
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
		console.error('Unexpected error:')
		console.error(error)
	}
}

module.exports = caller

if (require.main === module) {
	caller()
}
