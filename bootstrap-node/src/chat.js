const Message = require('./message');

class Chat {
  /**
   * @param {Libp2p} libp2p A Libp2p node to communicate through
   * @param {string} topic The topic to subscribe to
   * @param {function(Message)} messageHandler Called with every `Message` received on `topic`
   */
  constructor(libp2p, topic, messageHandler) {
    this.libp2p = libp2p;
    this.topic = topic;
    this.messageHandler = messageHandler;
    this.userHandles = new Map([[libp2p.peerId.toB58String(), 'Me']]);

    this.connectedPeers = new Set();

    this.libp2p.connectionManager.on('peer:connect', connection => {
      if (this.connectedPeers.has(connection.remotePeer.toB58String())) return;
      this.connectedPeers.add(connection.remotePeer.toB58String());
      this.sendStats(Array.from(this.connectedPeers));
    });

    this.libp2p.connectionManager.on('peer:disconnect', connection => {
      if (this.connectedPeers.delete(connection.remotePeer.toB58String())) {
        this.sendStats(Array.from(this.connectedPeers));
      }
    });

    // Join if libp2p is already on
    if (this.libp2p.isStarted()) this.join();
  }

  /**
   * Handler that is run when `this.libp2p` starts
   */
  onStart() {
    this.join();
  }

  /**
   * Handler that is run when `this.libp2p` stops
   */
  onStop() {
    this.leave();
  }

  /**
   * Subscribes to `Chat.topic`. All messages will be
   * forwarded to `messageHandler`
   * @private
   */
  join() {
    this.libp2p.pubsub.subscribe(this.topic, payload => {
      try {
        const message = Message.fromPayload(payload);

        if (message.type === Message.Type.PATH) {
          this.messageHandler({ from: message.from, message: message.path });
          return;
        }

        if (message.type === Message.Type.UPDATE_PEER) {
          this.emit('peer:update', { from: message.from, name: message.name });
          console.info(`System: ${message.from} is now ${message.name}.`);
          this.userHandles.set(message.from, message.name);
          return;
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  /**
   * Unsubscribes from `Chat.topic`
   * @private
   */
  leave() {
    this.libp2p.pubsub.unsubscribe(this.topic);
  }

  // TODO: this will likely be removed or repurposed (CLI)
  /**
   * Crudely checks the input for a command. If no command is
   * found `false` is returned. If the input contains a command,
   * that command will be processed and `true` will be returned.
   * @param {Buffer|string} input Text submitted by the user
   * @returns {boolean} Whether or not there was a command
   */
  checkCommand(input) {
    const str = input.toString();
    if (str.startsWith('/')) {
      const args = str.slice(1).split(' ');
      switch (args[0]) {
        case 'name':
          this.updatePeer(args[1]);
          return true;
      }
    }
    return false;
  }

  /**
   * Informs the pubsub network of a name change.
   * @param {Buffer|string} name Username to change to
   */
  async updatePeer(name) {
    const { payload } = new Message(Message.Type.UPDATE_PEER, name);

    try {
      await this.libp2p.pubsub.publish(this.topic, payload);
    } catch (err) {
      console.error('Could not publish name change');
    }
  }

  /**
   * Sends the updated stats to the pubsub network
   * @param {Array<Buffer>} connectedPeers
   */
  async sendStats(connectedPeers) {
    const stats = { connectedPeers, nodeType: Message.NodeType.NODEJS };
    const { payload } = new Message(Message.Type.STATS, stats);

    try {
      await this.libp2p.pubsub.publish(this.topic, payload);
    } catch (err) {
      console.error('Could not publish stats update');
    }
  }

  /**
   * Publishes the given `path` to pubsub peers
   * @param {object} path The path to send
   */
  async sendPath(path) {
    const { payload } = new Message(Message.Type.PATH, path);

    try {
      await this.libp2p.pubsub.publish(this.topic, payload);
    } catch (err) {
      console.error('Could not publish path');
    }
  }
}

module.exports = Chat;
module.exports.TOPIC = '/libp2p/example/chat/1.0.0';
module.exports.CLEARLINE = '\033[1A';
