import './style.css';

import { ApplicationLifecycle } from './application-lifecycle';
import { HubController } from './hub-controller';
import { createHubRuntime } from './runtime';
import { revealHubAfterPaint } from './launch-screen';

const runtime = createHubRuntime();

const hub = new HubController({
  document,
  window,
  runtime,
});

const app = new ApplicationLifecycle({
  application: hub,
  targetWindow: window,
  reveal: () => revealHubAfterPaint({ runtime }),
});

app.init();
