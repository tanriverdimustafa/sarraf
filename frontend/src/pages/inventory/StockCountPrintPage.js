import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../lib/api';

export default function StockCountPrintPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const response = await api.get(`/api/stock-counts/${id}/print`);
      setData(response.data);
      // Auto print after load
      setTimeout(() => window.print(), 500);
    } catch (error) {
      console.error('Error fetching print data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Yükleniyor...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Veri bulunamadı</p>
      </div>
    );
  }

  const { count, sections, summary } = data;

  return (
    <div className="p-8 bg-white text-black min-h-screen print:p-4">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .page-break { page-break-after: always; }
          .no-break { page-break-inside: avoid; }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #333; padding: 6px 8px; font-size: 11px; }
        th { background-color: #f3f4f6; font-weight: 600; }
        .header { border: 2px solid #333; padding: 16px; margin-bottom: 16px; }
        .section-title { background-color: #1f2937; color: white; padding: 8px 12px; font-weight: bold; margin: 16px 0 8px 0; }
        .checkbox { width: 16px; height: 16px; border: 1px solid #333; display: inline-block; }
        .signature-section { margin-top: 24px; padding-top: 16px; border-top: 2px solid #333; }
      `}</style>

      {/* Header */}
      <div className="header text-center">
        <h1 className="text-xl font-bold mb-2">STOK SAYIM LİSTESİ</h1>
        <div className="grid grid-cols-3 gap-4 text-sm mt-4">
          <div><strong>Sayım No:</strong> {count?.id}</div>
          <div><strong>Tarih:</strong> {new Date(data.print_date).toLocaleDateString('tr-TR')}</div>
          <div><strong>Tip:</strong> {count?.type === 'MANUAL' ? 'Manuel' : 'Barkodlu'}</div>
        </div>
      </div>

      {/* Section 1: Barcode Products */}
      <div className="no-break">
        <div className="section-title">
          BARKODLU ÜRÜNLER ({sections.barcode.items.length} adet)
        </div>
        <table>
          <thead>
            <tr>
              <th style={{width: '30px'}}>#</th>
              <th style={{width: '120px'}}>Barkod</th>
              <th style={{width: '100px'}}>Ürün Tipi</th>
              <th>Ürün Adı</th>
              <th style={{width: '50px'}}>Ayar</th>
              <th style={{width: '60px'}}>Gram</th>
              <th style={{width: '50px'}}>Sayıldı</th>
              <th style={{width: '80px'}}>Not</th>
            </tr>
          </thead>
          <tbody>
            {sections.barcode.items.map((item, idx) => (
              <tr key={item.id}>
                <td className="text-center">{idx + 1}</td>
                <td className="font-mono text-xs">{item.barcode}</td>
                <td>{item.product_type}</td>
                <td>{item.product_name}</td>
                <td className="text-center">{item.karat}</td>
                <td className="text-right">{item.system_weight_gram?.toFixed(2)}</td>
                <td className="text-center"><span className="checkbox"></span></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Page Break */}
      {sections.pool.items.length > 0 && <div className="page-break"></div>}

      {/* Section 2: Pool Products (Bilezik) */}
      {sections.pool.items.length > 0 && (
        <div className="no-break">
          <div className="section-title">
            BİLEZİK HAVUZ - Gram Tartılacak ({sections.pool.items.length} kalem)
          </div>
          <table>
            <thead>
              <tr>
                <th style={{width: '30px'}}>#</th>
                <th style={{width: '120px'}}>Ürün Tipi</th>
                <th>Ürün Adı</th>
                <th style={{width: '60px'}}>Ayar</th>
                <th style={{width: '100px'}}>Sistem Gram</th>
                <th style={{width: '100px'}}>Sayılan Gram</th>
                <th style={{width: '80px'}}>Fark</th>
              </tr>
            </thead>
            <tbody>
              {sections.pool.items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="text-center">{idx + 1}</td>
                  <td>{item.product_type}</td>
                  <td>{item.product_name}</td>
                  <td className="text-center">{item.karat}</td>
                  <td className="text-right font-medium">{item.system_weight_gram?.toFixed(2)} gr</td>
                  <td></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section 3: Piece Products (Sarrafiye) */}
      {sections.piece.items.length > 0 && (
        <div className="no-break" style={{marginTop: '16px'}}>
          <div className="section-title">
            SARRAFİYE - Adet Sayılacak ({sections.piece.items.length} kalem)
          </div>
          <table>
            <thead>
              <tr>
                <th style={{width: '30px'}}>#</th>
                <th style={{width: '120px'}}>Ürün Tipi</th>
                <th>Ürün Adı</th>
                <th style={{width: '60px'}}>Ayar</th>
                <th style={{width: '100px'}}>Sistem Adet</th>
                <th style={{width: '100px'}}>Sayılan Adet</th>
                <th style={{width: '80px'}}>Fark</th>
              </tr>
            </thead>
            <tbody>
              {sections.piece.items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="text-center">{idx + 1}</td>
                  <td>{item.product_type}</td>
                  <td>{item.product_name}</td>
                  <td className="text-center">{item.karat}</td>
                  <td className="text-right font-medium">{item.system_quantity} adet</td>
                  <td></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="no-break" style={{marginTop: '24px', padding: '12px', border: '2px solid #333'}}>
        <h3 className="font-bold mb-2">ÖZET</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>• Toplam Barkodlu Ürün: <strong>{summary.total_barcode_items} adet</strong></div>
          <div>• Toplam Bilezik Havuz: <strong>{summary.total_pool_weight?.toFixed(2)} gr</strong></div>
          <div>• Toplam Sarrafiye: <strong>{summary.total_piece_count} adet</strong></div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="signature-section">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p>Sayan: _______________________________</p>
            <p style={{marginTop: '16px'}}>İmza: _______________________________</p>
          </div>
          <div>
            <p>Kontrol Eden: _______________________________</p>
            <p style={{marginTop: '16px'}}>İmza: _______________________________</p>
          </div>
        </div>
        <p style={{marginTop: '16px'}}>Sayım Tarihi: ____/____/________ &nbsp;&nbsp;&nbsp; Saat: ____:____</p>
      </div>
    </div>
  );
}
