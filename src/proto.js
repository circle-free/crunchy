'use strict';

const protons = require('protons');

const { Request, Stats } = protons(`
  message Request {
    enum Type {
      PATH = 0;
      UPDATE_PEER = 1;
      STATS = 2;
      SYNC_REQUEST = 3;
    }

    required Type type = 1;
    optional Path path = 2;
    optional UpdatePeer updatePeer = 3;
    optional Stats stats = 4;
    optional SyncRequest syncRequest = 5;
  }

  message Path {
    required bytes id = 1;
    required bytes data = 2;
    required bytes prevId = 3;
  }

  message UpdatePeer {
    optional bytes userHandle = 1;
  }

  message Stats {
    enum NodeType {
      GO = 0;
      NODEJS = 1;
      BROWSER = 2;
    }

    repeated bytes connectedPeers = 1;
    optional NodeType nodeType = 2;
  }

  message SyncRequest {
    repeated bytes ids = 1;
  }
`);

export { Request, Stats };
