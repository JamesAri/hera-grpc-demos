require('dotenv').config()

const path = require('path')

const ServiceClient = require('@slechtaj/service-client')
const debug = require('debug')('caller')

const ChatClient = require('./chat/client')
const config = require('./config')
const FileShareClient = require('./file-share/client')
const poiClient = require('./poi/client')
const { teardown } = require('./utils')

// Implementation of the rpc for the service we want to call

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
						sc.close()
					}) // run long-lived bidi-stream rpc
					chat.start()
				})

			if (demo === 'file-share')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', async (client) => {
					const fsc = new FileShareClient(client)
					await fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
					client.close()
				})

			if (demo === 'poi')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/poi', async (client) => {
					await poiClient(client) // run all types of rpcs
				})

			if (demo === 'lb-round-robin')
				await sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', async (client) => {
					// run multiple callee instances and let the load balancer distribute the requests
					const fsc = new FileShareClient(client)
					for (let i = 0; i < 50; i++) {
						await fsc.sendFile(path.join(__dirname, 'caller.js'))
						await new Promise((resolve) => setTimeout(resolve, 500))
					}
					client.close()
				})

			if (demo === 'deadline-propagation')
				await sc.callService('/slechtaj-1.0.0/dev~deadline/deadline_propagation', (client) => {
					// TODO
				})

			if (demo === 'cancel-propagation')
				await sc.callService('/slechtaj-1.0.0/dev~deadline/cancel_propagation', (client) => {
					// TODO
				})

			if (demo === 'parent-deadline-ignore')
				await sc.callService('/slechtaj-1.0.0/dev~deadline/parent_deadline_ignore', (client) => {
					// test nested call
					sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', async (client) => {
						const fsc = new FileShareClient(client)
						// test that setting deadline here won't affect it since it is
						// nested call which should honor the parent's deadline
						fsc.sendFile('/Users/jakubslechta/Desktop/test.txt', { deadline: 0 })
					})
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
