import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, expect, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock wouter
vi.mock('wouter', () => ({
  Link: ({ children, href, className, 'data-testid': testId, ...props }: any) => (
    <a href={href} className={className} data-testid={testId} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ['/', vi.fn()],
  useRoute: (path: string) => [false, null],
  useParams: () => ({}),
}));
