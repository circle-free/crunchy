// Libp2p Core
import Libp2p from 'libp2p';

// Transports
import Websockets from 'libp2p-websockets';
import WebrtcStar from 'libp2p-webrtc-star';

// Stream Muxer
import Mplex from 'libp2p-mplex';

// Connection Encryption
import { NOISE } from 'libp2p-noise';
import Secio from 'libp2p-secio';

// Peer Discovery
import Bootstrap from 'libp2p-bootstrap';
import KadDHT from 'libp2p-kad-dht';

// Gossipsub
import Gossipsub from 'libp2p-gossipsub';

// Datastore
import Datastore from './data-store';

// Protocol Handlers
import GraffitiGossip from './graffiti-gossip-protocol';
import GraffitiDirect from './graffiti-direct-protocol';

// Peer id
import getOrCreatePeerId from './peer-id';

const EventEmitter = require('events');
const textDecoder = new TextDecoder('utf-8');

class Node extends EventEmitter {
  constructor() {
    super();
  }

  async start() {
    // get peer id here
    this.peerId = await getOrCreatePeerId();

    // datastores here
    const pathDataStore = new Datastore('graffitiPaths');
    const nodeDataStore = new Datastore('graffitiNode');

    // Create the Node
    this.libp2p = await Libp2p.create({
      peerId: this.peerId,
      addresses: {
        listen: ['/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star'],
      },
      modules: {
        transport: [Websockets, WebrtcStar],
        streamMuxer: [Mplex],
        connEncryption: [NOISE, Secio],
        peerDiscovery: [Bootstrap],
        dht: KadDHT,
        pubsub: Gossipsub,
      },
      datastore: nodeDataStore,
      peerStore: {
        persistence: true,
        threshold: 1,
      },
      config: {
        peerDiscovery: {
          bootstrap: {
            list: ['/dns4/sjc-1.bootstrap.libp2p.io/tcp/443/wss/ipfs/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN'],
          },
        },
        dht: {
          enabled: true,
          randomWalk: {
            enabled: true,
          },
        },
      },
    });

    // Create gossip protocol manager here
    this.graffitiGossip = new GraffitiGossip(this.libp2p.pubsub);

    // Listen for paths from Gossip
    this.graffitiGossip.on('path', ({ from, path }) => {
      const { id, data, prevId } = path;

      const isMine = from === this.libp2p.peerId.toB58String();
      console.info(`${from}${isMine ? ' (self)' : ''} created path ${id} on ${prevId}.`);

      // TODO: validate path here or in graffitiGossip?
      pathDataStore.put(id, { data, prevId });
      this.emit('path', path);
    });

    // Listen for peer updates
    this.graffitiGossip.on('peer:update', ({ from, name }) => {
      console.info(`${from} is now known as ${name}.`);

      // TODO: consider having all the paths embed the peer name
      // setPeers(peers => {
      //   const newPeers = { ...peers };
      //   newPeers[id] = { name };
      //   return newPeers;
      // });
    });

    // TODO: on stats do something with stats
    this.graffitiGossip.on('stats', stats => {});

    // Create direct protocol manager here
    this.graffitiDirect = new GraffitiDirect(this.libp2p);

    // Listen for paths from Direct
    this.graffitiDirect.on('path', ({ from, path }) => {
      const { id, data, prevId } = path;

      const isMine = from === this.libp2p.peerId.toB58String();
      console.info(`${from}${isMine ? ' (self)' : ''} created path ${id} on ${prevId}.`);

      // TODO: validate path here or in graffitiGossip?
      pathDataStore.put(id, { data, prevId });
      this.emit('path', path);
    });

    this.libp2p.handle(this.graffitiDirect.PROTOCOL, this.graffitiDirect.handleWith(pathDataStore));

    // this.libp2p.on('peer:discovery', peerId => {
    //   console.log(`Discovered ${peerId.toB58String()}.`);
    // });

    // this.libp2p.peerStore.on('peer', peerId => {
    //   console.log(`Connected to ${peerId.toB58String()}. Currently ${this.libp2p.peerStore.peers.size} in store.`);
    // });

    this.libp2p.peerStore.on('change:protocols', ({ peerId, protocols }) => {
      if (!protocols.includes(this.graffitiDirect.PROTOCOL)) return;

      const connection = this.libp2p.connectionManager.get(peerId);
      this.graffitiDirect.tryGetFromPeer(connection, pathDataStore);
    });

    // this.libp2p.connectionManager.on('peer:connect', connection => {
    //   const peerId = connection.remotePeer.toB58String();
    //   console.log('Connected to', peerId);
    //   this.graffitiDirect.tryGetFromPeer(connection, pathDataStore);
    // });

    // this.libp2p.connectionManager.on('peer:disconnect', connection => {
    //   console.log('Disconnected from', connection.remotePeer.toB58String());
    // });


    // start libp2p
    await this.libp2p.start();

    this.graffitiGossip.join();

    return (await pathDataStore.all()).map(({ key, value }) => ({
      id: key,
      data: value.data,
      prevId: value.prevId
    }));
  }

  async broadcastPath(path) {
    try {
      console.info('Broadcasting path.');
      await this.graffitiGossip.sendPath(path);
      console.info('Path broadcasted.');
    } catch (err) {
      console.error('Failed to broadcast path.');
      console.error(err);
    }
  }
}

export default Node;
