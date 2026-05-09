// Gateway - minimal public surface
// Keep gateway职责聚焦为入口/转发，仅显式暴露自身需要依赖的 service API。

export {
  routeMessage,
  VSCodeWebViewLike,
  setRunningCWD
} from '@openmcp/service';

export { gatewayUserLogDir } from './paths.js';
