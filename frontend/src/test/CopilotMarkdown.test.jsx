import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CopilotMarkdown } from '../components/tabs/ai/CopilotMarkdown';

describe('CopilotMarkdown', () => {
  it('renders markdown tables as structured table markup', () => {
    render(
      <CopilotMarkdown
        content={[
          '| Metric | Value |',
          '| --- | --- |',
          '| Revenue | $10B |',
          '| Margin | 25% |',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Metric' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '$10B' })).toBeInTheDocument();
  });
});
