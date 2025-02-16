const fs = require('fs')
const path = require('path')

const {grpc} = require('@slechtaj/service-client')

module.exports = class ShareFileService {
	constructor(client) {
		this.client = client
	}

	sendFileWithoutClose(fileName, options) {
		return new Promise((resolve, reject) => {
			const metadata = new grpc.Metadata()
			metadata.add('x-file-name', path.basename(fileName))

			const call = this.client.downloadFile(metadata, options, (error, res) => {
				if (error) {
					reject(error)
					console.error('cb sendFile: Received server error: ', error.message)
					return
				}
				console.log({res})
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
				call.write({chunk})
			})
		})
	}

	sendFile(fileName, options = {}) {
		const metadata = new grpc.Metadata()
		metadata.add('x-file-name', path.basename(fileName))

		const close = () => {
			this.client.close()
		}

		const call = this.client.downloadFile(metadata, options, (error, res) => {
			close()
			if (error) {
				console.error('cb sendFile: Received server error: ', error.message)
				return
			}
			console.log({res})
		})
		const stream = fs.createReadStream(fileName)

		call.on('error', (error) => {
			console.error('call sendFile: Received server error: ', error)
			close()
		})
		stream.on('end', () => {
			console.log('createReadStream - END event')
			call.end()
			stream.close()
			stream.removeAllListeners()
		})
		stream.on('error', (error) => {
			console.log('createReadStream - ERROR event: ', error)
			close()
		})
		stream.on('data', (chunk) => {
			call.write({chunk})
		})
	}
}


