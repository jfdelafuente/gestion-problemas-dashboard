'use client';

interface FilterBarProps {
  onDateRangeChange: (days: number) => void;
  selectedDays: number;
}

export default function FilterBar({ onDateRangeChange, selectedDays }: FilterBarProps) {
  const dateRanges = [
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 30 días', days: 30 },
    { label: 'Últimos 90 días', days: 90 },
    { label: 'Último año', days: 365 },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6">
      <div className="flex flex-wrap gap-2">
        <label className="text-sm font-medium text-gray-700 self-center">Período:</label>
        <div className="flex flex-wrap gap-2">
          {dateRanges.map((range) => (
            <button
              key={range.days}
              onClick={() => onDateRangeChange(range.days)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                selectedDays === range.days
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-500">
        ℹ️ Los datos se actualizan automáticamente cada hora
      </div>
    </div>
  );
}
