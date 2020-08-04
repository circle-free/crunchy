'use strict';

import Message, { Type, NodeType } from './message';

const EventEmitter = require('events');

const TOPIC = 'graffiti/gossip/1.0.0';

class PubSub extends EventEmitter {
  /**
   * @param {Libp2p} libp2p A Libp2p node to communicate through
   * @param {string} topic The topic to subscribe to
   */
  constructor(libp2p) {
    super();

    this.libp2p = libp2p;
    this.topic = TOPIC;

    this.connectedPeers = new Set();
    this.stats = new Map();

    this.libp2p.connectionManager.on('peer:connect', connection => {
      console.log('Connected to', connection.remotePeer.toB58String());

      if (this.connectedPeers.has(connection.remotePeer.toB58String())) return;

      this.connectedPeers.add(connection.remotePeer.toB58String());
      this.sendStats(Array.from(this.connectedPeers));
    });

    this.libp2p.connectionManager.on('peer:disconnect', connection => {
      console.log('Disconnected from', connection.remotePeer.toB58String());

      if (this.connectedPeers.delete(connection.remotePeer.toB58String())) {
        this.sendStats(Array.from(this.connectedPeers));
      }
    });

    // Join if libp2p is already on
    if (this.libp2p.isStarted()) this.join();
  }

  /**
   * Subscribes to `graffiti/gossip`. All messages will emitted
   * @private
   */
  join() {
    this.libp2p.pubsub.subscribe(this.topic, payload => {
      try {
        const message = Message.fromPayload(payload);

        if (message.type === Type.PATH) {
          this.emit('path', { from: message.from, path: message.path });
          return;
        }

        if (message.type === Type.STATS) {
          // console.log('Incoming Stats:', message.from, message.stats);
          // TODO: why this?
          this.stats.set(message.from, message.stats);
          this.emit('stats', this.stats);
          return;
        }

        if (message.type === Type.UPDATE_PEER) {
          this.emit('peer:update', { from: message.from, name: message.name });
          return;
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  /**
   * Unsubscribes from `graffiti/gossip`
   * @private
   */
  leave() {
    this.libp2p.pubsub.unsubscribe(this.topic);
  }

  // TODO: this will likely be removed
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
        default:
          return false;
      }
    }

    return false;
  }

  /**
   * Informs the pubsub network of a name change.
   * @param {Buffer|string} name Username to change to
   */
  async updatePeer(name) {
    const { payload } = new Message(Type.UPDATE_PEER, name);

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
    const stats = { connectedPeers, nodeType: NodeType.BROWSER };
    const { payload } = new Message(Type.STATS, stats);

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
    const { payload } = new Message(Type.PATH, path);

    try {
      await this.libp2p.pubsub.publish(this.topic, payload);
    } catch (err) {
      console.error('Could not publish path');
    }
  }
}

export default PubSub;
