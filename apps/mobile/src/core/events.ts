export type EventHandler<Payload> = (payload: Payload) => void;

export class EventBus<EventMap extends object>
{
  private readonly handlers = new Map<keyof EventMap, Set<EventHandler<never>>>();

  on<Name extends keyof EventMap>(name: Name, handler: EventHandler<EventMap[Name]>): () => void
  {
    let set = this.handlers.get(name);
    if (set === undefined)
    {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as EventHandler<never>);
    return () =>
    {
      set?.delete(handler as EventHandler<never>);
    };
  }

  emit<Name extends keyof EventMap>(name: Name, payload: EventMap[Name]): void
  {
    const set = this.handlers.get(name);
    if (set === undefined)
    {
      return;
    }
    for (const handler of [...set])
    {
      (handler as EventHandler<EventMap[Name]>)(payload);
    }
  }

  listenerCount(name: keyof EventMap): number
  {
    return this.handlers.get(name)?.size ?? 0;
  }
}
