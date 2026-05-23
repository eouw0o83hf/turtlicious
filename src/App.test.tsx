import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders the code-to-image workspace', () => {
    render(<App />);

    expect(screen.getByAltText(/turtlicious/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/editable html source/i)).toBeInTheDocument();
  });
});
