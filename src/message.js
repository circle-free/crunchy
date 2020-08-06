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
      case Request.Type.SYNC_REQUEST:
        this.payload = Request.encode({ type, syncRequest: { ids: data } });

        break;
      case Request.Type.GRAPH_CID:
        this.payload = Request.encode({ type, graphCid: { cid: data } });

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
          const { id, data, predecessorIds } = request.path;
          message.path = {
            id: id.toString(),
            data: data.toString(),
            predecessorIds: predecessorIds.map(id => id.toString()),
          };
          
          break;
        case Request.Type.UPDATE_PEER:
          message.name = request.updatePeer.userHandle.toString();

          break;
        case Request.Type.SYNC_REQUEST:
          message.ids = request.syncRequest.ids.map(id => id.toString());

          break;
        case Request.Type.GRAPH_CID:
          message.cid = request.graphCid.cid.toString();

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
