import './style.css';

import { HubController } from './hub-controller';
import { createHubRuntime } from './runtime';
import { revealHubAfterPaint } from './launch-screen';

const runtime = createHubRuntime();

const app = new HubController({
  document,
  window,
  runtime,
});

app.init();
void revealHubAfterPaint({ runtime });
window.addEventListener('pagehide', () => app.destroy(), { once: true });
