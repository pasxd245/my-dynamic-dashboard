import { Button as AntButton, type ButtonProps as AntButtonProps } from 'antd';
import type { ReactElement } from 'react';

export type ButtonProps = AntButtonProps;

/**
 * Brand-default Button. Inherits all token styling from MddUIProvider's
 * ConfigProvider; this wrapper exists so package consumers have a single
 * named import rather than reaching into `antd` directly.
 */
export default function Button(props: ButtonProps): ReactElement {
  return <AntButton {...props} />;
}

export { Button };
