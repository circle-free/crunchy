import Message, { MessageType } from './message';

const pipe = require('it-pipe');

const EventEmitter = require('events');

const onSyncReqGeneratorWith = (connection, getPathsNotInList) => source =>
  (async function* () {
    const peerId = connection.remotePeer.toB58String();

    // TODO: also send known wallIds

    for await (const message of source) {
      const { type, wallId, ids } = Message.fromPayload({ from: peerId, data: message._bufs[0] });

      if (type !== MessageType.PATH_SYNC_REQUEST) return;

      console.info(`Received a sync request from ${peerId} for wall ${wallId}.`);

      const paths = getPathsNotInList(wallId, ids);

      console.info(`Sending ${paths.length} paths to ${peerId} for wall ${wallId}`);

      for (const path of paths) {
        const { id, data, predecessorIds } = path;
        const { payload } = new Message(MessageType.PATH, { wallId, id, data, predecessorIds });
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

  handleWith(getPathsNotInList) {
    return ({ connection, stream }) => pipe(stream, onSyncReqGeneratorWith(connection, getPathsNotInList), stream).catch(console.error);
  }

  sendSyncRequest({ stream, wallId, idsWeHave = [], cb }) {
    const { payload } = new Message(MessageType.PATH_SYNC_REQUEST, { wallId, ids: idsWeHave });

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

  tryGetFromPeer(connection, { wallId, idsWeHave }) {
    const peerId = connection.remotePeer.toB58String();
    console.info(`Sending sync request to ${peerId}. Current wall ${wallId}.`);

    const cb = path => this.emit('path', { from: peerId, path });

    return connection
      .newStream([this.PROTOCOL])
      .then(({ stream }) => this.sendSyncRequest({ stream, wallId, idsWeHave, cb }))
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
