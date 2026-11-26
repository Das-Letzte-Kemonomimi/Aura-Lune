import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FieldLabel, Select, TextArea, TextField } from './Field';

afterEach(cleanup);

describe('TextField', () => {
  it('is a text input labelled by its FieldLabel', () => {
    const onChange = vi.fn();
    render(
      <>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <TextField id="name" value="" onChange={onChange} />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input.getAttribute('type')).toBe('text');
    fireEvent.change(input, { target: { value: 'Lune' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('applies the size and mono variants', () => {
    render(<TextField aria-label="Path" size="sm" mono />);
    const className = screen.getByRole('textbox', { name: 'Path' }).className;
    expect(className).toContain('text-xs');
    expect(className).toContain('font-mono');
  });

  it('wraps the input with an icon and moves className to the wrapper', () => {
    render(<TextField aria-label="Search" type="search" icon={<svg data-testid="icon" />} className="max-w-xs" />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(input.className).toContain('pl-9');
    expect((input.parentElement as HTMLElement).className).toContain('max-w-xs');
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  it("lets the caller's className win", () => {
    render(<TextField aria-label="X" className="rounded-xl" />);
    const className = screen.getByRole('textbox', { name: 'X' }).className;
    expect(className).toContain('rounded-xl');
    expect(className).not.toContain('rounded-lg');
  });
});

describe('TextArea and Select', () => {
  it('render native controls', () => {
    render(
      <>
        <TextArea aria-label="Notes" mono />
        <Select aria-label="Device" size="sm">
          <option>Default</option>
        </Select>
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Notes' }).className).toContain('font-mono');
    expect(screen.getByRole('combobox', { name: 'Device' }).className).toContain('text-xs');
  });
});
