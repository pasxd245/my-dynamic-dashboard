// @vitest-environment happy-dom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Modal from '../index.tsx';

describe('Modal', () => {
  it('renders nothing modal-like when open={false}', () => {
    render(
      <Modal open={false} title="Test">
        <div data-testid="body">body</div>
      </Modal>,
    );
    // antd's Modal mounts content into a portal under document.body when open;
    // when closed it removes the wrapper. Either way, the close button class
    // should not appear in the DOM.
    expect(document.body.querySelector('.ant-modal')).toBeNull();
  });

  it('renders modal content and title when open={true}', () => {
    render(
      <Modal open title="MyTitle">
        <div data-testid="body">body</div>
      </Modal>,
    );
    // Modal portals to document.body — query against the document, not the
    // local container the test root rendered into.
    const root = document.body.querySelector('.ant-modal');
    expect(root).not.toBeNull();
    expect(document.body.textContent).toContain('MyTitle');
    expect(document.body.textContent).toContain('body');
  });

  it('exports a function component (smoke)', () => {
    expect(typeof Modal).toBe('function');
    expect(Modal.name).toBe('Modal');
  });
});
