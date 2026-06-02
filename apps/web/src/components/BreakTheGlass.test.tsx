import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BreakTheGlass } from './BreakTheGlass';

describe('BreakTheGlass', () => {
  it('requires a reason before proceeding', () => {
    const onProceed = vi.fn();
    render(<BreakTheGlass onProceed={onProceed} onCancel={() => {}} />);

    const proceed = screen.getByRole('button', { name: /proceed with emergency access/i });
    expect(proceed).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/reason for emergency access/i), {
      target: { value: 'patient unresponsive' },
    });
    expect(proceed).toBeEnabled();
    fireEvent.click(proceed);
    expect(onProceed).toHaveBeenCalledWith('patient unresponsive');
  });

  it('cancels without proceeding', () => {
    const onCancel = vi.fn();
    render(<BreakTheGlass onProceed={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
