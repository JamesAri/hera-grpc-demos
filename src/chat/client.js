const crypto = require('crypto')
const readline = require('readline')

const { grpc } = require('@slechtaj/service-client')

const MESSAGE_TYPES = require('./message-types')

module.exports = class Chat {
	constructor(client, next) {
		this.start = this.start.bind(this)
		this._authenticate = this._authenticate.bind(this)
		this._prepareChatCli = this._prepareChatCli.bind(this)
		this._runChatRoom = this._runChatRoom.bind(this)

		this.username = process.argv[2] + crypto.randomBytes(4).toString('hex')

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		this.client = client
		this.stream = null
		this.next = next
	}

	start() {
		const metadata = new grpc.Metadata()
		metadata.add('x-client-id', this.username)
		this.stream = this.client.connectChat(metadata, { deadline: null })
		this._prepareChatCli()
		this._authenticate()
		this._runChatRoom()
	}

	_authenticate() {
		console.log(`Authenticating as ${this.username}`)
		this.stream.write({ type: MESSAGE_TYPES.AUTH, userName: this.username })
	}

	_prepareChatCli() {
		this.rl.setPrompt(`${this.username}: `)
		this.rl.prompt()

		this.rl.on('line', (message) => {
			this.rl.prompt() // Prompt again for the next message
			this.stream.write({ type: MESSAGE_TYPES.CHAT, content: message })
		})

		this.rl.once('close', () => {
			this.rl.setPrompt('')
		})

		this.rl.on('SIGINT', () => {
			if (this.stream) {
				this.stream.end()
			}
		})

		const originalConsoleLog = console.log
		console.log = (...args) => {
			this.rl.output.write('\x1B[2K\r') // Clear the current input line
			originalConsoleLog.apply(console, args) // Call the original console.log
			this.rl._refreshLine() // Repaint the prompt and current input
		}

		const originalConsoleError = console.error
		console.error = (...args) => {
			this.rl.output.write('\x1B[2K\r')
			originalConsoleError.apply(console, args)
			this.rl._refreshLine()
		}
	}

	_runChatRoom() {
		this.stream.on('data', (message) => {
			if (message.type === MESSAGE_TYPES.CHAT) {
				if (!message.content) return

				if (message.userName) {
					console.log(`${message.userName}: ${message.content}`)
				} else {
					console.log(message.content)
				}
				return
			}
			console.log('Error: unknown message type received:', message.type)
		})

		this.stream.on('end', () => {
			console.log('Server sent end event')
			this.stream.end()
		})

		this.stream.on('close', () => {
			console.log('Server sent close event - closing')
			this.client.close()
			this.next ? this.next() : process.exit()
		})

		this.stream.on('status', (status) => {
			// not for streams :) - Status of the call when it has completed.
			console.log('Received status:')
			console.log(status)
		})

		this.stream.on('error', (err /** ServiceError */) => {
			console.error('Error from server stream:', err.message)
			if (this.stream) {
				this.stream.end()
			}
		})
	}
}
