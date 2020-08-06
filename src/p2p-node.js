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
import GraphDatastore from './graph-store';

// Protocol Handlers
import GraffitiGossip from './graffiti-gossip-protocol';
import GraffitiDirect from './graffiti-direct-protocol';

// Peer id
import getOrCreatePeerId from './peer-id';

// DAG
import { Graph, json as jsonGraph, alg } from '@dagrejs/graphlib';

const EventEmitter = require('events');

const DAG_START = 'DAG_START';
const MAX_PREDECESSORS = 3;
const DAG_STORE_KEY = 'DAG_STORE_KEY';

const getPredecessors = graph => {
  const sinkIds = graph.sinks();
  const remaining = Math.max(MAX_PREDECESSORS - sinkIds.length, 0);
  const additionalPredecessorIds = remaining ? sinkIds.flatMap(id => graph.predecessors(id)) : [];
  const predecessorIds = sinkIds.concat(additionalPredecessorIds);

  return predecessorIds.filter((id, i, arr) => arr.indexOf(id) === i).slice(0, MAX_PREDECESSORS);
};

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
  return graph.nodes().filter(id => graph.node(id) && id !== DAG_START);
};

const getPathsNotInList = graph => ids => {
  const idSet = new Set(ids);

  return graph
    .nodes()
    .filter(id => !idSet.has(id) && id !== DAG_START)
    .map(id => {
      const data = graph.node(id);
      const predecessorIds = graph.predecessors(id);

      return { id, data, predecessorIds };
    });
};

const getOrderedPaths = graph => {
  return alg
    .topsort(graph)
    .filter(id => id !== DAG_START)
    .map(id => {
      const data = graph.node(id);
      const predecessorIds = graph.predecessors(id);

      return { id, data, predecessorIds };
    });
};

class Node extends EventEmitter {
  constructor() {
    super();

    this.pathDataStore = new LocalDatastore('graffitiPaths');
    this.nodeDataStore = new LocalDatastore('graffitiNode');
    this.graphDataStore = new GraphDatastore(this.graph);

    this.storeDebounceTimer = null;
  }

  async start() {
    this.graph = await this.pathDataStore
      .has(DAG_STORE_KEY)
      .then(hasStore => (hasStore ? this.pathDataStore.get(DAG_STORE_KEY) : null))
      .then(sGraph => (sGraph ? jsonGraph.read(sGraph) : new Graph({ directed: true }).setNode(DAG_START)));

    this.peerId = await getOrCreatePeerId();

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

    // Create direct protocol manager here
    this.graffitiDirect = new GraffitiDirect(this.libp2p);

    // Listen for paths from Direct
    this.graffitiDirect.on('path', ({ from, path }) => this.receivePath(from, path));

    // Handle graffiti direct communication requests from peers
    this.libp2p.handle(this.graffitiDirect.PROTOCOL, this.graffitiDirect.handleWith(getPathsNotInList(this.graph)));

    this.libp2p.peerStore.on('change:protocols', async ({ peerId, protocols }) => {
      if (!protocols.includes(this.graffitiDirect.PROTOCOL)) return;

      const connection = this.libp2p.connectionManager.get(peerId);
      const idsWeHave = getCompletePathIdsFromGraph(this.graph);
      this.graffitiDirect.tryGetFromPeer(connection, idsWeHave);
    });

    await this.libp2p.start();

    this.graffitiGossip.join();

    return getOrderedPaths(this.graph);
  }

  async savePaths() {
    console.info('Saving DAG to data store.');
    return this.pathDataStore.put(DAG_STORE_KEY, jsonGraph.write(this.graph));
  }

  async receivePath(from, path) {
    const { id, data, predecessorIds = [] } = path;

    if (this.storeDebounceTimer) {
      clearTimeout(this.storeDebounceTimer);
    }

    this.storeDebounceTimer = setTimeout(() => this.savePaths(), 5000);

    const isMine = from === this.libp2p.peerId.toB58String();
    console.info(`Received path ${id} from ${isMine ? 'self' : from} with ${predecessorIds.length} predecessors.`);

    // TODO: validate here
    // TODO: do something with unknownIds (prune?, ignore?, fetch?)
    const { predIds } = addTheirPathToGraph(this.graph, { id, data, predecessorIds });

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
