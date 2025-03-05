const { grpc } = require('@slechtaj/service-client')
const debug = require('debug')('user-client-interceptor')

module.exports = class TestClientInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.start = this.start.bind(this)
	}

	start(metadata, listener, next) {
		debug('before:', metadata)
		// TODO: remove - demonstrate in postman
		metadata.set('some-client-meta', 'SOME_CLIENT_META')
		debug('after:', metadata)
		next(metadata, listener)
	}

	/**
	 * grpc.Interceptor
	 * @param {*} options
	 * @param {*} nextCall
	 * @returns {grpc.InterceptingCall}
	 */
	interceptor(options, nextCall) {
		debug(options?.method_definition?.path)

		this.options = options
		this.nextCall = nextCall

		// prettier-ignore
		this.requester = (new grpc.RequesterBuilder())
			.withStart(this.start)
			.build()
		return new grpc.InterceptingCall(nextCall(this.options), this.requester)
	}
}
