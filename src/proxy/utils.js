const { Readable } = require('stream')

// Function to create a readable stream that emits chunks
function chunkStringStream(str, chunkSize) {
	let index = 0

	return new Readable({
		read() {
			if (index < str.length) {
				this.push(str.slice(index, index + chunkSize)) // Send chunk
				index += chunkSize
			} else {
				this.push(null) // End stream
			}
		},
		objectMode: true,
	})
}

module.exports = {
	chunkStringStream,
}
