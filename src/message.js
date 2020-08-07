import { Request } from './proto';

class Message {
  constructor(type, data) {
    this.type = type;

    if (!data) return;

    switch (type) {
      case Request.Type.PATH:
        this.payload = Request.encode({
          type,
          path: data,
        });

        break;
      case Request.Type.UPDATE_PEER:
        this.payload = Request.encode({
          type,
          updatePeer: {
            userHandle: data,
          },
        });

        break;
      case Request.Type.PATH_SYNC_REQUEST:
        this.payload = Request.encode({
          type,
          pathSyncRequest: data,
        });

        break;
      case Request.Type.WALL_SYNC_REQUEST:
        this.payload = Request.encode({
          type,
          wallSyncRequest: data,
        });

        break;
      case Request.Type.WALL:
        this.payload = Request.encode({
          type,
          wall: data,
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
          message.path = {
            wallId: request.path.wallId.toString(),
            id: request.path.id.toString(),
            data: request.path.data.toString(),
            predecessorIds: request.path.predecessorIds.map(id => id.toString()),
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
        case Request.Type.WALL:
          message.wallId = request.wall.wallId.toString();
          message.name = request.wall.name.toString();
          message.creator = request.wall.creator.toString();
          message.cid = request.wall.cid && request.wall.cid.toString();

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
