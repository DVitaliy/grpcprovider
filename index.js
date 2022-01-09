class EventObserver {
  constructor() {
    this.observers = []
  }
  subscribe(fn) {
    if (!this.observers.some((obj) => obj === fn)) this.observers.push(fn)
  }
  unsubscribe(fn) {
    this.observers = this.observers.filter((obj) => obj !== fn)
  }
  broadcast(...rest) {
    this.observers.forEach((fn) => fn(...rest))
  }
}

class APIClass {
  constructor({ host, getTokenCallBack }) {
    this.host = host
    this.getTokenCallBack = getTokenCallBack
    this.observer = new EventObserver()
    this.gRPCServices = {}
  }
  async getToken() {
    try {
      return await this.getTokenCallBack()
    } catch (err) {
      // continue regardless of error
    }
  }
  subscribeResponse(fn) {
    this.observer.subscribe(fn)
  }
  unsubscribeResponse(fn) {
    this.observer.unsubscribe(fn)
  }
  addgRPCService(name, Client, message) {
    if (!(name in this.gRPCServices)) {
      this.gRPCServices[name] = {
        client: this.proxygRPCService(Client),
        message
      }
    }
  }
  proxygRPCService(Client) {
    let self = this
    return new Proxy(new Client(this.host), {
      get(target, name) {
        if (name in target.__proto__) {
          return async (...args) => {
            try {
              const response = await target[name].apply(target, [
                ...args,
                {
                  Authorization: `Bearer ${await self.getToken()}`
                }
              ])
              return Promise.resolve(response)
            } catch (err) {
              self.observer.broadcast(err)

              return Promise.reject(err)
            }
          }
        } else {
          return Reflect.get(...arguments)
        }
      }
    })
  }
  getgRPCService(name) {
    return this.gRPCServices[name]
  }
}
export default APIClass
