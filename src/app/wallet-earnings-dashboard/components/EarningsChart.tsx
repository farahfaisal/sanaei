'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type EarningTab = 'today' | 'week' | 'month' | 'total';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  label: string;
  created_at: string;
}

const DAY_LABELS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function buildChartData(activeTab: EarningTab, transactions: Transaction[]) {
  const incomeTransactions = transactions.filter((t) => t.transaction_type === 'income');
  const now = new Date();

  if (activeTab === 'today') {
    const hours = [8, 10, 12, 14, 16, 18, 20];
    const labels = ['8ص', '10ص', '12م', '2م', '4م', '6م', '8م'];
    return hours.map((h, i) => {
      const value = incomeTransactions
        .filter((t) => {
          const d = new Date(t.created_at);
          return d.toDateString() === now.toDateString() && d.getHours() >= h && d.getHours() < h + 2;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      return { label: labels[i], value };
    });
  }

  if (activeTab === 'week') {
    return DAY_LABELS.map((label, dayIndex) => {
      const value = incomeTransactions
        .filter((t) => {
          const d = new Date(t.created_at);
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return d >= weekAgo && d.getDay() === dayIndex;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      return { label, value };
    });
  }

  if (activeTab === 'month') {
    return [1, 2, 3, 4].map((week) => {
      const value = incomeTransactions
        .filter((t) => {
          const d = new Date(t.created_at);
          return d.getMonth() === now.getMonth() && Math.ceil(d.getDate() / 7) === week;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      return { label: `الأسبوع ${week}`, value };
    });
  }

  // total - last 6 months
  return Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const value = incomeTransactions
      .filter((t) => {
        const d = new Date(t.created_at);
        return d.getMonth() === monthDate.getMonth() && d.getFullYear() === monthDate.getFullYear();
      })
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      label: monthDate.toLocaleDateString('ar-SA', { month: 'short' }),
      value,
    };
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-foreground text-white text-xs rounded-xl px-3 py-2 shadow-card-hover">
      <div className="font-semibold mb-0.5">{label}</div>
      <div className="font-tabular font-bold">{payload[0].value.toLocaleString('ar')} ₪</div>
    </div>
  );
}

export default function EarningsChart({
  activeTab,
  transactions = [],
}: {
  activeTab: EarningTab;
  transactions?: Transaction[];
}) {
  const data = buildChartData(activeTab, transactions);
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[180px] text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm">لا توجد أرباح في هذه الفترة</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', radius: 6 }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {data.map((entry, index) => (
            <Cell
              key={`bar-cell-${index}`}
              fill={entry.value === maxValue ? 'var(--accent)' : 'var(--primary)'}
              opacity={entry.value === maxValue ? 1 : 0.7}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}