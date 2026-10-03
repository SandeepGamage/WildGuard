const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * Minimal structured logger. Never pass tokens, passwords or full request
 * bodies to it; callers log identifiers and codes only.
 * @param {'debug'|'info'|'warn'|'error'} level Minimum level to emit.
 * @param {{ silent?: boolean }} [options]
 */
function createLogger(level = 'info', options = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const write = (name, message, context) => {
    if (options.silent || LEVELS[name] < threshold) return;
    const line = JSON.stringify({ level: name, time: new Date().toISOString(), message, ...context });
    const stream = name === 'error' || name === 'warn' ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  };

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}

module.exports = { createLogger };
