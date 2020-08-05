import { Request, Stats } from './proto';

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
            prevId: data.prevId,
          },
        });

        break;
      case Request.Type.STATS:
        this.payload = Request.encode({ type, stats: data });
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
      default:
        throw Error('Invalid Type');
    }
  }

  static fromPayload(payload) {
    const { from, data, seqno, topicIDs, signature, key } = payload;

    // TODO: see what's in there

    try {
      const request = Request.decode(data);
      const message = new Message(request.type);

      switch (request.type) {
        case Request.Type.PATH:
          const { id, data, prevId } = request.path;
          message.path = {
            id: id.toString(),
            data: data.toString(),
            prevId: prevId.toString()
          };
          break;
        case Request.Type.UPDATE_PEER:
          message.name = request.updatePeer.userHandle.toString();
          break;
        case Request.Type.STATS:
          message.stats = request.stats;
          break;
        case Request.Type.SYNC_REQUEST:
          message.ids = request.syncRequest.ids.map(id => id.toString());
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
export const NodeType = Stats.NodeType;
