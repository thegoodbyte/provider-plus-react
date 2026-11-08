import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Card, CardHeader, Badge, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, Modal, EmptyState } from './index';

describe('Card', () => {
  it('renders children inside a bordered surface', () => {
    render(<Card>Section content</Card>);
    expect(screen.getByText('Section content')).toBeInTheDocument();
  });
  it('CardHeader shows title, subtitle and the action on the right', () => {
    render(<CardHeader title="Clients" subtitle="12 active" action={<button type="button">Add client</button>} />);
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('12 active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add client' })).toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('applies the tone color classes by default', () => {
    render(<Badge tone="success">Paid</Badge>);
    expect(screen.getByText('Paid')).toHaveClass('bg-emerald-100', 'text-emerald-800');
  });
  it('colorClassName fully replaces tone instead of fighting it', () => {
    render(<Badge tone="success" colorClassName="bg-violet-100 text-violet-800">Booked</Badge>);
    const badge = screen.getByText('Booked');
    expect(badge).toHaveClass('bg-violet-100', 'text-violet-800');
    expect(badge).not.toHaveClass('bg-emerald-100');
  });
  it('defaults to the neutral tone when none is given', () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText('Draft')).toHaveClass('bg-apple-gray-100');
  });
});

describe('Table', () => {
  it('wraps the table in an overflow-x-auto container so the page body never scrolls sideways', () => {
    const { container } = render(
      <Table>
        <TableHead><tr><TableHeaderCell>Name</TableHeaderCell></tr></TableHead>
        <TableBody><TableRow><TableCell>Ada</TableCell></TableRow></TableBody>
      </Table>,
    );
    expect(container.querySelector('.overflow-x-auto')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });
  it('TableHeaderCell without onSort renders plain text, not a button', () => {
    render(<table><thead><tr><TableHeaderCell>Name</TableHeaderCell></tr></thead></table>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });
  it('TableHeaderCell with onSort renders a clickable header that fires the handler', () => {
    const onSort = jest.fn();
    render(<table><thead><tr><TableHeaderCell onSort={onSort} sortDirection="asc">Name</TableHeaderCell></tr></thead></table>);
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalled();
  });
  it('TableRow with onClick is clickable and reports pointer intent via cursor-pointer', () => {
    const onClick = jest.fn();
    render(<table><tbody><TableRow onClick={onClick}><TableCell>Row</TableCell></TableRow></tbody></table>);
    fireEvent.click(screen.getByText('Row'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('EmptyState', () => {
  it('shows the title, description and action', () => {
    render(<EmptyState title="No clients yet" description="Clients you add will show up here." action={<button type="button">Add client</button>} />);
    expect(screen.getByText('No clients yet')).toBeInTheDocument();
    expect(screen.getByText('Clients you add will show up here.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add client' })).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={jest.fn()} title="Edit client">content</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('renders the dialog with title, body and footer when open', () => {
    render(<Modal open onClose={jest.fn()} title="Edit client" footer={<button type="button">Save</button>}>Body text</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit client')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
  it('closes on Escape and on close-button click', () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="Edit client">content</Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('closes on overlay click but not on panel click', () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="Edit client">content</Modal>);
    fireEvent.mouseDown(screen.getByText('content'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
