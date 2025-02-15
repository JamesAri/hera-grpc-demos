const path = require('path')
const debug = require('debug')('caller')

const ServiceClient = require('@slechtaj/service-client')
const config = require('./config')
const { teardown } = require('./utils')

// Implementation of the rpc for the service we want to call
const ChatClient = require('./chat/client')
const poiClient = require('./poi/client')
const FileShareClient = require('./file-share/client')

function caller() {
	const sc = new ServiceClient({config})

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

			false && await sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', async (client) => {
				const fsc = new FileShareClient(client)
				fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
			})

			false && await sc.callService('/slechtaj-1.0.0/dev~service_route/poi', async (client) => {
				await poiClient(client) // run all types of rpcs
			})

			await sc.callService('/slechtaj-1.0.0/dev~service_route/chat', (client) => {
				const chat = new ChatClient(client) // run long-lived bidi-stream rpc
				chat.start()
			})

			false && await sc.callService('/slechtaj-1.0.0/dev~deadline/propagation', (client) => {
				// TODO
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


if (require.main === module) {
	caller()
}
