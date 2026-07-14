import './style.css';

import { HubController } from './hub-controller';
import { createHubRuntime } from './runtime';

const app = new HubController({
  document,
  window,
  runtime: createHubRuntime(),
});

app.init();
window.addEventListener('pagehide', () => app.destroy(), { once: true });
