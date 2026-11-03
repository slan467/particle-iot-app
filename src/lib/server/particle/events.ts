export interface StreamEvent {
  event: string;
  data: string;
  id?: string;
}

/** SSE framing is independent of TCP chunks. Comments/heartbeats emit no events. */
export class EventParser {
  private buffer = '';
  private frame: string[] = [];
  private frameSize = 0;

  push(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);
      if (line === '') {
        const event = this.dispatch();
        if (event) events.push(event);
      } else if (!line.startsWith(':')) {
        this.frame.push(line);
        this.frameSize += line.length;
      }
      if (this.frameSize > 65_536) throw new Error('Particle event exceeds size limit.');
    }
    if (this.buffer.length > 65_536) throw new Error('Particle stream line exceeds size limit.');
    return events;
  }

  private dispatch(): StreamEvent | undefined {
    let event = 'message';
    let id: string | undefined;
    const data: string[] = [];
    for (const line of this.frame) {
      const split = line.indexOf(':');
      const field = split === -1 ? line : line.slice(0, split);
      const value = split === -1 ? '' : line.slice(split + 1).replace(/^ /, '');
      if (field === 'event') event = value;
      if (field === 'data') data.push(value);
      if (field === 'id') id = value;
    }
    this.frame = [];
    this.frameSize = 0;
    return data.length ? { event, data: data.join('\n'), id } : undefined;
  }
}
