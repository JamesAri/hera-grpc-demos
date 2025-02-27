const { promisify } = require('util')

const notepack = require('notepack.io')

module.exports = class JsonClient {
	constructor(stub) {
		this.stub = stub
		this.stub.jsonRpc = promisify(this.stub.jsonRpc)
	}

	async json(data) {
		const _response = await this.stub.jsonRpc({ data: notepack.encode(data) })
		const response = notepack.decode(_response.data)
		console.log(response)
		return response
	}
}
