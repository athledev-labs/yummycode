/**
 * Suppress <think>...</think> reasoning blocks from a token stream while
 * passing everything else through. Handles tags split across chunk boundaries.
 */
export async function* filterThink(source: AsyncIterable<string>): AsyncIterable<string> {
  const OPEN = '<think>';
  const CLOSE = '</think>';
  let inThink = false;
  let buffer = '';

  for await (const chunk of source) {
    buffer += chunk;
    let out = '';
    // Process complete tags in the buffer, keeping a safe tail that might hold
    // a partial tag spanning into the next chunk.
    for (;;) {
      if (!inThink) {
        const open = buffer.indexOf(OPEN);
        if (open === -1) {
          const keep = Math.min(buffer.length, OPEN.length - 1);
          out += buffer.slice(0, buffer.length - keep);
          buffer = buffer.slice(buffer.length - keep);
          break;
        }
        out += buffer.slice(0, open);
        buffer = buffer.slice(open + OPEN.length);
        inThink = true;
      } else {
        const close = buffer.indexOf(CLOSE);
        if (close === -1) {
          const keep = Math.min(buffer.length, CLOSE.length - 1);
          buffer = buffer.slice(buffer.length - keep);
          break;
        }
        buffer = buffer.slice(close + CLOSE.length);
        inThink = false;
      }
    }
    if (out) yield out;
  }

  if (!inThink && buffer) yield buffer;
}
