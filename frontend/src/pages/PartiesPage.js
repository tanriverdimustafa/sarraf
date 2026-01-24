import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { partyService, lookupService } from '../services';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Users, 
  Plus, 
  Search, 
  Eye,
  Building2,
  User,
  Pencil,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import PartyFormDialog from '../components/PartyFormDialog';
import { toast } from 'sonner';

const PartiesPage = () => {
  const navigate = useNavigate();
  const [parties, setParties] = useState([]);
  const [partyTypes, setPartyTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTypeId, setFilterTypeId] = useState(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchParties();
  }, [filterTypeId, page, pageSize]);

  const fetchLookups = async () => {
    try {
      const data = await lookupService.getPartyTypes();
      setPartyTypes(data);
    } catch (error) {
      console.error('Error fetching party types:', error);
      toast.error('Cari tipleri yüklenemedi');
    }
  };

  const fetchParties = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        page_size: pageSize,
        sort_by: 'created_at',
        sort_order: 'desc'
      };
      if (filterTypeId) {
        params.party_type_id = filterTypeId;
      }
      if (search) {
        params.search = search;
      }

      const response = await partyService.getAll(params);
      
      // Handle new paginated response
      if (response.data) {
        setParties(response.data);
        setTotalItems(response.pagination.total_items);
        setTotalPages(response.pagination.total_pages);
      } else {
        // Fallback for old response format
        setParties(response);
        setTotalItems(response.length);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching parties:', error);
      toast.error('Cariler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1); // Reset to first page on search
    fetchParties();
  };

  const handleCreateParty = () => {
    setEditingParty(null);
    setShowFormDialog(true);
  };

  const handleEditParty = (party) => {
    setEditingParty(party);
    setShowFormDialog(true);
  };

  const handleFormSuccess = () => {
    setShowFormDialog(false);
    setEditingParty(null);
    fetchParties();
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(Number(newSize));
    setPage(1); // Reset to first page
  };

  const formatBalance = (value) => {
    if (value === 0 || value === null || value === undefined) return '0.00';
    return parseFloat(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const getPartyTypeName = (typeId) => {
    if (typeId === 1) return 'Müşteri';
    if (typeId === 2) return 'Tedarikçi';
    const type = partyTypes.find(t => t.id === typeId);
    return type ? type.name : '';
  };

  const getTypeColor = (typeId) => {
    const colors = {
      1: 'bg-green-500/10 text-green-500 border-green-500/20',
      2: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      3: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      4: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      5: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      6: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      7: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    };
    return colors[typeId] || 'bg-muted text-muted-foreground';
  };

  const getDisplayName = (party) => {
    if (party.party_type_id === 1) {
      return party.first_name && party.last_name 
        ? `${party.first_name} ${party.last_name}`
        : party.name;
    } else if (party.party_type_id === 2) {
      return party.company_name || party.name;
    }
    return party.name;
  };

  const getLocation = (party) => {
    if (party.city && party.district) {
      return `${party.city}/${party.district}`;
    }
    return party.city || party.district || '-';
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="space-y-6" data-testid="parties-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-medium text-foreground">Cariler</h1>
          <p className="text-muted-foreground mt-1">Müşteri ve tedarikçi yönetimi</p>
        </div>
        <Button 
          onClick={handleCreateParty}
          className="gold-glow-hover"
          data-testid="create-party-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Cari
        </Button>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 flex gap-2 min-w-[300px]">
              <Input
                placeholder="Cari adı veya kod ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                data-testid="search-input"
              />
              <Button onClick={handleSearch} variant="outline">
                <Search className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterTypeId === null ? 'default' : 'outline'}
                onClick={() => { setFilterTypeId(null); setPage(1); }}
                size="sm"
              >
                Tümü
              </Button>
              <Button
                variant={filterTypeId === 1 ? 'default' : 'outline'}
                onClick={() => { setFilterTypeId(1); setPage(1); }}
                size="sm"
              >
                <User className="w-4 h-4 mr-1" />
                Müşteriler
              </Button>
              <Button
                variant={filterTypeId === 2 ? 'default' : 'outline'}
                onClick={() => { setFilterTypeId(2); setPage(1); }}
                size="sm"
              >
                <Building2 className="w-4 h-4 mr-1" />
                Tedarikçiler
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parties Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-sans">Cari Listesi</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sayfa başına:</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
          ) : parties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Henüz cari bulunmuyor</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="parties-table">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Kod</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Cari Adı</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Tip</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Telefon</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">İl/İlçe</th>
                      <th className="text-right p-3 text-sm font-semibold text-muted-foreground">HAS Bakiye</th>
                      <th className="text-right p-3 text-sm font-semibold text-muted-foreground">TL</th>
                      <th className="text-center p-3 text-sm font-semibold text-muted-foreground">Durum</th>
                      <th className="text-center p-3 text-sm font-semibold text-muted-foreground">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parties.map((party, idx) => (
                      <tr 
                        key={party.id} 
                        className={`border-b border-border hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                      >
                        <td className="p-3 font-mono text-sm text-muted-foreground">{party.code}</td>
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-2">
                            {party.party_type_id === 1 ? (
                              <User className="w-4 h-4 text-green-500" />
                            ) : party.party_type_id === 2 ? (
                              <Building2 className="w-4 h-4 text-blue-500" />
                            ) : null}
                            {getDisplayName(party)}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge className={getTypeColor(party.party_type_id)}>
                            {getPartyTypeName(party.party_type_id)}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">{party.phone || '-'}</td>
                        <td className="p-3 text-sm">{getLocation(party)}</td>
                        <td className="p-3 text-right">
                          <span className={`font-medium ${party.has_balance > 0 ? 'text-green-600' : party.has_balance < 0 ? 'text-red-600' : ''}`}>
                            {formatBalance(party.has_balance)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`font-medium ${party.tl_balance > 0 ? 'text-green-600' : party.tl_balance < 0 ? 'text-red-600' : ''}`}>
                            {formatBalance(party.tl_balance || 0)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={party.is_active !== false ? 'default' : 'secondary'}>
                            {party.is_active !== false ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditParty(party)}
                              title="Düzenle"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/parties/${party.id}`)}
                              title="Detay"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  Toplam {totalItems} kayıt, Sayfa {page}/{totalPages}
                </span>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Önceki
                  </Button>
                  
                  {getPageNumbers().map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className="w-10"
                    >
                      {pageNum}
                    </Button>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Sonraki
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <PartyFormDialog
        open={showFormDialog}
        onClose={() => { setShowFormDialog(false); setEditingParty(null); }}
        onSuccess={handleFormSuccess}
        party={editingParty}
        partyTypes={partyTypes}
      />
    </div>
  );
};

export default PartiesPage;
