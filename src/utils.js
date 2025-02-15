const teardown = (halt) => {
	process.on('SIGTERM', (signal) => halt(null, signal))
	process.on('SIGINT', (signal) => halt(null, signal))
	process.on('unhandledRejection', (reason, promise) => halt(reason, promise))
	process.on('uncaughtException', (err) => {
		console.error('Calee received uncaughtException.')
		console.error(err)
		process.exit(1)
	})
}

module.exports = {
	teardown,
}
