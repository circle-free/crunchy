// Libp2p Core
import Libp2p from 'libp2p';

// Transports
import TCP from 'libp2p-tcp';
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

import graffitiDirect from './graffiti-direct-protocol';
import multiaddr from 'multiaddr';

const createLibp2p = async (peerId, libp2pDatastore) => {
  // Create the Node
  const libp2p = await Libp2p.create({
    peerId,
    addresses: {
      listen: ['/ip4/127.0.0.1/tcp/15555/ws/p2p-webrtc-star'],
    },
    modules: {
      transport: [Websockets, TCP, WebrtcStar],
      streamMuxer: [Mplex],
      connEncryption: [NOISE, Secio],
      peerDiscovery: [Bootstrap],
      dht: KadDHT,
      pubsub: Gossipsub,
    },
    datastore: libp2pDatastore,
    peerStore: {
      persistence: true,
      threshold: 1,
    },
    config: {
      peerDiscovery: {
        bootstrap: {
          list: ['/ip4/127.0.0.1/tcp/15555/ws/p2p-webrtc-star/p2p/16Uiu2HAm9Byae61EzUQNStvfRzdnQTqdccMDwaGja39RnyYAnNV7'],
        },
      },
      dht: {
        enabled: true,
        randomWalk: {
          enabled: true,
        },
      },
      // relay: {
      //   enabled: true,
      //   hop: {
      //     enabled: true,
      //     active: true,
      //   },
      // },
    },
  });

  libp2p.handle(graffitiDirect.protocol, graffitiDirect.handle);

  // Automatically start libp2p
  await libp2p.start();

  // Create the multiaddr to the Bootstrap node
  const targetAddress = multiaddr('/ip4/127.0.0.1/tcp/63786/ws/ipfs/16Uiu2HAm9Byae61EzUQNStvfRzdnQTqdccMDwaGja39RnyYAnNV7');
  // And dial it. The UI is listening for connections,
  // so it should update if the dial is successful.

  await libp2p.dial(targetAddress).catch(console.error);

  return libp2p;
};

export default createLibp2p;
