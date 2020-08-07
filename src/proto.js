const protons = require('protons');

const { Request } = protons(`
  message Request {
    enum Type {
      PATH = 0;
      UPDATE_PEER = 1;
      PATH_SYNC_REQUEST = 2;
      WALL_SYNC_REQUEST = 3;
      WALL = 4;
    }

    required Type type = 1;
    optional Path path = 2;
    optional UpdatePeer updatePeer = 3;
    optional PathSyncRequest pathSyncRequest = 4;
    optional WallSyncRequest wallSyncRequest = 5;
    optional Wall wall = 6;
  }

  message Path {
    required bytes wallId = 1;
    required bytes id = 2;
    required bytes data = 3;
    repeated bytes predecessorIds = 4;
  }

  message UpdatePeer {
    optional bytes userHandle = 1;
  }

  message PathSyncRequest {
    required bytes wallId = 1;
    repeated bytes ids = 2;
  }

  message WallSyncRequest {
    repeated bytes wallIds = 1;
    repeated bytes cids = 2;
  }

  message Wall {
    required bytes wallId = 1;
    required bytes creator = 2;
    required bytes name = 3;
    optional bytes cid = 4;
  }
`);

export { Request };
