import Message, { MessageType } from './message';

const pipe = require('it-pipe');

const textDecoder = new TextDecoder('utf-8');

const EventEmitter = require('events');

const onSyncReqGeneratorWith = (connection, store) => source =>
  (async function* () {
    const peerId = connection.remotePeer.toB58String();

    for await (const message of source) {
      const { type, ids } = Message.fromPayload({ from: peerId, data: message._bufs[0] });

      if (type !== MessageType.SYNC_REQUEST) return;

      console.info(`Received a sync request from ${peerId}.`);

      const idSet = new Set(ids);
      const keyValuePairs = (await store.all()).filter(({ key }) => !idSet.has(key));
      const paths = keyValuePairs.map(({ key, value }) => ({ id: key, data: value.data, prevId: value.prevId }));

      console.info(`Sending ${paths.length} paths to ${peerId}`);

      for (const path of paths) {
        const { payload } = new Message(MessageType.PATH, path);
        yield payload;
      }
    }
  })();

class DirectMessaging extends EventEmitter {
  PROTOCOL = 'graffiti/direct/1.0.0';
  
  constructor(libp2p) {
    super();

    this.libp2p = libp2p;
  }

  handleWith(store) {
    return ({ connection, stream }) =>
      pipe(stream, onSyncReqGeneratorWith(connection, store), stream).catch(console.error);
  }

  sendSyncRequest({ stream, ids = [], cb }) {
    const { payload } = new Message(MessageType.SYNC_REQUEST, ids);

    let pathCount = 0;

    return pipe([payload], stream, async source => {
      for await (const message of source) {
        const { type, path } = Message.fromPayload({ data: message._bufs[0] });

        if (type !== MessageType.PATH) return;

        pathCount++;
        cb(path);
      }

      console.info(`Received ${pathCount} paths back from sync request.`);
    }).catch(console.error);
  }

  tryGetFromPeer(connection, store) {
    const peerId = connection.remotePeer.toB58String();
    console.info(`Sending sync request to ${peerId}`);
    const cb = path => this.emit('path', { from: peerId, path });

    Promise.all([connection.newStream([this.PROTOCOL]), store.keys()])
      .then(([{ stream }, ids]) => this.sendSyncRequest({ stream, ids, cb }))
      .catch(console.error);
  }
}

export default DirectMessaging;

// const peer = await libp2p.peerRouting.findPeer(peerId, options)

// libp2p.connectionManager.get(peerId)

// const peerIdStrings = libp2p.metrics.peers

// const protocols = libp2p.metrics.protocols

// const peerStats = libp2p.metrics.forPeer(peerId)
// console.log(peerStats.toJSON())

// const peerStats = libp2p.metrics.forProtocol('/meshsub/1.0.0')
// console.log(peerStats.toJSON())