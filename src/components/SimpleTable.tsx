import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  TextField,
  IconButton,
  Tooltip,
  Checkbox,
  Typography,
  Toolbar,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

export interface Column {
  field: string;
  headerName: string;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  filterable?: boolean;
  renderCell?: (value: any, row: any) => React.ReactNode;
  valueGetter?: (row: any) => any;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

interface SimpleTableProps {
  columns: Column[];
  rows: any[];
  onRowClick?: (row: any) => void;
  onSelectionChange?: (selectedRows: any[]) => void;
  selectable?: boolean;
  title?: string;
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  searchable?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
  dense?: boolean;
  stickyHeader?: boolean;
  maxHeight?: number | string;
  showToolbar?: boolean;
  customActions?: React.ReactNode;
}

type Order = 'asc' | 'desc';

export const SimpleTable: React.FC<SimpleTableProps> = ({
  columns,
  rows,
  onRowClick,
  onSelectionChange,
  selectable = false,
  title,
  loading = false,
  onRefresh,
  onExport,
  searchable = true,
  pageSize: defaultPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50, 100],
  dense = false,
  stickyHeader = true,
  maxHeight = '75vh',
  showToolbar = true,
  customActions
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(defaultPageSize);
  const [searchText, setSearchText] = useState('');
  const [orderBy, setOrderBy] = useState<string>('');
  const [order, setOrder] = useState<Order>('asc');
  const [selected, setSelected] = useState<string[]>([]);

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = visibleRows.map((row, index) =>
        row.id || row._id || `row-${index}`
      );
      setSelected(newSelected);
      onSelectionChange?.(visibleRows);
    } else {
      setSelected([]);
      onSelectionChange?.([]);
    }
  };

  const handleRowSelect = (row: any, rowId: string) => {
    const selectedIndex = selected.indexOf(rowId);
    let newSelected: string[] = [];

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, rowId);
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1));
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1));
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(
        selected.slice(0, selectedIndex),
        selected.slice(selectedIndex + 1)
      );
    }

    setSelected(newSelected);
    const selectedRows = rows.filter(r => {
      const id = r.id || r._id || `row-${rows.indexOf(r)}`;
      return newSelected.includes(id);
    });
    onSelectionChange?.(selectedRows);
  };

  const filteredRows = useMemo(() => {
    if (!searchText) return rows;

    return rows.filter(row => {
      return columns.some(column => {
        const value = column.valueGetter
          ? column.valueGetter(row)
          : row[column.field];

        if (value === null || value === undefined) return false;

        return String(value)
          .toLowerCase()
          .includes(searchText.toLowerCase());
      });
    });
  }, [rows, searchText, columns]);

  const sortedRows = useMemo(() => {
    if (!orderBy) return filteredRows;

    const column = columns.find(c => c.field === orderBy);
    if (!column) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aValue = column.valueGetter ? column.valueGetter(a) : a[orderBy];
      const bValue = column.valueGetter ? column.valueGetter(b) : b[orderBy];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (column.type === 'number') {
        return order === 'asc'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      if (column.type === 'date') {
        return order === 'asc'
          ? new Date(aValue).getTime() - new Date(bValue).getTime()
          : new Date(bValue).getTime() - new Date(aValue).getTime();
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (order === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [filteredRows, orderBy, order, columns]);

  const visibleRows = useMemo(() => {
    return sortedRows.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [sortedRows, page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const isSelected = (rowId: string) => selected.indexOf(rowId) !== -1;

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {showToolbar && (
        <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
          {title && (
            <Typography sx={{ flex: '1 1 100%' }} variant="h6" component="div">
              {title}
              {selected.length > 0 && (
                <Typography variant="subtitle1" component="span" sx={{ ml: 2 }}>
                  {selected.length} selected
                </Typography>
              )}
            </Typography>
          )}

          {searchable && (
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              sx={{ mr: 2, minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchText && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchText('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          )}

          {customActions}

          {onExport && (
            <Tooltip title="Export">
              <IconButton onClick={onExport}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )}

          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>
      )}

      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader={stickyHeader} size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < visibleRows.length}
                    checked={visibleRows.length > 0 && selected.length === visibleRows.length}
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  align={column.align || 'left'}
                  style={{ minWidth: column.width }}
                  sortDirection={orderBy === column.field ? order : false}
                >
                  {column.sortable !== false ? (
                    <TableSortLabel
                      active={orderBy === column.field}
                      direction={orderBy === column.field ? order : 'asc'}
                      onClick={() => handleRequestSort(column.field)}
                    >
                      {column.headerName}
                    </TableSortLabel>
                  ) : (
                    column.headerName
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : visibleRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} align="center">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row, index) => {
                const rowId = row.id || row._id || `row-${index}`;
                const isItemSelected = isSelected(rowId);

                return (
                  <TableRow
                    key={rowId}
                    hover
                    onClick={() => onRowClick?.(row)}
                    selected={isItemSelected}
                    sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {selectable && (
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isItemSelected}
                          onChange={() => handleRowSelect(row, rowId)}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => {
                      const value = column.valueGetter
                        ? column.valueGetter(row)
                        : row[column.field];

                      return (
                        <TableCell key={column.field} align={column.align || 'left'}>
                          {column.renderCell ? column.renderCell(value, row) : value}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        rowsPerPageOptions={pageSizeOptions}
        component="div"
        count={filteredRows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default SimpleTable;