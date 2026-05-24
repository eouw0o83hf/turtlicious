import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders the live turtle workspace', () => {
    render(<App />);

    expect(screen.getByAltText(/turtlicious/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /svg/i })).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: /select brush/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('separator', { name: /resize panes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/editable turtle source/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/pan and zoom turtle sketch/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /turtle sketch/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/100% zoom/i)).toBeInTheDocument();
  });
});
