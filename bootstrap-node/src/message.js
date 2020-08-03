const { Request, Stats } = require('./proto');

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
            data: Buffer.from(data.data),
            created: Date.now(),
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
      case Request.Type.SYNC:
        this.payload = Request.encode({ type, lastPath: data });

        break;
      default:
        throw Error('Invalid Type');
    }
  }

  static fromPayload(payload) {
    try {
      const request = Request.decode(payload.data);
      const message = new Message(request.type);

      switch (request.type) {
        case Request.Type.PATH:
          const { id, data, created } = request.path;
          message.path = { id, created, data: data.toString() };
          break;
        case Request.Type.UPDATE_PEER:
          message.name = request.updatePeer.userHandle.toString();
          break;
        case Request.Type.STATS:
          message.stats = request.stats;
          break;
        case Request.Type.SYNC:
          message.lastPath = request.lastPath;
          break;
        default:
          return null;
      }

      message.payload = payload;
      message.from = payload.from;
      message.type = request.type;
      return message;
    } catch (err) {
      console.error(err);
    }

    return null;
  }
}

module.exports = Message;
module.exports.Type = Request.Type;
module.exports.NodeType = Stats.NodeType;
