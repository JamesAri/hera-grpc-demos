const debug = require('debug')('user-server-interceptor')
const { grpc } = require('hera-grpc')

module.exports = class TestServerInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.onReceiveMetadata = this.onReceiveMetadata.bind(this)
		this.start = this.start.bind(this)
	}

	onReceiveMetadata(metadata, next) {
		debug('before:', metadata)
		metadata.set('some-server-meta', 'SOME_SERVER_META')
		debug('after:', metadata)
		next(metadata)
	}

	start(next) {
		return next(this.listener)
	}

	/**
	 * grpc.ServerInterceptor
	 * @returns {grpc.ServerInterceptingCall}
	 */
	interceptor(methodDescriptor, nextCall) {
		debug(methodDescriptor.path)
		debug(`client peer: ${nextCall.getPeer && nextCall.getPeer()}`)

		this.methodDescriptor = methodDescriptor
		this.nextCall = nextCall

		// prettier-ignore
		this.listener = (new grpc.ServerListenerBuilder())
			.withOnReceiveMetadata(this.onReceiveMetadata)
			.build()

		// prettier-ignore
		this.responder = (new grpc.ResponderBuilder())
			.withStart(this.start)
			.build()

		return new grpc.ServerInterceptingCall(this.nextCall, this.responder)
	}
}
