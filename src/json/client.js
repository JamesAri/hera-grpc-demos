const { promisify } = require('util')

const notepack = require('notepack.io')

module.exports = class JsonClient {
	constructor(stub) {
		this.stub = stub
		this.stub.jsonRpc = promisify(this.stub.jsonRpc)
	}

	async json(data) {
		const res = await this.stub.jsonRpc({ data: notepack.encode(data) })
		const resData = notepack.decode(res.data)
		console.log(resData)
		return resData
	}
}
