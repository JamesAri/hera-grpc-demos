const notepack = require('notepack.io')

function jsonRpc(_remote, call, callback) {
	const req = notepack.decode(call.request.data)

	console.log({ req })

	const json = (data) => {
		callback(null, { data: notepack.encode(data) })
	}

	const error = (message) => {
		callback(message)
	}

	const res = {
		json: json,
		error: error,
	}

	json({ status: 200, hello: 'world' })
}

module.exports = {
	jsonRpc,
}
