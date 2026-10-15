import React from 'react';
import { render, screen } from '@testing-library/react';
import RoomStayTimeline from './RoomStayTimeline';

const retreat = { startDate: '2026-10-01', endDate: '2026-10-08' }; // 7-night retreat

describe('RoomStayTimeline', () => {
  it('renders nothing when there are no occupants', () => {
    const { container } = render(<RoomStayTimeline retreat={retreat} occupants={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single full-width bar for an occupant with no stay override', () => {
    render(<RoomStayTimeline retreat={retreat} occupants={[{ _id: 'b1', name: 'Ada Nowak' }]} />);
    const bar = screen.getByTitle('Ada Nowak · 7 nights');
    expect(bar).toBeVisible();
    expect(bar.style.left).toBe('0%');
    expect(bar.style.width).toBe('100%');
  });

  it('PPVC-727: renders two non-overlapping booster segments with correct night counts', () => {
    render(
      <RoomStayTimeline
        retreat={retreat}
        occupants={[
          { _id: 'booster-1', name: 'First booster', roomStayStart: '2026-10-01', roomStayEnd: '2026-10-04' },
          { _id: 'booster-2', name: 'Second booster', roomStayStart: '2026-10-04', roomStayEnd: '2026-10-08' },
        ]}
      />,
    );
    expect(screen.getByTitle('First booster · 3 nights')).toBeVisible();
    expect(screen.getByTitle('Second booster · 4 nights')).toBeVisible();
  });

  it('does not hardcode a 7-day tick ruler -- renders the correct number of ticks for a longer retreat', () => {
    const { container } = render(
      <RoomStayTimeline
        retreat={{ startDate: '2026-10-01', endDate: '2026-10-11' }}
        occupants={[{ _id: 'b1', name: 'Guest' }]}
      />,
    );
    expect(container.querySelectorAll('[aria-label="Room stay timeline"] > div:first-child > span')).toHaveLength(11);
  });
});
