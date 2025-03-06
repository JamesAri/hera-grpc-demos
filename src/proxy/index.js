const { PassThrough } = require('node:stream')

const { grpc } = require('hera-client')

const { chunkStringStream } = require('./utils')

// client -> simple proxy -> simple stream -> simple proxy -> client

// Class to simulate some work
class WorkPool {
	constructor(call) {
		this.timeouts = []
		this.call = call
	}

	_removeWorker(timeout) {
		const index = this.timeouts.indexOf(timeout)
		if (index !== -1) {
			this.timeouts.splice(index, 1)
		}
	}

	isDone() {
		return this.timeouts.length === 0
	}

	processChunk(chunk) {
		if (!chunk) return

		const delay = Math.random() * 10000

		console.log(`processing... worker will finish in ${delay}ms`)

		const timeout = setTimeout(() => {
			console.log('processing finished!')

			this._removeWorker(timeout)

			if (this.call.cancelled) return

			const response = { data: `pong: ${chunk.data}` }

			console.log('[server] | sending data:', response)

			this.call.write(response)

			if (this.isDone()) {
				console.log('[server] | all work done | ending stream')
				this.call.end()
			}
		}, delay)

		this.timeouts.push(timeout)
	}

	cancel() {
		this.timeouts.forEach((timeout) => {
			console.log('canceling work...')
			clearTimeout(timeout)
		})
		this.timeouts = []
	}
}

/**
 * Send pong data
 */
function simpleServer(stream) {
	// "processing" work pool
	const workPool = new WorkPool(stream)

	const xPing = stream.metadata.get('x-ping')[0]
	const metadata = new grpc.Metadata()
	metadata.add('x-pong', `pong: ${xPing}`)

	console.log('[server] | x-ping:', xPing)

	// Note: we could pass metadata on error or end events (they would be included as trailers)
	stream.sendMetadata(metadata)

	stream.on('cancelled', () => {
		// When an RPC is cancelled, the server should stop any ongoing
		// computation and end its side of the stream.
		console.log('[server] | stream was cancelled | will stop all processing and end stream')
		workPool.cancel()
		stream.end()
	})
	stream.on('error', (error) => {
		console.error('[server] | error event from proxy -> ending stream with error', error.message)
		workPool.cancel()
		stream.end(error) // TODO: doesn't make sense to forward error
	})
	stream.on('end', () => {
		console.log('[server] | end event')
		if (workPool.isDone()) {
			console.log('[server] | all work done | ending stream')
			stream.end()
		}
	})
	stream.on('data', (chunk) => {
		console.log('[server] | data event:', chunk)
		workPool.processChunk(chunk)
	})
	stream.on('close', async () => {
		console.log('[server] | close event')
	})
}

// ↑
// bidi stream
// ↓

async function simpleProxy(proxyClientStream) {
	// proxyClientStream - bidirectional stream between client and proxy
	// proxyServerStream - bidirectional stream between proxy and server
	// pass - passThrough stream (buffer) to pass data between client and server

	const pass = new PassThrough({
		highWaterMark: 1024 * 1024, // 1 MB
		objectMode: true,
	})

	// client <-> proxy

	proxyClientStream.on('cancelled', () => {
		// will automatically cancel nested stream
		console.log('[proxy] | client stream | cancelled event -> auto cancel propagation to nested streams')
		pass.end()
		proxyClientStream.end()
	})
	proxyClientStream.on('error', (error) => {
		console.error('[proxy] | client stream | error event from client:', error.message)
		// TODO: pass to nested stream? pipe to pass which will pipe to nested stream
	})
	proxyClientStream.on('end', () => {
		console.log('[proxy] | client stream | end event')
		pass.end()
	})
	proxyClientStream.on('data', (chunk) => {
		console.log('[proxy] | client stream | data event:', chunk)
		pass.write(chunk)
	})
	proxyClientStream.on('close', () => {
		console.log('[proxy] | client stream | close event')
	})

	const path = proxyClientStream.metadata.get('x-service-path')[0]

	// nested server call
	// proxy <-> server
	const stub = await proxyClientStream.getStub(path)

	// getStub has retry mechanism, we could be late, so thats why we need to check if client
	// didn't cancel the stream before we got the stub
	if (proxyClientStream.cancelled) {
		console.log('[proxy] | client stream | client cancelled stream before calling server')
		return
	}

	const metadata = new grpc.Metadata()
	metadata.add('x-ping', proxyClientStream.metadata.get('x-ping')[0])
	metadata.setOptions({ waitForReady: false }) // let's not wait for server to be ready - just to showcase

	const proxiedMetadata = new grpc.Metadata()
	// test that setting deadline here won't affect it since it is
	// nested server call which should honor the parent's deadline.
	const proxyServerStream = stub.simpleServer(metadata, { deadline: 0 /** request Infinity */ })

	proxyServerStream.on('data', (chunk) => {
		console.log('[proxy] | server stream | data event -> sending to client:', chunk)
		proxyClientStream.write(chunk)
	})

	proxyServerStream.on('end', () => {
		console.log('[proxy] | server stream | end event | trailing metadata:', proxiedMetadata)
		proxyClientStream.end(proxiedMetadata)
	})

	proxyServerStream.on('error', (error) => {
		console.error('[proxy] | server stream | error event from server:', error.message)
		// Note: here we could:
		// 1) pass the proxiedMetadata with error (error.metadata = proxiedMetadata) if they reached us
		// 2) send custom metadata (with custom error message)
		// 3) send error as is, because server could pass metadata with error
		proxyClientStream.emit('error', error)
	})

	proxyServerStream.on('metadata', (metadata) => {
		console.log('[proxy] | server stream | headers metadata event', metadata)
		proxiedMetadata.add('x-pong', metadata.get('x-pong')[0])
		// NOTE: we could send the metadata in headers, but we will send them in end
		// just to showcase that we can send them in trailers.
	})

	proxyServerStream.on('close', () => {
		console.log('[proxy] | server stream | close event')
	})

	proxyServerStream.on('status', (status) => {
		// Status of the call when it has completed
		console.log('[proxy] | server stream | status event:', status)
	})

	// Pass data from client to server
	pass.on('data', (chunk) => {
		console.log('[proxy] | client stream | data event | passing chunk to server:', chunk)
		proxyServerStream.write(chunk)
	})

	// Client has finished sending data, we can signal end to the server
	pass.on('end', (lastChunk) => {
		console.log('[proxy] | client stream | end event -> sending end to server')
		if (lastChunk) {
			console.log('[proxy] | client stream | end event | passing last chunk to server:', lastChunk)
			proxyServerStream.write(lastChunk)
		}
		proxyServerStream.end()
	})
}

// ↑
// bidi stream
// ↓

const clientFn = (
	client, // grpc client
	path, // path for proxy to know which service to call
	request,
	{ onCall, onData, onError, onEnd, onMetadata, onStatus, onClose } = {},
	options = {}, // options for proxy call
) => {
	return new Promise((resolve, reject) => {
		const metadata = new grpc.Metadata()
		metadata.add('x-service-path', path)
		metadata.add('x-ping', 'ping')

		const call = client.simpleProxy(metadata, options)

		onCall && onCall(call)

		const response = []

		call.on('status', async (status) => {
			console.log('[client] | status event:', status)
			const xPong = status.metadata?.get('x-pong')[0]
			console.log('[client] | trailers metadata:', xPong)
			onStatus && (await onStatus(call, status))
		})
		call.on('metadata', async (metadata) => {
			console.log('[client] | headers metadata event:', metadata)
			onMetadata && (await onMetadata(call, metadata))
		})
		call.on('error', async (error) => {
			console.error('[client] | error event from proxy:', error.message)
			onError && (await onError(call, error))
			reject(error)
		})
		call.on('end', async () => {
			console.log('[client] | end event')
			onEnd && (await onEnd(call))
		})
		call.on('data', async (chunk) => {
			console.log('[client] | data event:', chunk)
			response.push(chunk.data)
			onData && (await onData(call, chunk))
		})
		call.on('close', async () => {
			console.log('[client] | close event')
			onClose && (await onClose(call))
			resolve(response)
		})

		const chunkedData = chunkStringStream(request, 2)

		chunkedData.on('data', (stringChunk) => {
			const req = { data: stringChunk }
			console.log('[client] | sending data:', req)
			call.write(req)
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
