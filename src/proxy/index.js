const { PassThrough } = require('node:stream')

const { grpc } = require('@slechtaj/service-client')

const { chunkStringStream } = require('./utils')

// client -> simple proxy -> simple stream -> simple proxy -> client

const options = {
	// test that setting deadline here won't affect it since it is
	// nested call which should honor the parent's deadline
	deadline: 0,
}

const processChunk = (chunk) => {
	// TODO: add "processing" delay
	if (!chunk) return chunk
	const { data } = chunk
	return { data: `pong: ${data}` }
}

/**
 * Send pong data
 */
function simpleServer(_sc, stream) {
	const xPing = stream.metadata.get('x-ping')[0]
	const metadata = new grpc.Metadata()
	metadata.add('x-pong', `pong: ${xPing}`)

	console.log('[server] | x-ping:', xPing)

	stream.sendMetadata(metadata)

	stream.on('cancelled', async () => {
		// When an RPC is cancelled, the server should stop any ongoing
		// computation and end its side of the stream.
		console.log('[server] | cancelled event -> ending stream')
		stream.end()
	})
	stream.on('error', async (error) => {
		// TODO: doesn't make sense to forward error
		console.error('[server] | error event from proxy -> ending stream:', error)
		stream.end(error)
	})
	stream.on('end', async () => {
		console.log('[server] | end event -> ending stream')
		stream.end()
	})
	stream.on('data', async (chunk) => {
		console.log('[server] | data event:', chunk)
		const out = processChunk(chunk)
		console.log('[server] | sending data:', out)
		stream.write(out)
	})
	stream.on('close', async () => {
		console.log('[server] | close event')
	})
}

// ↑
// bidi stream
// ↓

function simpleProxy(sc, proxyServerStream) {
	// TODO: pipe
	const pass = new PassThrough({
		highWaterMark: 1024 * 1024, // 1 MB
		objectMode: true,
	})

	proxyServerStream.on('cancelled', () => {
		console.log('[proxy] | cancelled event')
		// will automatically cancel nested stream
	})
	proxyServerStream.on('error', (error) => {
		console.error('[proxy] | error event from client:', error)
		// TODO: pass to nested stream? pipe to pass which will pipe to nested stream
	})
	proxyServerStream.on('end', (lastChunk) => {
		console.log('[proxy] | end event:', lastChunk)
		pass.end(lastChunk)
	})
	proxyServerStream.on('data', (chunk) => {
		console.log('[proxy] | data event:', chunk)
		pass.write(chunk)
	})
	proxyServerStream.on('close', () => {
		console.log('[proxy] | close event')
	})

	const path = proxyServerStream.metadata.get('x-service-path')[0]

	// nested call
	sc.callService(path, (client) => {
		const metadata = new grpc.Metadata()
		metadata.add('x-ping', proxyServerStream.metadata.get('x-ping')[0])

		const _metadata = new grpc.Metadata()

		const proxyClientStream = client.simpleServer(metadata, options)

		proxyClientStream.on('data', (chunk) => {
			console.log('[proxy] | nested call | data event:', chunk)
			console.log('[proxy] | nested call | passing data to client')
			proxyServerStream.write(chunk)
		})

		proxyClientStream.on('end', (lastChunk) => {
			console.log('[proxy] | nested call | end event:', lastChunk)
			// proxyServerStream.write(lastChunk) TODO
			console.log('[proxy] | nested call | ending client stream with trailing metadata:', _metadata)
			proxyServerStream.end(_metadata)
		})

		proxyClientStream.on('error', (error) => {
			console.error('[proxy] | nested call | error event from server:', error)
			proxyServerStream.emit('error', error)
		})

		proxyClientStream.on('close', () => {
			console.log('[proxy] | nested call | close event')
			// TODO: probably not needed
			// proxyServerStream.end({
			// 	code: grpc.status.OK,
			// 	message: '[!] trying if works',
			// })
		})

		proxyClientStream.on('metadata', (metadata) => {
			console.log('[proxy] | nested call | metadata event', metadata)
			_metadata.add('x-pong', metadata.get('x-pong')[0])
		})

		// Status of the call when it has completed.
		proxyClientStream.on('status', (status) => {
			console.log('[proxy] | nested call | status event:', status)
			if (status.code !== grpc.status.OK) {
				proxyServerStream.emit('error', status)
			}
		})

		// pass.pipe(proxyClientStream)
		pass.on('data', (chunk) => {
			console.log('[proxy] | nested | pass | data event | passing chunk:', chunk)
			proxyClientStream.write(chunk)
		})

		pass.on('end', (lastChunk) => {
			console.log('[proxy] | nested | pass | end event')
			if (lastChunk) {
				console.log('[proxy] | nested | pass | end event | passing last chunk:', lastChunk)
				proxyClientStream.write(lastChunk)
			}
			proxyClientStream.end()
		})
	})
}

// ↑
// bidi stream
// ↓

const clientFn = (
	client, // grpc client
	path, // path for proxy to know which service call
	request,
	{ onData, onError, onEnd, onMetadata, onStatus, onclose: onClose },
	options, // options for proxy call
) => {
	return new Promise((resolve, reject) => {
		const metadata = new grpc.Metadata()
		metadata.add('x-service-path', path)
		metadata.add('x-ping', 'ping')

		const call = client.simpleProxy(metadata, options)

		let response = ''

		call.on('status', async (status) => {
			console.log('[client] | status event:', status)
			onStatus && (await onStatus(call, status))
		})
		call.on('metadata', async (metadata) => {
			console.log('[client] | metadata event:', metadata)
			const xPong = metadata.get('x-pong')[0]
			console.log('metadata pong:', xPong)
			onMetadata && (await onMetadata(call, metadata))
		})
		call.on('error', async (error) => {
			console.error('[client] | error event from proxy:', error)
			onError && (await onError(call, error))
			reject(error)
		})
		call.on('end', async () => {
			console.log('[client] | end event')
			onEnd && (await onEnd(call))
		})
		call.on('data', async (chunk) => {
			console.log('[client] | data event:', chunk)
			response += chunk.data
			onData && (await onData(call, chunk))
		})
		call.on('close', async () => {
			console.log('[client] | close event')
			onClose && (await onClose(call))
			resolve(response)
		})

		const chunkedData = chunkStringStream(request, 2)

		chunkedData.on('data', (stringChunk) => {
			console.log('[client] | sending data:', stringChunk)
			call.write({ data: stringChunk })
		})

		chunkedData.on('end', (lastStringChunk) => {
			console.log('[client] | sending end')
			if (lastStringChunk) {
				console.log('[client] | sending last chunk:', lastStringChunk)
				call.write({ data: lastStringChunk })
			}
			call.end()
		})
	})
}

module.exports = {
	simpleProxyHandler: { simpleProxy },
	simpleServerHandler: { simpleServer },
	client: clientFn,
}
