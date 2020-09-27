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
const DEFAULT_WALL_ID = 'DEFAULT_WALL_ID';
const DEFAULT_WALL_NAME = 'Default';
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

    this.walls = {};
    this.currentWallId = null;
    
  } 

  async start() {
    const wallKeyValues = await this.wallDataStore.all();
    let walls = [];
    
    wallKeyValues.forEach(({ key, value }) => {
      const { name, creator, graph, cid } = value;
      this.walls[key] = { name, creator, graph: jsonGraph.read(graph), cid };
      walls.push({ wallId: key, name, creator });
    });

    if (!this.walls[DEFAULT_WALL_ID]) {
      const graph = new Graph({ directed: true });
      graph.setNode(DAG_START);
      this.walls[DEFAULT_WALL_ID] = { name: DEFAULT_WALL_NAME, creator: GLOBAL_USER, graph };
      walls.push({ wallId: DEFAULT_WALL_ID, name: DEFAULT_WALL_NAME, creator: GLOBAL_USER });
    }

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
            active: true,
          },
        },
        dht: {
          enabled: true,
          randomWalk: {
            enabled: true,
          },
        },
        pubsub: {
          enabled: true,
        },
      },
    });

    this.peerId = this.peerId.toB58String();  

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
    this.graffitiGossip.on('wall', async ({ from, wallId, name, creator, cid }) => {
      // TODO: test who exactly from is, the gossiper or the source?
      console.info(`Got wall ${name} (${wallId.slice(0, 8)}) by ${creator.slice(0, 8)}.`);
  
      if (!this.walls[wallId]) {
        this.walls[wallId] = {
          name,
          creator,
          graph: (new Graph({ directed: true })).setNode(DAG_START),
          cid
        };

        this.emit('wall', { wallId, name, creator });

        return;
      };

      this.walls[wallId].cid = cid;
    });

    // Create direct protocol manager here
    this.graffitiDirect = new GraffitiDirect(this.libp2p);

    // Listen for paths from Direct
    this.graffitiDirect.on('path', ({ from, path }) => this.receivePath(from, path));

    // Handle graffiti direct communication requests from peers
    const getMissingPaths = (wallId, ids) => (this.walls[wallId] ? getPathsNotInList(this.walls[wallId].graph, ids) : []);

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

    return {
      walls,
      paths: getOrderedPaths(this.walls[this.currentWallId].graph),
    };
  }

  async receivePath(from, path) {
    const { wallId, id, data, predecessorIds = [] } = path;

    // TODO: if you get a path for a wall you have never heard about, either ignore or sync
    if (!this.walls[wallId]) return

    clearTimeout(this.walls[wallId].saveTimer);

    // TODO: validate here (like checking fr DAG being cycle if the path is added)
    // TODO: do something with unknownIds (prune?, ignore?, fetch?)
    const { predIds } = addTheirPathToGraph(this.walls[this.currentWallId].graph, { id, data, predecessorIds });

    this.walls[wallId].saveTimer = setTimeout(() => this.saveWallToLocal(wallId), 5000);

    const isMine = from === this.peerId;
    console.info(`Received path ${id} from ${isMine ? 'self' : from.slice(0, 8)} with ${predecessorIds.length} predecessors.`);

    if (wallId !== this.currentWallId) return;

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

  async saveWallToLocal(wallId) {
    const wall = this.walls[wallId];

    if (!wall) return;

    const { name, creator, graph, cid } = wall;
    const sGraph = jsonGraph.write(graph);

    console.info(`Saving wall ${name} (${wallId.slice(0, 8)}) to local store.`);
    await this.wallDataStore.put(wallId, { name, creator, graph: sGraph, cid });

    return true;
  }

  async loadWallFromLocal(wallId) {
    console.info(`Loading wall ${wallId.slice(0, 8)} from local store.`);

    const wall = await this.wallDataStore.get(DEFAULT_WALL_ID);

    if (!wall) return false;

    const { name, creator, graph: sGraph } = wall;
    const graph = jsonGraph.read(sGraph);

    this.walls[wallId] = { wallId, name, creator, graph };

    return true;
  }

  async saveWallToIpfs(wallId) {
    console.info(`Saving wall ${wallId.slice(0, 8)} to IPFS.`);

    if (!this.walls[wallId]) return false;

    const { name, creator, graph } = this.walls[wallId];
    const sGraph = jsonGraph.write(graph);
    const stringWall = JSON.stringify({ name, creator, graph: sGraph });

    await this.ipfsNode.files.write(`/myGraphitiWalls/${wallId}`, Buffer.from(stringWall), { mode: 744, create: true, parents: true });

    // TODO: what the hell is flush really though?
    const cid = await this.ipfsNode.files.flush(`/myGraphitiWalls/${wallId}`);
    const cidString = cid.toString();
    this.walls[wallId].cid = cidString;

    console.info(`Saved graphiti DAG as ${cidString.slice(0, 8)} to IPFS as ${cidString}.`);

    console.info('Broadcasting IPFS CID.');
    // TODO: creator of wall needs to be had somehow
    // await this.graffitiGossip.sendWall({ wallId, cidString });
    console.info('IPFS CID broadcasted.');

    return true;
  }

  async loadWallFromIpfs(wallId) {
    console.info(`Loading wall ${wallId.slice(0, 8)} from IPFS.`);

    if (!this.walls[wallId]) return false;

    const cidString = this.walls[wallId].cid;

    if (!cidString) return false;

    const stringWall = Buffer.concat(await all(this.ipfsNode.cat(cidString))).toString();
    const { name, creator, graph: sGraph } = JSON.parse(stringWall);
    const graph = jsonGraph.read(JSON.parse(sGraph));

    this.walls[wallId].graph = graph;
    this.walls[wallId].name = name;
    this.walls[wallId].creator = creator;

    console.info(`Loaded wall ${wallId.slice(0, 8)} from IPFS. Had ${graph.nodeCount() - 1} paths.`);

    return true;
  }

  async deleteWallFromIpfs(wallId) {
    console.info(`Removing wall ${wallId.slice(0, 8)} from IPFS.`);

    // TODO: check needed here if file exists ipfs

    await this.ipfsNode.files.rm(`/myGraphitiWalls/${wallId}`);

    console.info(`Removed wall ${wallId.slice(0, 8)} from IPFS.`);

    const localWall = await this.wallDataStore.get(wallId);

    if (!localWall) return true;

    localWall.cid = undefined;
    await this.wallDataStore.put(wallId, localWall);

    return true;
  }

  async createWall(name) {
    const wallId = uuid();
    const creator = this.peerId;
    const graph = new Graph({ directed: true }).setNode(DAG_START);
    this.walls[wallId] = { name, creator, graph };

    await this.graffitiGossip.sendWall({ wallId, name, creator });

    await this.setWall(wallId);

    return true;
  }

  async setWall(wallId) {
    await this.saveWallToLocal(this.currentWallId);

    if (this.walls[wallId] || (await this.loadWallFromLocal(wallId)) || (await this.loadWallFromIpfs(wallId))) {
      this.currentWallId = wallId;
      console.log(`Current wall is ${this.walls[this.currentWallId].name}`)

      return getOrderedPaths(this.walls[wallId].graph);
    }

    return null;
  }
}

export default Node;
