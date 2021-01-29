import { Signale } from '..'

const custom = new Signale({
  stream: process.stderr,
  scope: 'custom',
  logLevels: {
    sherlock: -1,
  },
  types: {
    sherlock: {
      badge: '🔎',
      color: 'yellow',
      label: 'sherlock',
      logLevel: 'sherlock' as const,
    },
  }
});

custom.sherlock('Elementary! You have an unused variable on L221.');
custom.debug('This should still work');

