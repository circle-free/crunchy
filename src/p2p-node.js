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

// Datastores
import LocalDatastore from './data-store';
import GraphDatastore from './data-store';

// Protocol Handlers
import GraffitiGossip from './graffiti-gossip-protocol';
import GraffitiDirect from './graffiti-direct-protocol';

// Peer id
import getOrCreatePeerId from './peer-id';

// DAG
import { Graph } from '@dagrejs/graphlib';

const EventEmitter = require('events');

const DAG_START = 'START';
const MAX_PREDECESSORS = 3;

const getPredecessors = graph => {
  const sinkIds = graph.sinks();
  const remaining = Math.max(MAX_PREDECESSORS - sinkIds.length, 0);
  const additionalPredecessorIds = remaining ? sinkIds.flatMap(id => graph.predecessors(id)) : [];
  const predecessorIds = sinkIds.concat(additionalPredecessorIds);
  
  return predecessorIds.filter((id, i, arr) => arr.indexOf(id) === i).slice(0, MAX_PREDECESSORS);
}

const addOurPathToGraph = (graph, { id, data }) => {
    if (graph.hasNode(id)) return {};

    const predecessorIds = getPredecessors(graph);

    graph.setNode(id, data);

    predecessorIds.forEach(predecessorId => {
      graph.setEdge(predecessorId, id);
    });

    return { predecessorIds };
};

const addTheirPathToGraph = (graph, { id, data, predecessorIds = [] }) => {
  if (graph.hasNode(id)) return { predIds: predecessorIds };
  
  const newPredecessorIds = getPredecessors(graph);

  graph.setNode(id, data);

  const predIds = predecessorIds.concat(newPredecessorIds).filter((id, i, arr) => arr.indexOf(id) === i);

  const unknownIds = predIds.reduce((unknowns, predecessorId) => {
    const hasNode = graph.hasNode(predecessorId);
    graph.setEdge(predecessorId, id);
    return hasNode ? unknowns : unknowns.concat[predecessorId];
  }, []);

  return { predIds, unknownIds };
};

const getCompletePathIdsFromGraph = graph => {
  return this.graph.nodes().filter(id => this.graph.node(id));
};

class Node extends EventEmitter {
  constructor() {
    super();
    this.graph = new Graph({ directed: true });
    this.graph.setNode(DAG_START);

    // datastores here
    this.pathDataStore = new LocalDatastore('graffitiPaths');
    this.nodeDataStore = new LocalDatastore('graffitiNode');
    this.graphDataStore = new GraphDatastore(this.graph);

    // TODO: move this to constructor and build graph instead
    // return (await pathDataStore.all()).map(({ key, value }) => ({
    //   id: key,
    //   data: value.data,
    //   prevId: value.prevId
    // }));
  }

  async start() {
    // get peer id here
    this.peerId = await getOrCreatePeerId();

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
      datastore: this.nodeDataStore,
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
    this.graffitiGossip.on('path', ({ from, path }) => this.receivePath(from, path));

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
    this.graffitiDirect.on('path', ({ from, path }) => this.receivePath(from, path));

    this.libp2p.handle(this.graffitiDirect.PROTOCOL, this.graffitiDirect.handleWith(this.graphDataStore));

    // this.libp2p.on('peer:discovery', peerId => {
    //   console.log(`Discovered ${peerId.toB58String()}.`);
    // });

    // this.libp2p.peerStore.on('peer', peerId => {
    //   console.log(`Connected to ${peerId.toB58String()}. Currently ${this.libp2p.peerStore.peers.size} in store.`);
    // });

    this.libp2p.peerStore.on('change:protocols', ({ peerId, protocols }) => {
      if (!protocols.includes(this.graffitiDirect.PROTOCOL)) return;

      console.log('hello');

      const connection = this.libp2p.connectionManager.get(peerId);
      const idsWeHave = getCompletePathIdsFromGraph(this.graph);
      this.graffitiDirect.tryGetFromPeer(connection, idsWeHave);
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
  }

  async receivePath(from, path) {
    const { id, data, predecessorIds } = path;

    const isMine = from === this.libp2p.peerId.toB58String();
    console.info(`Path ${id} from ${isMine ? 'self' : from} has ${predecessorIds.length} predecessors.`);

    // TODO: validate here
    console.info('Adding path to local DAG.');
    // TODO: do something with unknownIds (prune?, ignore?, fetch?)
    const { predIds, unknownIds } = addTheirPathToGraph(this.graph, { id, data, predecessorIds });

    // this.pathDataStore.put(id, { data, predecessorIds });
    this.emit('path', { id, data, predecessorIds: predIds });
  }

  async broadcastPath({ id, data }) {
    console.info('Adding path to local DAG.');
    const result = addOurPathToGraph(this.graph, { id, data });

    if (!result) return false;

    const { predecessorIds } = result;

    try {
      console.info('Broadcasting path.');
      await this.graffitiGossip.sendPath({ id, data, predecessorIds });
      console.info('Path broadcasted.');

      return true;
    } catch (err) {
      console.error('Failed to broadcast path.');
      console.error(err);

      return false;
    }
  }
}

export default Node;
