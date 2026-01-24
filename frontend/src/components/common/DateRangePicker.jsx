/**
 * Date Range Picker Component
 * Tarih aralığı seçici
 */
import React from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Calendar } from 'lucide-react';

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  label = 'Tarih Aralığı',
  className = ''
}) {
  // Preset buttons
  const setToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onStartDateChange(today);
    onEndDateChange(today);
  };

  const setThisWeek = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    onStartDateChange(startOfWeek.toISOString().split('T')[0]);
    onEndDateChange(today.toISOString().split('T')[0]);
  };

  const setThisMonth = () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    onStartDateChange(startOfMonth.toISOString().split('T')[0]);
    onEndDateChange(today.toISOString().split('T')[0]);
  };

  const setThisYear = () => {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    onStartDateChange(startOfYear.toISOString().split('T')[0]);
    onEndDateChange(today.toISOString().split('T')[0]);
  };

  return (
    <div className={className}>
      {label && <Label className="mb-2 block">{label}</Label>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={setToday}>Bugün</Button>
          <Button variant="outline" size="sm" onClick={setThisWeek}>Bu Hafta</Button>
          <Button variant="outline" size="sm" onClick={setThisMonth}>Bu Ay</Button>
          <Button variant="outline" size="sm" onClick={setThisYear}>Bu Yıl</Button>
        </div>
      </div>
    </div>
  );
}

export default DateRangePicker;
