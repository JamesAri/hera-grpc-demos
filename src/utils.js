const os = require('os')

const teardown = (halt) => {
	process.on('SIGTERM', (signal) => halt(null, signal))
	process.on('SIGINT', (signal) => halt(null, signal))
	process.on('unhandledRejection', (reason, promise) => halt(reason, promise))
	process.on('uncaughtException', (err) => {
		console.error('received uncaughtException.')
		console.error(err)
		process.exit(1)
	})
}

const getPublicInterface = function () {
	const object = os.networkInterfaces()

	for (const iface in object) {
		for (const addr of object[iface]) {
			if (addr.family === 'IPv4' && !addr.internal) {
				return addr.address
			}
		}
	}

	return null
}

module.exports = {
	teardown,
	getPublicInterface,
}
