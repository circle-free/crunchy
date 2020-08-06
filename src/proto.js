const protons = require('protons');

const { Request } = protons(`
  message Request {
    enum Type {
      PATH = 0;
      UPDATE_PEER = 1;
      SYNC_REQUEST = 2;
    }

    required Type type = 1;
    optional Path path = 2;
    optional UpdatePeer updatePeer = 3;
    optional SyncRequest syncRequest = 4;
  }

  message Path {
    required bytes id = 1;
    required bytes data = 2;
    repeated bytes predecessorIds = 3;
  }

  message UpdatePeer {
    optional bytes userHandle = 1;
  }

  message SyncRequest {
    repeated bytes ids = 1;
  }
`);

export { Request };
