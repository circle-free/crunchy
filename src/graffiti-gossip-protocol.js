'use strict';

import Message, { MessageType } from './message';

const EventEmitter = require('events');

class PubSub extends EventEmitter {
  TOPIC = 'graffiti/gossip/1.0.0';
  
  constructor(pubsub) {
    super();

    this.pubsub = pubsub;
    this.subscribers = new Set();
  }

  join() {
    this.pubsub.subscribe(this.TOPIC, payload => {
      this.pubsub.getSubscribers(this.TOPIC).forEach(peerStringId => {
        if (this.subscribers.has(peerStringId)) return;

        this.subscribers.add(peerStringId);

        // TODO: send subscriber sync_req
      });

      try {
        const message = Message.fromPayload(payload);

        if (message.type === MessageType.PATH) {
          this.emit('path', { from: message.from, path: message.path });
          return;
        }

        if (message.type === MessageType.UPDATE_PEER) {
          this.emit('peer:update', { from: message.from, name: message.name });
          return;
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  leave() {
    this.pubsub.unsubscribe(this.TOPIC);
  }

  async updatePeer(name) {
    const { payload } = new Message(MessageType.UPDATE_PEER, name);

    try {
      await this.pubsub.publish(this.TOPIC, payload);
    } catch (err) {
      console.error('Could not publish name change');
    }
  }

  async sendPath(path) {
    const { payload } = new Message(MessageType.PATH, path);

    try {
      await this.pubsub.publish(this.TOPIC, payload);
    } catch (err) {
      console.error('Could not publish path');
    }
  }
}

export default PubSub;
