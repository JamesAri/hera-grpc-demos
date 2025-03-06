const fs = require('fs')
const path = require('path')

const { grpc } = require('hera-client')

module.exports = function sendFile(stub, fileName, options = {}) {
	return new Promise((resolve, reject) => {
		const metadata = new grpc.Metadata()
		metadata.add('x-file-name', path.basename(fileName))

		const call = stub.downloadFile(metadata, options, (error, res) => {
			if (error) {
				reject(error)
				console.error('cb sendFile: Received server error: ', error.message)
				return
			}
			console.log({ res })
			resolve()
		})
		const stream = fs.createReadStream(fileName)

		call.on('error', (error) => {
			console.error('call sendFile: Received server error: ', error)
		})
		stream.on('end', () => {
			console.log('createReadStream - END event')
			call.end()
			stream.close()
			stream.removeAllListeners()
		})
		stream.on('error', (error) => {
			console.log('createReadStream - ERROR event: ', error)
		})
		stream.on('data', (chunk) => {
			call.write({ chunk })
		})
	})
}
