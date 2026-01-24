import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { getPartyBalance, formatHAS, formatCurrency } from '../../services/financialV2Service';
import { toast } from 'sonner';

const PartyBalanceWidget = ({ partyId }) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (partyId) {
      loadBalance();
    }
  }, [partyId]);

  const loadBalance = async () => {
    setLoading(true);
    try {
      const data = await getPartyBalance(partyId);
      setBalance(data);
    } catch (error) {
      console.error('Balance load error:', error);
      toast.error('Party balance yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  if (!partyId) return null;

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Party Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!balance) return null;

  const totalHAS = balance.total_has || 0;
  const isPositive = totalHAS >= 0;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          Party Balance
        </CardTitle>
        <CardDescription>{partyId}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total HAS */}
          <div>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <span className="text-sm text-muted-foreground">Toplam HAS</span>
            </div>
            <div
              className={`text-3xl font-bold ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatHAS(totalHAS)}
            </div>
          </div>

          {/* Currency Breakdown */}
          {balance.currency_breakdown && balance.currency_breakdown.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-primary/10">
              <span className="text-xs text-muted-foreground font-medium">Döviz Bazında</span>
              {balance.currency_breakdown.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.currency || 'N/A'}</span>
                  <span className="font-medium">
                    {formatCurrency(item.total_amount)} ({formatHAS(item.total_has)} HAS)
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary/10">
            <div>
              <div className="text-xs text-muted-foreground">İşlem Sayısı</div>
              <div className="text-lg font-semibold">{balance.transaction_count || 0}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Son İşlem</div>
              <div className="text-xs font-medium">
                {balance.last_transaction_date
                  ? new Date(balance.last_transaction_date).toLocaleDateString('tr-TR')
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PartyBalanceWidget;
