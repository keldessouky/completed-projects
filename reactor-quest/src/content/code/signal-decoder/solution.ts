export function formatId(id: string | number): string {
  if (typeof id === 'number') {
    return '#' + String(id).padStart(4, '0');
  }
  return id.toUpperCase();
}

export function channelLabel(channel: string | string[]): string {
  return Array.isArray(channel) ? channel.join(', ') : channel;
}
