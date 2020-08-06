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

// Protocol Handlers
import GraffitiGossip from './graffiti-gossip-protocol';
import GraffitiDirect from './graffiti-direct-protocol';

// Peer id
import getOrCreatePeerId from './peer-id';

// DAG
import { Graph, json as jsonGraph, alg } from '@dagrejs/graphlib';

const EventEmitter = require('events');
const { uuid } = require('uuidv4');

const DAG_START = 'DAG_START';
const MAX_PREDECESSORS = 3;
const DAG_STORE_KEY = 'DAG_STORE_KEY';
const DEFAULT_WALL_ID = 'DEFAULT_WALL_ID';
const GLOBAL_USER = 'GLOBAL_USER';

const IPFS = require('ipfs');
const all = require('it-all');

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

const getPathsNotInList = (graph, ids) => {
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

    this.wallDataStore = new LocalDatastore('graffitiWalls');
    this.nodeDataStore = new LocalDatastore('graffitiNode');
    this.cidDataStore = new LocalDatastore('graffitiCids');

    this.storeDebounceTimer = null;

    this.walls = {};
    this.currentWallId = null;
  }

  async start() {
    const defaultGraph = await this.wallDataStore
      .has(DAG_STORE_KEY)
      .then(hasStore => (hasStore ? this.wallDataStore.get(DEFAULT_WALL_ID) : null))
      .then(sGraph => (sGraph ? jsonGraph.read(sGraph) : (new Graph({ directed: true })).setNode(DAG_START)));
    
    this.walls[DEFAULT_WALL_ID] = { graph: defaultGraph, user: GLOBAL_USER, cid: null };
    this.currentWallId = DEFAULT_WALL_ID;

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
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: true
          }
        },
        dht: {
          enabled: true,
          randomWalk: {
            enabled: true,
          },
        },
        pubsub: {
          enabled: true
        },
      },
    });

    // Create gossip protocol manager here
    this.graffitiGossip = new GraffitiGossip(this.libp2p.pubsub);

    // Listen for paths from Gossip
    this.graffitiGossip.on('path', ({ from, path }) => this.receivePath(from, path));

    // Listen for peer updates from Gossip
    this.graffitiGossip.on('peer:update', ({ from, name }) => {
      console.info(`${from} is now known as ${name}.`);

      // TODO: consider having all the paths embed the peer name
      // setPeers(peers => {
      //   const newPeers = { ...peers };
      //   newPeers[id] = { name };
      //   return newPeers;
      // });
    });

    // Listen for cids from Gossip
    this.graffitiGossip.on('cid', ({ from, wallId, cid }) => {
      console.info(`${from} sent cid ${cid} for wall ${wallId}.`);
    });

    // Create direct protocol manager here
    this.graffitiDirect = new GraffitiDirect(this.libp2p);

    // Listen for paths from Direct
    this.graffitiDirect.on('path', ({ from, path }) => this.receivePath(from, path));

    // Handle graffiti direct communication requests from peers
    const getMissingPaths = (wallId, ids) => this.walls[wallId] ? getPathsNotInList(this.walls[wallId].graph, ids) : [];

    this.libp2p.handle(this.graffitiDirect.PROTOCOL, this.graffitiDirect.handleWith(getMissingPaths));

    this.libp2p.peerStore.on('change:protocols', async ({ peerId, protocols }) => {
      if (!protocols.includes(this.graffitiDirect.PROTOCOL)) return;

      const connection = this.libp2p.connectionManager.get(peerId);

      // TODO: this sync is limited to wall, we wnt to sync wallIds -> cid too

      const idsWeHave = getCompletePathIdsFromGraph(this.walls[this.currentWallId].graph);
      await this.graffitiDirect.tryGetFromPeer(connection, { wallId: this.currentWallId, idsWeHave });
    });

    await this.libp2p.start();

    this.graffitiGossip.join();

    this.ipfsNode = await IPFS.create();
    const version = await this.ipfsNode.version();

    console.info('Started IPFS client Version:', version.version);

    return getOrderedPaths(defaultGraph);
  }

  // TODO: implement
  async setWallId() {

  }

  async receivePath(from, path) {
    const { wallId, id, data, predecessorIds = [] } = path;

    if (wallId !== this.currentWallId) return;

    if (this.storeDebounceTimer) {
      clearTimeout(this.storeDebounceTimer);
    }

    // TODO: this can get overwritten if wall currentWallId is not same as last receive wallId path
    this.storeDebounceTimer = setTimeout(() => this.savePathsToLocal(wallId), 5000);

    const isMine = from === this.libp2p.peerId.toB58String();
    console.info(`Received path ${id} from ${isMine ? 'self' : from} with ${predecessorIds.length} predecessors.`);

    // TODO: validate here
    // TODO: do something with unknownIds (prune?, ignore?, fetch?)
    const { predIds } = addTheirPathToGraph(this.walls[this.currentWallId].graph, { id, data, predecessorIds });

    this.emit('path', { id, data, predecessorIds: predIds });
  }

  async broadcastPath({ id, data }) {
    console.info('Adding path to local DAG.');
    const result = addOurPathToGraph(this.walls[this.currentWallId].graph, { id, data });

    if (!result) return false;

    const { predecessorIds } = result;

    try {
      console.info('Broadcasting path.');
      await this.graffitiGossip.sendPath({ wallId: this.currentWallId, id, data, predecessorIds });
      console.info('Path broadcasted.');

      return true;
    } catch (err) {
      console.error('Failed to broadcast path.');
      console.error(err);

      return false;
    }
  }

  async savePathsToLocal(wallId) {
    if (!this.walls[wallId]) return;

    console.info('Saving DAG to data store.');
    return this.wallDataStore.put(wallId, jsonGraph.write(this.walls[wallId].graph));
  }

  async loadPathsFromIpfs(wallId) {
    console.info(`Loading wall ${wallId} from IPFS.`);

    const cidString = await this.cidDataStore.get(wallId);
    const serializedGraph = Buffer.concat(await all(this.ipfsNode.cat(cidString))).toString();
    const graph = jsonGraph.read(JSON.parse(serializedGraph));
    this.walls[wallId].graph = graph;

    console.info(`Loaded wall ${wallId} from IPFS. Had ${graph.nodeCount() - 1} paths.`);
  }

  async deletePathsFromIpfs(wallId) {
    console.info(`Removing wall ${wallId} from IPFS.`);

    await this.ipfsNode.files.rm(`/myGraphitiWalls/${wallId}`);
    await this.cidDataStore.delete(wallId);

    console.info(`Removing wall ${wallId} from IPFS.`);
  }

  async savePathsToIpfs(wallId) {
    console.info(`Saving wall ${wallId} to IPFS.`);

    const graph = this.walls[wallId] ? this.walls[wallId].graph : await this.wallDataStore.get(wallId);

    if (!graph) return;

    const serializedGraph = JSON.stringify(jsonGraph.write(graph));
    await this.ipfsNode.files.write(`/myGraphitiWalls/${wallId}`, Buffer.from(serializedGraph), { mode: 744, create: true, parents: true });

    // TODO: what the hell is flush really though?
    const cid = await this.ipfsNode.files.flush(`/myGraphitiWalls/${wallId}`);
    const cidString = cid.toString();
    await this.cidDataStore.put(wallId, cidString);

    console.info(`Saved graphiti DAG as ${cidString} to IPFS.`);

    console.info('Broadcasting IPFS CID.');
    await this.graffitiGossip.sendCid({ wallId, cid });
    console.info('IPFS CID broadcasted.');

    if (this.walls[wallId]) this.walls[wallId].cid = cidString;
  }

  async createWall(name) {
    const id = uuid();
    const user = this.peerId;


    
    // this.graph = (new Graph({ directed: true })).setNode(DAG_START)


    return { id, name, user };
  }
}

export default Node;
