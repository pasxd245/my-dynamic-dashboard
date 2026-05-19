import { Modal as AntModal, type ModalProps as AntModalProps } from 'antd';
import type { ReactElement } from 'react';

export type ModalProps = AntModalProps;

/**
 * Brand-default Modal. Inherits all token styling from MddUIProvider's
 * ConfigProvider; this wrapper exists so package consumers have a single
 * named import rather than reaching into `antd` directly.
 *
 * NOTE: antd's Modal exposes static methods (`Modal.confirm`,
 * `Modal.info`, ...) and a `useModal` hook. Those are NOT re-exported
 * by this wrapper — use them via `antd` directly until a consumer
 * needs them through this package. Adding them is a separate round.
 */
export default function Modal(props: ModalProps): ReactElement {
  return <AntModal {...props} />;
}

export { Modal };
