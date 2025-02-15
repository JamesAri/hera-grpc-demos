const fs = require('fs')
const path = require('path')
const { Transform } = require('node:stream')

const {grpc} = require('@slechtaj/service-client')

const transformToGrpcMessage = new Transform({
	objectMode: true,
	transform(chunk, _encoding, callback) {
		callback(null, {chunk})
	}
})

module.exports = class ShareFileService {
	constructor(client) {
		this.client = client
	}

	sendFile(fileName, options = {}) {
		const metadata = new grpc.Metadata()
		metadata.add('x-file-name', path.basename(fileName))
		const call = this.client.downloadFile(metadata, options, (error, res) => {
			this.client.close()
			if (error) {
				console.log('Received server error: ', error)
				return
			}
			console.log({res})
		})
		const stream = fs.createReadStream(fileName)
		stream.on('end', () => {
			this.client.close() // pipe will also send close - testing it
			console.log('createReadStream - END event')
		})
		stream.on('error', (error) => {
			this.client.close()
			console.log('createReadStream - ERROR event: ', error)
		})
		stream.pipe(transformToGrpcMessage).pipe(call)
	}
}


