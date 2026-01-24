import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import PurchaseForm from '../../components/transactions/forms/PurchaseForm';

const PurchaseTransactionPage = () => {
  const navigate = useNavigate();

  const handleSuccess = (result) => {
    navigate(`/transactions/${result.code}`);
  };

  const handleCancel = () => {
    navigate('/transactions');
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Geri
        </Button>
        <h1 className="text-4xl font-serif font-medium text-foreground">Yeni Alış İşlemi</h1>
        <p className="text-muted-foreground mt-1">PURCHASE - Tedarikçiden ürün alımı</p>
      </div>

      <PurchaseForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
};

export default PurchaseTransactionPage;
