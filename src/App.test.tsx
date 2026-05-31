import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders the live turtle workspace', () => {
    render(<App />);

    expect(screen.getByAltText(/turtlicious/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /open configuration/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /svg/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: /select brush/i }),
    ).not.toBeInTheDocument();
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

  it('opens and closes the configuration modal', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      screen.getByRole('button', { name: /open configuration/i }),
    );

    expect(
      screen.getByRole('dialog', { name: /configuration/i }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: /close configuration/i }),
    );

    expect(
      screen.queryByRole('dialog', { name: /configuration/i }),
    ).not.toBeInTheDocument();
  });

  it('persists brush changes immediately from the configuration modal', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      screen.getByRole('button', { name: /open configuration/i }),
    );

    const brushSelect = screen.getByRole('combobox', { name: /select brush/i });
    await user.selectOptions(brushSelect, 'rainbow');

    expect(brushSelect).toHaveValue('rainbow');

    await user.click(
      screen.getByRole('button', { name: /close configuration/i }),
    );

    await user.click(
      screen.getByRole('button', { name: /open configuration/i }),
    );

    expect(screen.getByRole('combobox', { name: /select brush/i })).toHaveValue(
      'rainbow',
    );
  });

  it('shows and persists square brush controls in configuration', async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      screen.getByRole('button', { name: /open configuration/i }),
    );

    const brushSelect = screen.getByRole('combobox', { name: /select brush/i });
    await user.selectOptions(brushSelect, 'square');

    expect(screen.getByLabelText(/square brush width/i)).toHaveValue(5);
    expect(
      screen.getByLabelText(/square brush smooth corners/i),
    ).not.toBeChecked();

    await user.clear(screen.getByLabelText(/square brush width/i));
    await user.type(screen.getByLabelText(/square brush width/i), '7.5');
    await user.click(screen.getByLabelText(/square brush smooth corners/i));

    await user.click(
      screen.getByRole('button', { name: /close configuration/i }),
    );
    await user.click(
      screen.getByRole('button', { name: /open configuration/i }),
    );

    expect(screen.getByRole('combobox', { name: /select brush/i })).toHaveValue(
      'square',
    );
    expect(screen.getByLabelText(/square brush width/i)).toHaveValue(7.5);
    expect(screen.getByLabelText(/square brush smooth corners/i)).toBeChecked();
  });
});
