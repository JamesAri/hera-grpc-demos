const notepack = require('notepack.io')

function jsonRpc(call, callback) {
	const req = notepack.decode(call.request.data)

	console.log({ req })

	const json = (data) => {
		callback(null, { data: notepack.encode(data) })
	}

	json({ status: 200, hello: 'world' })
}

module.exports = {
	jsonRpc,
}
