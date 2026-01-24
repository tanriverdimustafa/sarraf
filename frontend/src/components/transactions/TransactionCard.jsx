import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, XCircle } from 'lucide-react';
import {
  formatHAS,
  formatCurrency,
  getTransactionTypeLabel,
  getStatusLabel,
  getStatusColor,
} from '../../services/financialV2Service';

const TransactionCard = ({ transaction, onClick }) => {
  const isCancelled = transaction.status === 'CANCELLED';
  
  const getDirectionIcon = () => {
    if (isCancelled) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (transaction.total_has_amount > 0) {
      return <ArrowDownLeft className="w-4 h-4 text-green-600" />;
    } else if (transaction.total_has_amount < 0) {
      return <ArrowUpRight className="w-4 h-4 text-red-600" />;
    }
    return <RefreshCw className="w-4 h-4 text-blue-600" />;
  };

  const getDirectionColor = () => {
    if (isCancelled) return 'text-red-400 line-through';
    if (transaction.total_has_amount > 0) return 'text-green-600';
    if (transaction.total_has_amount < 0) return 'text-red-600';
    return 'text-blue-600';
  };

  return (
    <Card
      className={`hover:shadow-lg transition-shadow cursor-pointer border-primary/20 ${isCancelled ? 'bg-red-50/50 dark:bg-red-950/20 opacity-70' : ''}`}
      onClick={() => onClick(transaction)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                {getDirectionIcon()}
                <span className="font-semibold text-lg">{transaction.code}</span>
              </div>
              <Badge variant="outline" className={getStatusColor(transaction.status)}>
                {getStatusLabel(transaction.status)}
              </Badge>
            </div>

            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-medium">Tip:</span>
                <span>{getTransactionTypeLabel(transaction.type_code)}</span>
              </div>

              {(transaction.party_name || transaction.party_id) && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Cari:</span>
                  <span>{transaction.party_name || transaction.party_id}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="font-medium">Tarih:</span>
                <span>
                  {new Date(transaction.transaction_date).toLocaleDateString('tr-TR')}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className={`text-2xl font-bold ${getDirectionColor()}`}>
              {formatHAS(transaction.total_has_amount)} HAS
            </div>
            {transaction.currency && transaction.total_amount_currency && (
              <div className="text-sm text-muted-foreground mt-1">
                {formatCurrency(transaction.total_amount_currency)} {transaction.currency}
              </div>
            )}
          </div>
        </div>

        {transaction.notes && (
          <div className="mt-4 pt-4 border-t border-primary/10">
            <p className="text-sm text-muted-foreground italic">{transaction.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionCard;
