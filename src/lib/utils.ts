export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function writeSseEvent(writer: (chunk: string) => void, event: object): void {
  writer(`data: ${JSON.stringify(event)}\n\n`);
}
