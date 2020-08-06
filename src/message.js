import { Request } from './proto';

class Message {
  constructor(type, data) {
    this.type = type;

    if (!data) return;

    switch (type) {
      case Request.Type.PATH:
        this.path = data;

        this.payload = Request.encode({
          type,
          path: {
            wallId: data.wallId,
            id: data.id,
            data: data.data,
            predecessorIds: data.predecessorIds,
          },
        });

        break;
      case Request.Type.UPDATE_PEER:
        this.payload = Request.encode({
          type: Request.Type.UPDATE_PEER,
          updatePeer: {
            userHandle: Buffer.from(data),
          },
        });

        break;
      case Request.Type.PATH_SYNC_REQUEST:
        this.payload = Request.encode({
          type,
          pathSyncRequest: {
            wallId: data.wallId,
            ids: data.ids,
          }
        });

        break;
      case Request.Type.WALL_SYNC_REQUEST:
        this.payload = Request.encode({
          type,
          wallSyncRequest: {
            wallIds: data.wallIds,
            cids: data.cids,
          }
        });

        break;
      case Request.Type.WALL_CID:
        this.payload = Request.encode({
          type,
          wallCid: {
            wallId: data.wallId,
            cid: data.cid,
          }
        });

        break;
      default:
        throw Error('Invalid Type');
    }
  }

  static fromPayload(payload) {
    // const { from, data, seqno, topicIDs, signature, key } = payload;
    const { from, data } = payload;

    try {
      const request = Request.decode(data);
      const message = new Message(request.type);

      switch (request.type) {
        case Request.Type.PATH:
          const { wallId, id, data, predecessorIds } = request.path;
          message.path = {
            wallId: wallId.toString(),
            id: id.toString(),
            data: data.toString(),
            predecessorIds: predecessorIds.map(id => id.toString()),
          };
          
          break;
        case Request.Type.UPDATE_PEER:
          message.name = request.updatePeer.userHandle.toString();

          break;
        case Request.Type.PATH_SYNC_REQUEST:
          message.wallId = request.pathSyncRequest.wallId.toString();
          message.ids = request.pathSyncRequest.ids.map(id => id.toString());

          break;
        case Request.Type.WALL_SYNC_REQUEST:
          message.wallIds = request.wallSyncRequest.wallIds.map(wallId => wallId.toString());
          message.ids = request.wallSyncRequest.ids.map(id => id.toString());

          break;
        case Request.Type.WALL_CID:
          message.wallId = request.wallCid.wallId.toString();
          message.cid = request.wallCid.cid.toString();

          break;
        default:
          return null;
      }

      message.from = from;
      message.type = request.type;
      return message;
    } catch (err) {
      console.error(err);
    }

    return null;
  }
}

export default Message;
export const MessageType = Request.Type;
