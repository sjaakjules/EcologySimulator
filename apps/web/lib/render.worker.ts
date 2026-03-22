/// <reference lib="webworker" />

import { EcologySceneRuntime } from '@ecology/scene3d';
import type { RenderCommand, RenderEvent } from '@ecology/worker-runtime';

let runtime: EcologySceneRuntime | undefined;

self.onmessage = async (event: MessageEvent<RenderCommand>) => {
  const command = event.data;

  switch (command.type) {
    case 'InitCanvas': {
      runtime = new EcologySceneRuntime(
        command.canvas,
        (selection) => postMessage({ type: 'PickResult', selection } satisfies RenderEvent),
        (backend) => postMessage({ type: 'RendererReady', backend } satisfies RenderEvent),
        (selection) => postMessage({ type: 'HoverResult', selection } satisfies RenderEvent)
      );
      await runtime.init(command.width, command.height, command.dpr);
      runtime.setBundle(command.bundle);
      break;
    }
    case 'LoadBundle':
      runtime?.setBundle(command.bundle);
      break;
    case 'FrameSnapshot':
      runtime?.setSnapshot(command.snapshot);
      break;
    case 'Resize':
      runtime?.resize(command.width, command.height, command.dpr);
      break;
    case 'CameraUpdate':
      runtime?.setCamera(command.camera);
      break;
    case 'VisualsUpdate':
      runtime?.setVisuals(command.visuals);
      break;
    case 'HoverRequest':
      runtime?.hover(command.x, command.y);
      break;
    case 'HoverClear':
      runtime?.clearHover();
      break;
    case 'PickRequest':
      runtime?.pick(command.x, command.y);
      break;
    case 'SelectionOverlay':
      runtime?.setSelection(command.overlay);
      break;
    case 'Dispose':
      runtime?.dispose();
      break;
  }
};
