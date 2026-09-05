import React, { useCallback, useEffect, useState } from 'react';
import { foodMatrixApi, FoodMatrixData } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface FoodMatrixGridProps {
  retreatId: string;
}

const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Original language (no translation)' },
  { value: 'en', label: 'English' },
  { value: 'pl', label: 'Polish' },
  { value: 'cs', label: 'Czech' },
];

const FoodMatrixGrid: React.FC<FoodMatrixGridProps> = ({ retreatId }) => {
  const [data, setData] = useState<FoodMatrixData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchMatrix = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await foodMatrixApi.get(retreatId);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching food matrix:', error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [retreatId]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      const response = await foodMatrixApi.getPdf(retreatId, language || undefined);
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `food-matrix-${retreatId}${language ? `-${language}` : ''}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting food matrix PDF:', error);
      setExportError(error?.response?.data?.message || 'Unable to generate the PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <LoadingSpinner message="Loading food matrix..." />;

  if (!data) {
    return <div className="p-6 text-sm text-gray-500">Unable to load the food matrix.</div>;
  }

  return (
    <div className="food-matrix-section">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">Food Matrix ({data.columns.length} clients)</h2>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="border border-gray-300 rounded-md text-sm px-2 py-1.5"
            aria-label="PDF language"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            onClick={handleDownloadPdf}
            disabled={isExporting || data.columns.length === 0}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isExporting ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {exportError && <div className="mb-3 text-sm text-red-600">{exportError}</div>}

      {data.columns.length === 0 ? (
        <div className="p-6 text-sm text-gray-500 bg-white rounded-lg border border-gray-200">
          No active clients booked on this retreat yet.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase text-xs sticky left-0 bg-gray-50">
                  Question
                </th>
                {data.columns.map((column) => (
                  <th key={column.clientId} className="px-4 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                    {column.label}
                    {!column.submitted && <span className="ml-1 text-xs font-normal text-amber-600">(not submitted)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.questions.map((question) => (
                <tr key={question.key}>
                  <td className="px-4 py-2 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white">
                    {question.label}
                  </td>
                  {data.columns.map((column) => (
                    <td key={column.clientId} className="px-4 py-2 text-gray-800 align-top max-w-xs">
                      {String(column.answers[question.key] ?? '').trim() || <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FoodMatrixGrid;
