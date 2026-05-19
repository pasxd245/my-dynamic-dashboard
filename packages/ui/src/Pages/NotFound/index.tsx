import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export interface NotFoundProps {
  readonly title?: string;
  readonly message?: string;
  readonly homeHref?: string;
  readonly homeLabel?: string;
}

/**
 * Default 404 page. Drop under `<Route path="*">` in the consumer's
 * router. All copy is consumer-overridable via props.
 */
export default function NotFound({
  title = 'Page not found',
  message = "The page you're looking for doesn't exist.",
  homeHref = '/',
  homeLabel = 'Go home',
}: NotFoundProps = {}): ReactElement {
  return (
    <main className="mdd-ui-not-found" role="main">
      <h1 className="mdd-ui-not-found__title">{title}</h1>
      <p className="mdd-ui-not-found__message">{message}</p>
      <p className="mdd-ui-not-found__home">
        <Link to={homeHref}>{homeLabel}</Link>
      </p>
    </main>
  );
}

export { NotFound };
